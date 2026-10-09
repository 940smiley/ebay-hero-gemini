/**
 * Structured Diagnostic Logging Service for eBay Hero (Backend)
 *
 * Implements:
 * - Levels: TRACE, DEBUG, INFO, WARN, ERROR
 * - Strict credential and secret scrubbing
 * - In-memory circular buffer
 * - Correlation IDs for tracing
 */

export type ServerLogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type ServerLogSubsystem = 
  | 'Google Photos'
  | 'Google Drive'
  | 'Gemini Vision'
  | 'OAuth Auth'
  | 'Managed Library'
  | 'eBay Service'
  | 'Server System';

export interface ServerLogEntry {
  id: string;
  timestamp: string;
  level: ServerLogLevel;
  subsystem: ServerLogSubsystem;
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

const MAX_SERVER_BUFFER = 2000;

class ServerDiagnosticLogger {
  private buffer: ServerLogEntry[] = [];

  generateId(prefix = 'srv'): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private sanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') {
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
    level: ServerLogLevel,
    subsystem: ServerLogSubsystem,
    event: string,
    message: string,
    opts: Partial<Omit<ServerLogEntry, 'id' | 'timestamp' | 'level' | 'subsystem' | 'event' | 'message'>> = {}
  ): ServerLogEntry {
    const entry: ServerLogEntry = {
      id: this.generateId('srvlog'),
      timestamp: new Date().toISOString(),
      level,
      subsystem,
      event,
      operationId: opts.operationId,
      jobId: opts.jobId,
      provider: opts.provider,
      action: opts.action,
      state: opts.state,
      durationMs: opts.durationMs,
      message: typeof message === 'string' ? this.sanitize(message) : message,
      details: opts.details ? this.sanitize(opts.details) : undefined,
    };

    this.buffer.push(entry);
    if (this.buffer.length > MAX_SERVER_BUFFER) {
      this.buffer.shift();
    }

    const logLine = `[${entry.timestamp}] [${level}] [${subsystem}] ${event}: ${message}`;
    if (level === 'ERROR') {
      console.error(logLine, entry.details ? JSON.stringify(entry.details) : '');
    } else if (level === 'WARN') {
      console.warn(logLine, entry.details ? JSON.stringify(entry.details) : '');
    } else {
      console.log(logLine);
    }

    return entry;
  }

  trace(subsystem: ServerLogSubsystem, event: string, message: string, opts?: any) {
    return this.log('TRACE', subsystem, event, message, opts);
  }

  debug(subsystem: ServerLogSubsystem, event: string, message: string, opts?: any) {
    return this.log('DEBUG', subsystem, event, message, opts);
  }

  info(subsystem: ServerLogSubsystem, event: string, message: string, opts?: any) {
    return this.log('INFO', subsystem, event, message, opts);
  }

  warn(subsystem: ServerLogSubsystem, event: string, message: string, opts?: any) {
    return this.log('WARN', subsystem, event, message, opts);
  }

  error(subsystem: ServerLogSubsystem, event: string, message: string, opts?: any) {
    return this.log('ERROR', subsystem, event, message, opts);
  }

  getEntries(limit = 200, level?: ServerLogLevel): ServerLogEntry[] {
    let result = this.buffer;
    if (level) {
      result = result.filter(e => e.level === level);
    }
    return result.slice(-limit);
  }

  clear() {
    this.buffer = [];
  }
}

export const serverLogger = new ServerDiagnosticLogger();
