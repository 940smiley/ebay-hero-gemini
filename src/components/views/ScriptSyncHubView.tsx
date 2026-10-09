import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { 
  Terminal, 
  FolderSync, 
  Copy, 
  Check, 
  Download, 
  RotateCcw, 
  ShieldCheck, 
  FileCode, 
  HardDrive, 
  ExternalLink,
  Info
} from 'lucide-react';

export const ScriptSyncHubView: React.FC = () => {
  const { 
    scriptBundle, 
    generateScripts, 
    driveConfig, 
    updateDriveConfig, 
    detectDrivePaths,
    items,
    auditLogs
  } = useApp();

  const [activeScriptTab, setActiveScriptTab] = useState<'powershell' | 'python' | 'bash' | 'batch' | 'rollback' | 'logs'>('powershell');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!scriptBundle && items.length > 0) {
      generateScripts();
    }
  }, [items, scriptBundle, generateScripts]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generateScripts();
    } finally {
      setIsGenerating(false);
    }
  };

  const getActiveContent = () => {
    if (!scriptBundle) return '# Generating scripts... Please click "Re-generate Scripts"';
    switch (activeScriptTab) {
      case 'powershell':
        return scriptBundle.powershell;
      case 'python':
        return scriptBundle.python;
      case 'bash':
        return scriptBundle.bash;
      case 'batch':
        return scriptBundle.batch;
      case 'rollback':
        return scriptBundle.rollbackPowershell;
      case 'logs':
        return scriptBundle.auditLogJson;
      default:
        return scriptBundle.powershell;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const content = getActiveContent();
    let filename = 'reorganize_drive.ps1';
    let mime = 'text/plain';

    if (activeScriptTab === 'python') filename = 'reorganize_drive.py';
    else if (activeScriptTab === 'bash') filename = 'reorganize_drive.sh';
    else if (activeScriptTab === 'batch') filename = 'reorganize_drive.bat';
    else if (activeScriptTab === 'rollback') filename = 'rollback.ps1';
    else if (activeScriptTab === 'logs') {
      filename = 'audit_log.json';
      mime = 'application/json';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Script & Drive Sync Hub</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20">
              Zero-Quota Bypass
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Reorganize thousands of collectibles images locally on your machine. Google Drive for Desktop automatically syncs changes to the cloud.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>{isGenerating ? 'Synthesizing...' : 'Re-generate Scripts'}</span>
          </button>
        </div>
      </div>

      {/* Google Drive Configuration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FolderSync className="w-4 h-4 text-blue-400" />
            <span>Google Drive for Desktop Environment Detection</span>
          </h3>
          <button
            onClick={detectDrivePaths}
            className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer underline"
          >
            Re-detect Environment
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Stream Mode */}
          <div
            onClick={() => updateDriveConfig({ mode: 'stream', activePath: 'G:\\My Drive' })}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              driveConfig.mode === 'stream'
                ? 'border-blue-500 bg-blue-500/10 text-white'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between font-bold mb-1">
              <span>Stream Mode (Virtual G:\ Drive)</span>
              {driveConfig.mode === 'stream' && <Check className="w-4 h-4 text-blue-400" />}
            </div>
            <p className="text-[11px] text-slate-400">
              Files stored in Google Cloud and streamed on-demand. Standard default for Windows Google Drive app.
            </p>
            <p className="font-mono text-[10px] text-blue-300 mt-2 truncate">
              Path: G:\My Drive
            </p>
          </div>

          {/* Mirror Mode */}
          <div
            onClick={() => updateDriveConfig({ mode: 'mirror', activePath: 'C:\\Users\\Seller\\My Drive' })}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              driveConfig.mode === 'mirror'
                ? 'border-blue-500 bg-blue-500/10 text-white'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between font-bold mb-1">
              <span>Mirror Mode (Local Folder)</span>
              {driveConfig.mode === 'mirror' && <Check className="w-4 h-4 text-blue-400" />}
            </div>
            <p className="text-[11px] text-slate-400">
              Full 1:1 duplicate mirrored locally on your physical disk.
            </p>
            <p className="font-mono text-[10px] text-blue-300 mt-2 truncate">
              Path: C:\Users\USERNAME\My Drive
            </p>
          </div>

          {/* Custom Path */}
          <div
            onClick={() => updateDriveConfig({ mode: 'custom' })}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              driveConfig.mode === 'custom'
                ? 'border-blue-500 bg-blue-500/10 text-white'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between font-bold mb-1">
              <span>Custom Local Directory</span>
              {driveConfig.mode === 'custom' && <Check className="w-4 h-4 text-blue-400" />}
            </div>
            <p className="text-[11px] text-slate-400">
              Specify custom external SSD, network share, or photo staging folder.
            </p>
            <input
              type="text"
              value={driveConfig.activePath}
              onChange={(e) => updateDriveConfig({ activePath: e.target.value })}
              className="mt-2 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white font-mono focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Script Viewer Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Navigation Tabs */}
        <div className="bg-slate-950/90 px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            {[
              { id: 'powershell', label: 'PowerShell (.ps1)' },
              { id: 'python', label: 'Python 3 (.py)' },
              { id: 'bash', label: 'Unix Shell (.sh)' },
              { id: 'batch', label: 'Windows Batch (.bat)' },
              { id: 'rollback', label: 'Rollback Script' },
              { id: 'logs', label: 'Audit Manifest (JSON)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveScriptTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  activeScriptTab === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Script'}</span>
            </button>
            <button
              onClick={handleDownloadSingle}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>

        {/* Script Code Viewer */}
        <div className="p-6 bg-slate-950 overflow-x-auto">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed max-h-[500px]">
            {getActiveContent()}
          </pre>
        </div>
      </div>
    </div>
  );
};
