import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { 
  Settings, 
  Brain, 
  FolderSync, 
  Sliders, 
  ShieldCheck, 
  Server, 
  Check, 
  Radio, 
  Layers, 
  Cpu,
  RefreshCw,
  FolderTree
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { 
    aiSettings, 
    updateAiSettings, 
    driveConfig, 
    updateDriveConfig, 
    detectDrivePaths,
    folderRule,
    updateFolderRule,
    googleUser,
    googleAccessToken,
    signInWithGoogle,
    signOutWithGoogle,
    exportCatalogToGoogleSheets,
    openDrivePickerForImport
  } = useApp();

  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const testLocalEndpoint = async () => {
    setTestingEndpoint(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/local-ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: aiSettings.localEndpoint,
          model: aiSettings.localModelName,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Connection test failed' });
    } finally {
      setTestingEndpoint(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="pb-6 border-b border-slate-800">
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <span>Application Settings & AI Engine Configuration</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
            System Config
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure Gemini vision settings, local Ollama / Qwen endpoints, Google Drive for Desktop paths, and automated naming conventions.
        </p>
      </div>

      <div className="space-y-6">
        {/* 1. AI Provider Selection */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-amber-400" />
              <span>Vision AI Engine & Multimodal Providers</span>
            </h3>
            <span className="text-xs text-slate-400">
              Active: <strong className="text-amber-300 uppercase">{aiSettings.provider}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {[
              { id: 'gemini', title: 'Google Gemini', desc: 'Gemini 3.8 Flash & 3.1 Pro with High Thinking', badge: 'Cloud / High Res' },
              { id: 'ollama', title: 'Ollama Local', desc: 'Local models (e.g., LLaVA, Qwen-VL, Granite)', badge: 'Local Host' },
              { id: 'qwen', title: 'Alibaba Qwen-VL', desc: 'Qwen 2.5 Vision multimodal models', badge: 'Cloud / Local' },
              { id: 'openai', title: 'OpenAI-Compatible', desc: 'Custom local proxy or self-hosted vLLM', badge: 'Custom URL' },
            ].map((prov) => (
              <div
                key={prov.id}
                onClick={() => updateAiSettings({ provider: prov.id as any })}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  aiSettings.provider === prov.id
                    ? 'border-amber-500 bg-amber-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>{prov.title}</span>
                  {aiSettings.provider === prov.id && <Check className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{prov.desc}</p>
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-medium">
                  {prov.badge}
                </span>
              </div>
            ))}
          </div>

          {/* Gemini Specific Controls */}
          {aiSettings.provider === 'gemini' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Gemini Vision Model:</label>
                <select
                  value={aiSettings.geminiModel}
                  onChange={(e) => updateAiSettings({ geminiModel: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended: Low Latency & High Accuracy)</option>
                  <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex Reasoning & Thinking)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <span className="font-semibold text-slate-200 block">High Thinking Mode</span>
                  <span className="text-[11px] text-slate-400">Enables chain-of-thought analysis for subtle card flaws</span>
                </div>
                <input
                  type="checkbox"
                  checked={aiSettings.enableThinking}
                  onChange={(e) => updateAiSettings({ enableThinking: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-amber-500 w-4 h-4"
                />
              </div>
            </div>
          )}

          {/* Local AI Endpoint Controls */}
          {(aiSettings.provider === 'ollama' || aiSettings.provider === 'qwen' || aiSettings.provider === 'openai') && (
            <div className="space-y-3 pt-3 border-t border-slate-800/80 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Local Endpoint URL:</label>
                  <input
                    type="text"
                    value={aiSettings.localEndpoint}
                    onChange={(e) => updateAiSettings({ localEndpoint: e.target.value })}
                    placeholder="http://127.0.0.1:11434"
                    className="w-full bg-slate-950 border border-slate-700 text-white font-mono rounded-lg p-2 text-xs focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Model Identifier:</label>
                  <input
                    type="text"
                    value={aiSettings.localModelName}
                    onChange={(e) => updateAiSettings({ localModelName: e.target.value })}
                    placeholder="qwen2.5-vl:7b or llava:13b"
                    className="w-full bg-slate-950 border border-slate-700 text-white font-mono rounded-lg p-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={testLocalEndpoint}
                  disabled={testingEndpoint}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer border border-slate-700"
                >
                  {testingEndpoint ? 'Testing Connection...' : 'Ping Local Provider'}
                </button>
                {testResult && (
                  <span className={`text-xs ${testResult.success ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {testResult.message}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. Google Workspace Cloud Authentication */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderSync className="w-4 h-4 text-emerald-400" />
              <span>Google Workspace Cloud Connection (Drive, Sheets, Picker)</span>
            </h3>
            {googleUser ? (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                Connected
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                Not Connected
              </span>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-slate-200 block">
                {googleUser ? `Signed in as ${googleUser.displayName || googleUser.email}` : 'Sign in to access Google Drive & Google Sheets'}
              </span>
              <p className="text-[11px] text-slate-400">
                Enabled APIs: Google Drive (Files, Photos, Metadata), Google Picker, and Google Sheets.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              {googleUser ? (
                <>
                  <button
                    onClick={exportCatalogToGoogleSheets}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer"
                  >
                    Export to Sheets
                  </button>
                  <button
                    onClick={openDrivePickerForImport}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer"
                  >
                    Open Picker
                  </button>
                  <button
                    onClick={signOutWithGoogle}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs shadow flex items-center gap-2 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.41 7.34 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.25C.45 8.19 0 9.99 0 12s.45 3.81 1.25 5.4l4.03-3.13z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.59 1.25 6.6l4.03 3.13c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. Google Drive for Desktop Sync */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderSync className="w-4 h-4 text-blue-400" />
              <span>Google Drive for Desktop Paths & Sync Mode</span>
            </h3>
            <button
              onClick={detectDrivePaths}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Auto-Detect Paths</span>
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Active Base Storage Path:</label>
              <input
                type="text"
                value={driveConfig.activePath}
                onChange={(e) => updateDriveConfig({ activePath: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 font-mono text-blue-300 rounded-lg p-2.5 text-xs focus:outline-none"
              />
              <p className="text-[11px] text-slate-500">
                Generated PowerShell and Python scripts will execute moves relative to this directory.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Naming Rules & Safety */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Safety Guard & Collision Protections</span>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <span className="font-semibold text-slate-200 block">Prevent File Overwrites</span>
                <span className="text-[11px] text-slate-400">If a file name already exists, automatically append `_002`, `_003` to prevent loss</span>
              </div>
              <input
                type="checkbox"
                defaultChecked
                disabled
                className="rounded bg-slate-900 border-slate-700 text-emerald-500 w-4 h-4"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <span className="font-semibold text-slate-200 block">Generate Complete Rollback Scripts</span>
                <span className="text-[11px] text-slate-400">Every rename and move operation produces an atomic reverse rollback script</span>
              </div>
              <input
                type="checkbox"
                defaultChecked
                disabled
                className="rounded bg-slate-900 border-slate-700 text-emerald-500 w-4 h-4"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
