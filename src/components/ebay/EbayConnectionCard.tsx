import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  KeyRound, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ExternalLink,
  Lock
} from 'lucide-react';
import { getEbayStatus, saveEbayCredentials, testEbayConnection } from '../../services/api.ts';

export const EbayConnectionCard: React.FC = () => {
  const [status, setStatus] = useState<{
    connected: boolean;
    environment: 'sandbox' | 'production';
    hasCredentials: boolean;
    tokenValid: boolean;
    lastConnectedAt?: string;
  } | null>(null);

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [devId, setDevId] = useState('');
  const [ruName, setRuName] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const s = await getEbayStatus();
      setStatus(s);
      if (s.environment) setEnvironment(s.environment);
    } catch (e) {
      console.warn('Could not load eBay status:', e);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testEbayConnection();
      setTestResult(res);
      await loadStatus();
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      await saveEbayCredentials({
        clientId,
        clientSecret,
        environment,
        devId: devId.trim() || undefined,
        ruName: ruName.trim() || undefined,
      });
      await loadStatus();
      setTestResult({ success: true, message: 'eBay credentials securely encrypted and saved.' });
      setClientSecret('');
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Failed to save credentials' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold text-white">eBay Developer API & Marketplace Integration</h3>
            {status?.hasCredentials ? (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                status.connected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{status.environment.toUpperCase()} {status.connected ? 'ONLINE' : 'CONFIGURED'}</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                DISCONNECTED
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Connect eBay OAuth 2.0 Client credentials to publish listings, fetch taxonomy category IDs, and validate File Exchange CSV manifests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {status?.hasCredentials && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
              <span>Test Connection</span>
            </button>
          )}

          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer"
          >
            {showForm ? 'Hide Form' : status?.hasCredentials ? 'Update Keys' : 'Configure Credentials'}
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
          testResult.success
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
          <span>{testResult.message}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="space-y-4 pt-3 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Credentials are AES-256-GCM encrypted in the backend secret vault and never stored in client browser storage.</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Environment:</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
              >
                <option value="sandbox">Sandbox (eBay Developer Testing)</option>
                <option value="production">Production (eBay Live Marketplace)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">App ID (Client ID):</label>
              <input
                type="text"
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g. YourApp-Sandbox-PRD-..."
                className="w-full bg-slate-950 border border-slate-700 font-mono text-white rounded-lg p-2"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Cert ID (Client Secret):</label>
              <input
                type="password"
                required
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="e.g. PRD-123456789abc-..."
                className="w-full bg-slate-950 border border-slate-700 font-mono text-white rounded-lg p-2"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">RuName (eBay Redirect URL Name - Optional):</label>
              <input
                type="text"
                value={ruName}
                onChange={(e) => setRuName(e.target.value)}
                placeholder="Optional RuName"
                className="w-full bg-slate-950 border border-slate-700 font-mono text-white rounded-lg p-2"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <a
              href="https://developer.ebay.com/my/keys"
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 text-[11px] flex items-center gap-1"
            >
              <span>Get API Keys on developer.ebay.com</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
            >
              {saving ? 'Encrypting & Saving...' : 'Save & Encrypt Keys'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
