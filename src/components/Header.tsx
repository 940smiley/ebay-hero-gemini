import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { 
  Sparkles, 
  FolderSync, 
  Play, 
  Download, 
  CheckCircle2, 
  Clock, 
  HardDrive,
  Brain,
  PackageCheck
} from 'lucide-react';
import JSZip from 'jszip';

export const Header: React.FC = () => {
  const { 
    items, 
    batchProgress, 
    startBatchAnalysis, 
    aiSettings, 
    driveConfig,
    generateScripts,
    setActiveTab,
    googleUser,
    isGoogleSigningIn,
    signInWithGoogle,
    signOutWithGoogle,
    exportCatalogToGoogleSheets,
    openDrivePickerForImport,
  } = useApp();

  const [isExporting, setIsExporting] = useState(false);

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const approvedCount = items.filter(i => i.status === 'approved' || i.status === 'executed').length;

  const handleExportZip = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const scripts = await generateScripts();

      if (scripts) {
        zip.file("reorganize_drive.ps1", scripts.powershell);
        zip.file("reorganize_drive.sh", scripts.bash);
        zip.file("reorganize_drive.py", scripts.python);
        zip.file("reorganize_drive.bat", scripts.batch);
        zip.file("rollback.ps1", scripts.rollbackPowershell);
        zip.file("rollback.sh", scripts.rollbackBash);
        zip.file("rename_log.json", scripts.renameLogJson);
        zip.file("rollback_log.json", scripts.rollbackLogJson);
        zip.file("audit_log.json", scripts.auditLogJson);
      }

      // Add eBay CSV / JSON manifest
      const ebayDrafts = items
        .filter(i => i.ebayDraft)
        .map(i => ({
          filename: i.proposedName,
          ...i.ebayDraft
        }));
      zip.file("ebay_listings_manifest.json", JSON.stringify(ebayDrafts, null, 2));

      // README instructions
      const readme = `# eBay Hero Gemini Edition - Export Package
Generated: ${new Date().toISOString()}
Target Root: ${driveConfig.activePath}

INSTRUCTIONS:
1. Windows (Google Drive Stream / Mirror):
   Right click 'reorganize_drive.ps1' -> Run with PowerShell
   Or run 'reorganize_drive.bat'

2. macOS / Linux:
   chmod +x reorganize_drive.sh
   ./reorganize_drive.sh

3. Python:
   python3 reorganize_drive.py

All actions maintain an audit log in 'rename_log.json' and are 100% reversible via 'rollback.ps1'.
`;
      zip.file("README_SYNC_GUIDE.txt", readme);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ebay_hero_sync_package_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export ZIP error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 p-[1.5px] shadow-lg shadow-amber-500/10">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              <span>eBay Hero</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-300 font-semibold border border-amber-500/30">
                Gemini Edition
              </span>
            </h1>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            AI Collectibles, Photo Rename & E-Commerce Listing Suite
          </p>
        </div>
      </div>

      {/* Center status badges */}
      <div className="hidden lg:flex items-center gap-4">
        {/* Google Drive Status */}
        <div 
          onClick={() => setActiveTab('settings')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 hover:border-slate-600 cursor-pointer transition-all"
        >
          <FolderSync className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400">Drive for Desktop:</span>
          <span className="font-mono text-blue-300 font-medium truncate max-w-[150px]">
            {driveConfig.activePath || driveConfig.detectedPath}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded uppercase font-semibold">
            {driveConfig.mode}
          </span>
        </div>

        {/* AI Model Badge */}
        <div 
          onClick={() => setActiveTab('settings')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 hover:border-slate-600 cursor-pointer transition-all"
        >
          <Brain className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-400">Engine:</span>
          <span className="text-amber-300 font-medium">{aiSettings.geminiModel}</span>
          {aiSettings.enableThinking && (
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded uppercase font-bold tracking-wider">
              Thinking
            </span>
          )}
        </div>

        {/* Inventory Counts */}
        <div className="flex items-center gap-3 text-xs bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-300">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>Total: <strong>{items.length}</strong></span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Ready: <strong>{approvedCount}</strong></span>
          </div>
          {pendingCount > 0 && (
            <>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5 text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Queued: <strong>{pendingCount}</strong></span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2.5">
        {/* Google Workspace Account button */}
        {googleUser ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-xs">
            {googleUser.photoURL ? (
              <img src={googleUser.photoURL} alt="Profile" className="w-5 h-5 rounded-full" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-blue-600 text-[10px] flex items-center justify-center font-bold text-white">
                G
              </div>
            )}
            <span className="text-slate-300 font-medium truncate max-w-[120px] text-[11px]" title={googleUser.email || ''}>
              {googleUser.displayName || googleUser.email?.split('@')[0]}
            </span>
            <button
              onClick={exportCatalogToGoogleSheets}
              className="text-emerald-400 hover:text-emerald-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer ml-1"
              title="Sync catalog to Google Sheets"
            >
              Sheets
            </button>
            <button
              onClick={signOutWithGoogle}
              className="text-slate-500 hover:text-slate-300 text-[10px] ml-1 cursor-pointer"
              title="Sign Out"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={signInWithGoogle}
            disabled={isGoogleSigningIn}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 font-medium text-xs shadow transition-all cursor-pointer border border-slate-200"
            title="Sign in with Google to use Drive & Sheets"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.41 7.34 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.25C.45 8.19 0 9.99 0 12s.45 3.81 1.25 5.4l4.03-3.13z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.59 1.25 6.6l4.03 3.13c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            <span>{isGoogleSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
          </button>
        )}

        <button
          onClick={openDrivePickerForImport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          title="Add Photos from Google Drive, Google Photos, or Local Computer"
        >
          <FolderSync className="w-3.5 h-3.5" />
          <span>Add Photos</span>
        </button>

        <button
          onClick={startBatchAnalysis}
          disabled={batchProgress.inProgress || pendingCount === 0}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {batchProgress.inProgress ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Analyzing ({batchProgress.processed}/{batchProgress.total})</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Gemini Vision ({pendingCount})</span>
            </>
          )}
        </button>

        <button
          onClick={handleExportZip}
          disabled={isExporting || items.length === 0}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-all disabled:opacity-50 cursor-pointer"
          title="Export scripts, rename log, and eBay listings as ZIP package"
        >
          <Download className="w-3.5 h-3.5 text-slate-300" />
          <span>{isExporting ? 'Packaging...' : 'Export Scripts'}</span>
        </button>
      </div>
    </header>
  );
};
