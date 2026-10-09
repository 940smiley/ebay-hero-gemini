/**
 * Client HTTP utility with CSRF header, NDJSON stream parser, and error handling.
 */

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
  status: number;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'ebay-hero');
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errMsg = `Request failed (${response.status})`;
    let errCode = 'http_error';
    try {
      const json = await response.json();
      errMsg = json.error || errMsg;
      errCode = json.code || errCode;
    } catch {
      // non-JSON response
    }
    const error: any = new Error(errMsg);
    error.status = response.status;
    error.code = errCode;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return response.text() as Promise<any>;
}

/**
 * Stream NDJSON responses (e.g., from /api/google/drive/import or /api/google/photos/session/:id/import)
 */
export async function streamNdjson(
  path: string,
  body: any,
  onEvent: (event: any) => void,
  signal?: AbortSignal
): Promise<void> {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Requested-With': 'ebay-hero',
  });

  const response = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let errMsg = `Streaming request failed (${response.status})`;
    try {
      const json = await response.json();
      errMsg = json.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body stream not available');

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed);
          onEvent(parsed);
        } catch (e) {
          console.warn('Failed to parse NDJSON line:', trimmed, e);
        }
      }
    }
  }

  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer.trim()));
    } catch {}
  }
}

// ==========================================
// AI Intelligence APIs
// ==========================================
export async function analyzeImage(payload: {
  imageBase64: string;
  mimeType: string;
  originalFilename: string;
  provider?: string;
  model?: string;
  temperature?: number;
  enableThinking?: boolean;
}) {
  return apiRequest('/api/ai/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ==========================================
// File Renaming & Organization APIs
// ==========================================
export async function planFileOps(payload: {
  items: any[];
  renameConfig: any;
  dirConfig: any;
}) {
  return apiRequest('/api/fileops/plan', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function executeFileOps(payload: {
  manifest: any;
  approvedIds: string[];
  createFolders?: boolean;
}) {
  return apiRequest('/api/fileops/execute', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function rollbackFileOps(payload: {
  manifest: any;
}) {
  return apiRequest('/api/fileops/rollback', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ==========================================
// eBay Developer & CSV APIs
// ==========================================
export async function getEbayStatus() {
  return apiRequest<{
    connected: boolean;
    environment: 'sandbox' | 'production';
    hasCredentials: boolean;
    tokenValid: boolean;
    lastConnectedAt?: string;
  }>('/api/ebay/status');
}

export async function saveEbayCredentials(payload: {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
  devId?: string;
  ruName?: string;
}) {
  return apiRequest('/api/ebay/credentials', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function testEbayConnection() {
  return apiRequest<{
    success: boolean;
    environment: string;
    message: string;
    timestamp: string;
  }>('/api/ebay/test', {
    method: 'POST',
  });
}

export async function getEbayTemplates() {
  return apiRequest<{ templates: any[] }>('/api/ebay/templates');
}

export async function saveEbayTemplate(template: any) {
  return apiRequest('/api/ebay/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
}

export async function validateEbayRows(rows: any[]) {
  return apiRequest('/api/ebay/csv/validate', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}

export async function downloadEbayCsv(rows: any[], filename?: string): Promise<void> {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Requested-With': 'ebay-hero',
  });
  const res = await fetch('/api/ebay/csv/export', {
    method: 'POST',
    headers,
    body: JSON.stringify({ rows, filename }),
  });
  if (!res.ok) {
    throw new Error(`CSV export failed: ${res.statusText}`);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `ebay_file_exchange_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ==========================================
// Modular Plugin APIs
// ==========================================
export async function getPlugins() {
  return apiRequest<{
    plugins: Array<{
      manifest: any;
      enabled: boolean;
      customFieldsCount: number;
    }>;
    activeCustomFields: any[];
  }>('/api/plugins');
}

export async function togglePlugin(id: string, enabled: boolean) {
  return apiRequest(`/api/plugins/${id}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

export async function getPluginDiagnostics() {
  return apiRequest<{ diagnostics: any[] }>('/api/plugins/diagnostics');
}
