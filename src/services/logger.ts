/**
 * Structured Diagnostic Logging Service for eBay Hero (Frontend)
 *
 * Implements:
 * - Levels: TRACE, DEBUG, INFO, WARN, ERROR
 * - Strict credential and secret scrubbing (Bearer tokens, client secrets, passwords)
 * - In-memory circular buffer with change notification for real-time UI
 * - Correlation IDs for end-to-end request tracing
 * - Export to JSON and formatted plaintext
 */

export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogSubsystem = 
  | 'Google Photos'
  | 'Google Drive'
  | 'Gemini Vision'
  | 'OAuth Auth'
  | 'Managed Library'
  | 'eBay Studio'
  | 'System';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  subsystem: LogSubsystem;
  event: string;
  operationId?: string;
  jobId?: string;
  provider?: string;
  action?: string;
  state?: string;
  durationMs?: number;
  message: string;
  details?: Record<string, any>;
}

// Maximum entries stored in browser memory
const MAX_BUFFER_SIZE = 1000;

class DiagnosticLogger {
  private buffer: LogEntry[] = [];
  private listeners: Set<(entries: LogEntry[]) => void> = new Set();
  private correlationId: string = '';

  constructor() {
    this.correlationId = this.generateId('sess');
  }

  generateId(prefix = 'op'): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  getSessionCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Deeply sanitizes objects to eliminate tokens, keys, secrets, and auth headers
   */
  private sanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') {
      // Redact Bearer tokens, API keys, passwords, client secrets
      return obj
        .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
        .replace(/AIza[0-9A-Za-z\-_]{35}/g, '[REDACTED_API_KEY]')
        .replace(/(client_secret|clientSecret|refreshToken|refresh_token|accessToken|access_token|password)=["']?[^&"'\s]+/gi, '$1=[REDACTED]');
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitize(item));
    }
    if (typeof obj === 'object') {
      const sanitized: Record<string, any> = {};
      const sensitiveKeys = [
        'authorization', 'auth', 'accesstoken', 'access_token',
        'refreshtoken', 'refresh_token', 'clientsecret', 'client_secret',
        'apikey', 'api_key', 'token', 'secret', 'password'
      ];
      for (const [k, v] of Object.entries(obj)) {
        const lowerKey = k.toLowerCase().replace(/[^a-z]/g, '');
        if (sensitiveKeys.some(s => lowerKey.includes(s))) {
          sanitized[k] = '[REDACTED]';
        } else {
          sanitized[k] = this.sanitize(v);
        }
      }
      return sanitized;
    }
    return obj;
  }

  log(
    level: LogLevel,
    subsystem: LogSubsystem,
    event: string,
    message: string,
    opts: Partial<Omit<LogEntry, 'id' | 'timestamp' | 'level' | 'subsystem' | 'event' | 'message'>> = {}
  ): LogEntry {
    const entry: LogEntry = {
      id: this.generateId('log'),
      timestamp: new Date().toISOString(),
      level,
      subsystem,
      event,
      operationId: opts.operationId || this.correlationId,
      jobId: opts.jobId,
      provider: opts.provider,
      action: opts.action,
      state: opts.state,
      durationMs: opts.durationMs,
      message: typeof message === 'string' ? this.sanitize(message) : message,
      details: opts.details ? this.sanitize(opts.details) : undefined,
    };

    // Add to buffer
    this.buffer.push(entry);
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }

    // Console output with distinctive style
    const badgeColor = {
      TRACE: 'color: #94a3b8',
      DEBUG: 'color: #38bdf8',
      INFO: 'color: #4ade80',
      WARN: 'color: #fbbf24; font-weight: bold',
      ERROR: 'color: #f87171; font-weight: bold',
    }[level];

    if (level === 'ERROR') {
      console.error(`%c[${level}][${subsystem}] ${event}: ${message}`, badgeColor, entry.details ?? '');
    } else if (level === 'WARN') {
      console.warn(`%c[${level}][${subsystem}] ${event}: ${message}`, badgeColor, entry.details ?? '');
    } else {
      console.log(`%c[${level}][${subsystem}] ${event}: ${message}`, badgeColor, entry.details ?? '');
    }

    // Notify UI listeners
    this.notify();
    return entry;
  }

  trace(subsystem: LogSubsystem, event: string, message: string, opts?: any) {
    return this.log('TRACE', subsystem, event, message, opts);
  }

  debug(subsystem: LogSubsystem, event: string, message: string, opts?: any) {
    return this.log('DEBUG', subsystem, event, message, opts);
  }

  info(subsystem: LogSubsystem, event: string, message: string, opts?: any) {
    return this.log('INFO', subsystem, event, message, opts);
  }

  warn(subsystem: LogSubsystem, event: string, message: string, opts?: any) {
    return this.log('WARN', subsystem, event, message, opts);
  }

  error(subsystem: LogSubsystem, event: string, message: string, opts?: any) {
    return this.log('ERROR', subsystem, event, message, opts);
  }

  getEntries(): LogEntry[] {
    return [...this.buffer];
  }

  clear() {
    this.buffer = [];
    this.notify();
  }

  subscribe(listener: (entries: LogEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.buffer]);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const snapshot = [...this.buffer];
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (e) {
        console.error('Logger listener error:', e);
      }
    }
  }

  exportToJson(): string {
    return JSON.stringify(this.buffer, null, 2);
  }

  exportToPlainText(): string {
    return this.buffer
      .map(e => `[${e.timestamp}] [${e.level.padEnd(5)}] [${e.subsystem}] ${e.event}: ${e.message} ${e.details ? JSON.stringify(e.details) : ''}`)
      .join('\n');
  }
}

export const logger = new DiagnosticLogger();
