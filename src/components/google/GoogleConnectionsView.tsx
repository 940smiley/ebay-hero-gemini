import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ExternalLink, 
  HardDrive, 
  Image as ImageIcon, 
  UserCheck, 
  Trash2, 
  Radio, 
  Activity,
  KeyRound,
  Info
} from 'lucide-react';
import { apiRequest } from '../../services/api.ts';

export interface GoogleAccountSummary {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  active: boolean;
  connectedAt: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  needsReconnect: boolean;
  drive: boolean;
  photos: boolean;
  grantedScopes: string[];
  hasRefreshToken: boolean;
  accessTokenExpiresInSeconds: number | null;
}

export interface GooglePublicStatus {
  configured: boolean;
  redirectUri: string;
  activeAccountId: string | null;
  accounts: GoogleAccountSummary[];
}

export interface DiagnosticCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export const GoogleConnectionsView: React.FC = () => {
  const [status, setStatus] = useState<GooglePublicStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticCheck[] | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const data = await apiRequest<GooglePublicStatus>('/api/google/status');
      setStatus(data);
    } catch (err: any) {
      setActionError(err.message || 'Failed to fetch Google connection status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Listen for OAuth completion message from popup window
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ebay-hero-google') {
        fetchStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchStatus]);

  const runDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const res = await apiRequest<{ checks: DiagnosticCheck[] }>('/api/google/diagnostics');
      setDiagnostics(res.checks);
    } catch (err: any) {
      setActionError(`Diagnostics failed: ${err.message}`);
    } finally {
      setDiagLoading(false);
    }
  };

  const startConnectFlow = (service: 'drive' | 'photos') => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(
      `/api/google/oauth/start?service=${service}`,
      'google-oauth-window',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
  };

  const handleActivateAccount = async (accountId: string) => {
    try {
      await apiRequest(`/api/google/accounts/${accountId}/activate`, { method: 'POST' });
      await fetchStatus();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!window.confirm('Disconnect this Google account? Stored access and refresh tokens will be revoked.')) {
      return;
    }
    try {
      await apiRequest(`/api/google/accounts/${accountId}/disconnect`, { method: 'POST' });
      await fetchStatus();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <span>Google Account Connection & API Status</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Server-managed OAuth credentials. Refresh tokens are AES-256-GCM encrypted at rest and never exposed to the frontend browser.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
          <button
            onClick={runDiagnostics}
            disabled={diagLoading}
            className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{diagLoading ? 'Testing...' : 'Run Diagnostics'}</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* OAuth Client Configuration Notice */}
      {status && !status.configured && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <Info className="w-4 h-4" />
            <span>Google OAuth Not Configured in Server Environment</span>
          </div>
          <p>
            To enable real Google Drive & Google Photos integration, define <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-100">GOOGLE_CLIENT_ID</code> and <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-100">GOOGLE_CLIENT_SECRET</code> in your server's <code className="bg-slate-950 px-1.5 py-0.5 rounded">.env</code> file.
          </p>
          <p className="text-[11px] text-amber-300/80">
            Authorized Redirect URI in Google Cloud Console must be set to: <strong className="font-mono text-white select-all">{status.redirectUri}</strong>
          </p>
        </div>
      )}

      {/* Connection Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google Drive Connection Box */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-400" />
                <span>Google Drive Access</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                drive.readonly
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Provides real hierarchical folder browsing, search, and high-resolution photo import from My Drive and Shared Drives.
            </p>
          </div>
          <button
            onClick={() => startConnectFlow('drive')}
            className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Connect Google Drive</span>
          </button>
        </div>

        {/* Google Photos Connection Box */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>Google Photos Access</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                photospicker.mediaitems.readonly
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Uses the official Google Photos Picker API. Allows selecting approved collectibles images directly in Google's secure UI.
            </p>
          </div>
          <button
            onClick={() => startConnectFlow('photos')}
            className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-600/20"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Connect Google Photos</span>
          </button>
        </div>
      </div>

      {/* Connected Accounts List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Connected Google Accounts ({status?.accounts.length || 0})
        </h4>

        {(!status || status.accounts.length === 0) ? (
          <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
            No Google accounts connected yet. Connect using the buttons above.
          </div>
        ) : (
          <div className="space-y-3">
            {status.accounts.map((acct) => (
              <div
                key={acct.id}
                className={`p-4 rounded-xl border transition-all ${
                  acct.active
                    ? 'bg-slate-950 border-blue-500/50 shadow-md ring-1 ring-blue-500/20'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {acct.picture ? (
                      <img src={acct.picture} alt="" className="w-10 h-10 rounded-full border border-slate-700" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold">
                        {acct.email.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{acct.name || acct.email}</span>
                        {acct.active && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Active
                          </span>
                        )}
                        {acct.needsReconnect && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Needs Reconnection
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{acct.email}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Drive Status Badge */}
                    <span className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 font-semibold ${
                      acct.drive
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>Drive: {acct.drive ? 'Authorized' : 'Missing Scope'}</span>
                    </span>

                    {/* Photos Status Badge */}
                    <span className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 font-semibold ${
                      acct.photos
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Photos: {acct.photos ? 'Authorized' : 'Missing Scope'}</span>
                    </span>

                    {!acct.active && (
                      <button
                        onClick={() => handleActivateAccount(acct.id)}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        Set Active
                      </button>
                    )}

                    <button
                      onClick={() => handleDisconnect(acct.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Disconnect account and revoke tokens"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details Footer */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400">
                  <div>
                    <span className="text-slate-500 block">Connected:</span>
                    <span>{new Date(acct.connectedAt).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Last Active:</span>
                    <span>{acct.lastSuccessAt ? new Date(acct.lastSuccessAt).toLocaleTimeString() : 'Never'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Token Expiry:</span>
                    <span>{acct.accessTokenExpiresInSeconds ? `${Math.round(acct.accessTokenExpiresInSeconds / 60)} min remaining` : 'Refreshed on demand'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Refresh Token:</span>
                    <span className={acct.hasRefreshToken ? 'text-emerald-400' : 'text-amber-400'}>
                      {acct.hasRefreshToken ? 'Saved (Encrypted)' : 'Missing'}
                    </span>
                  </div>
                </div>

                {acct.lastError && (
                  <div className="mt-2 text-xs text-rose-400 font-mono bg-rose-500/10 p-2 rounded-lg">
                    Error: {acct.lastError}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diagnostics Results */}
      {diagnostics && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Live Diagnostic Report</span>
            </h4>
            <button
              onClick={() => setDiagnostics(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>

          <div className="space-y-2">
            {diagnostics.map((c, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                {c.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold text-slate-200 block">{c.name}</span>
                  <span className="text-[11px] text-slate-400">{c.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
