import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Play, 
  ExternalLink, 
  Check, 
  X, 
  Sparkles,
  HardDrive,
  Image as ImageIcon,
  Key,
  Database
} from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { logger } from '../../services/logger.ts';

export interface HealthCheckResult {
  id: string;
  name: string;
  category: 'Auth' | 'Drive' | 'Photos' | 'Gemini' | 'Storage' | 'Rendering';
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN';
  durationMs?: number;
  message: string;
  remediation?: string;
  details?: any;
}

export const DiagnosticHealthCheck: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<HealthCheckResult[]>([
    {
      id: 'oauth-config',
      name: 'Google OAuth Client Credentials',
      category: 'Auth',
      status: 'NOT_RUN',
      message: 'Verifies GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment',
    },
    {
      id: 'active-account',
      name: 'Google User Authentication & Refresh Token',
      category: 'Auth',
      status: 'NOT_RUN',
      message: 'Checks if an authorized Google account with encrypted refresh token is stored',
    },
    {
      id: 'drive-api',
      name: 'Google Drive API & Scopes',
      category: 'Drive',
      status: 'NOT_RUN',
      message: 'Tests live drive.about endpoint and folder navigation scope',
    },
    {
      id: 'photos-api',
      name: 'Google Photos Picker API & Permissions',
      category: 'Photos',
      status: 'NOT_RUN',
      message: 'Tests session initialization and access tokens for photospicker.googleapis.com',
    },
    {
      id: 'gemini-vision',
      name: 'Google Gemini Vision AI Engine',
      category: 'Gemini',
      status: 'NOT_RUN',
      message: 'Tests Gemini multimodal endpoint connectivity and API key validation',
    },
    {
      id: 'library-storage',
      name: 'Managed Image Library Storage',
      category: 'Storage',
      status: 'NOT_RUN',
      message: 'Tests disk storage read/write integrity in data/library',
    },
  ]);

  const runAllChecks = async () => {
    setIsRunning(true);
    const opId = logger.generateId('health');
    logger.info('System', 'health_check_start', 'Initiating full diagnostic health check suite', { operationId: opId });

    try {
      const res = await apiRequest<{ results: HealthCheckResult[] }>('/api/diagnostics/health');
      setResults(res.results || []);
      logger.info('System', 'health_check_complete', 'Health check suite execution completed', {
        operationId: opId,
        details: { total: res.results?.length },
      });
    } catch (e: any) {
      logger.error('System', 'health_check_error', `Health check failed: ${e.message}`, {
        operationId: opId,
        details: { error: e.message },
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusBadge = (status: HealthCheckResult['status']) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PASS
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 font-bold border border-amber-500/30 text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5" />
            WARNING
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 font-bold border border-rose-500/30 text-[11px]">
            <AlertCircle className="w-3.5 h-3.5" />
            FAIL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold border border-slate-700 text-[10px]">
            NOT RUN
          </span>
        );
    }
  };

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const warnCount = results.filter((r) => r.status === 'WARNING').length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>End-to-End Diagnostic Health Checks</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Automated verification of Google OAuth, Drive APIs, Photos Picker, Gemini Vision, and local disk persistence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {results.some((r) => r.status !== 'NOT_RUN') && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-400 font-bold">{passCount} Passed</span>
              {warnCount > 0 && <span className="text-amber-400 font-bold">{warnCount} Warnings</span>}
              {failCount > 0 && <span className="text-rose-400 font-bold">{failCount} Failed</span>}
            </div>
          )}

          <button
            onClick={runAllChecks}
            disabled={isRunning}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Running Checks...' : 'Run Diagnostics'}</span>
          </button>
        </div>
      </div>

      {/* Grid of Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {results.map((check) => (
          <div
            key={check.id}
            className={`p-4 rounded-xl border transition-all text-xs space-y-2 ${
              check.status === 'PASS'
                ? 'bg-emerald-950/10 border-emerald-900/30'
                : check.status === 'FAIL'
                ? 'bg-rose-950/20 border-rose-900/40'
                : check.status === 'WARNING'
                ? 'bg-amber-950/20 border-amber-900/40'
                : 'bg-slate-950/60 border-slate-800/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">{check.name}</span>
              {getStatusBadge(check.status)}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">{check.message}</p>

            {check.remediation && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] text-amber-300">
                <strong>Remediation:</strong> {check.remediation}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
