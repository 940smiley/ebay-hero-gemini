import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { 
  Sparkles, 
  FolderSync, 
  Trophy, 
  FileCheck2, 
  ArrowUpRight, 
  Coins, 
  HardDrive, 
  ShieldAlert, 
  CheckCircle,
  FileCode2,
  RefreshCw,
  PlusCircle
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { 
    items, 
    startBatchAnalysis, 
    batchProgress, 
    driveConfig, 
    auditLogs, 
    loadSampleItems, 
    setActiveTab, 
    setSelectedItemId,
    exportCatalogToGoogleSheets,
    openDrivePickerForImport
  } = useApp();

  const totalValue = items.reduce((acc, item) => {
    return acc + (item.analysis?.estimatedMarketValueUsd?.median || 0);
  }, 0);

  const pendingItems = items.filter(i => i.status === 'pending');
  const approvedItems = items.filter(i => i.status === 'approved' || i.status === 'executed');
  const draftsCount = items.filter(i => i.ebayDraft).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-8 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI-Driven Collectibles & E-Commerce Automation</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Streamline 10,000+ Collectibles Photos Directly to eBay
          </h2>
          <p className="mt-3 text-slate-300 text-sm leading-relaxed">
            Overcomes Google Photos API restrictions by reading local Google Drive synced directories, running multimodal Gemini Vision, generating clean filenames and folder structures, and exporting atomic PowerShell/Python move scripts.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('analyzer')}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Import Photos & Analyze</span>
            </button>
            <button
              onClick={() => setActiveTab('rename-preview')}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <span>Review Renames ({approvedItems.length})</span>
            </button>
            <button
              onClick={exportCatalogToGoogleSheets}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <FolderSync className="w-4 h-4" />
              <span>Sync to Google Sheets</span>
            </button>
            <button
              onClick={openDrivePickerForImport}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-600/20"
            >
              <HardDrive className="w-4 h-4" />
              <span>Add Photos & Import Sources</span>
            </button>
            <button
              onClick={loadSampleItems}
              className="px-4 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Sample Inventory</span>
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Cataloged</span>
            <HardDrive className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{items.length}</span>
            <span className="text-xs text-slate-500">items</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span className="text-emerald-400 font-semibold">{approvedItems.length}</span> approved for local rename
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Estimated Vault Value</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-300">
              ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-slate-500">USD</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Median market comp pricing via Gemini Vision
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>eBay Listings Ready</span>
            <Trophy className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{draftsCount}</span>
            <span className="text-xs text-slate-500">drafts</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Strict 80-char titles, specs, & HTML templates
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Google Drive Sync</span>
            <FolderSync className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold text-white truncate max-w-[200px]">
              {driveConfig.mode === 'stream' ? 'Stream Mode' : 'Mirror Mode'}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-mono text-emerald-400/90 truncate">
            {driveConfig.activePath}
          </p>
        </div>
      </div>

      {/* Main split sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Recent Items Table / Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Catalog & Inspection Queue</span>
              <span className="text-xs font-normal text-slate-500">({items.length} items)</span>
            </h3>
            <button 
              onClick={() => setActiveTab('rename-preview')}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>View full diff table</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div 
                key={`${item.id}-${idx}`}
                onClick={() => {
                  setSelectedItemId(item.id);
                  setActiveTab('ebay-studio');
                }}
                className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all flex items-center gap-4 cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className="w-16 h-20 rounded-lg bg-slate-950 overflow-hidden border border-slate-800 flex-shrink-0 relative">
                  <img src={item.previewUrl} alt={item.originalName} className="w-full h-full object-cover" />
                  {item.analysis?.estimatedCondition && (
                    <span className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[8px] text-center text-amber-300 font-bold py-0.5 truncate">
                      {item.analysis.estimatedCondition.split(' ')[0]}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                      {item.analysis?.category || 'Collectibles'}
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400 truncate">
                      {item.analysis?.subcategory || 'Item'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-auto ${
                      item.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      item.status === 'executed' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                      'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {item.status.toUpperCase()}
                    </span>
                  </div>

                  <h4 className="font-semibold text-sm text-slate-200 mt-1 truncate group-hover:text-amber-300 transition-colors">
                    {item.ebayDraft?.title || item.proposedName}
                  </h4>

                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span className="font-mono text-[11px] text-slate-500 truncate max-w-[260px]">
                      {item.originalName}
                    </span>
                    {item.analysis?.estimatedMarketValueUsd?.median && (
                      <span className="font-bold text-amber-400">
                        ${item.analysis.estimatedMarketValueUsd.median} USD
                      </span>
                    )}
                    {item.confidence && (
                      <span className="text-emerald-400 text-[11px]">
                        {item.confidence}% Match
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Quick Scripts & Audit Activity */}
        <div className="space-y-6">
          {/* Quick Script Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-amber-400" />
                <span>Script & Sync Engine</span>
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Ready
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export fully executable scripts configured for your Google Drive Desktop folder. Scripts perform safe moves, handle name collisions, and generate rollback logs.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setActiveTab('sync-scripts')}
                className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 text-center transition-all cursor-pointer border border-slate-700"
              >
                PowerShell (.ps1)
              </button>
              <button
                onClick={() => setActiveTab('sync-scripts')}
                className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 text-center transition-all cursor-pointer border border-slate-700"
              >
                Python 3 (.py)
              </button>
              <button
                onClick={() => setActiveTab('sync-scripts')}
                className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 text-center transition-all cursor-pointer border border-slate-700"
              >
                Bash Shell (.sh)
              </button>
              <button
                onClick={() => setActiveTab('sync-scripts')}
                className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 text-center transition-all cursor-pointer border border-slate-700"
              >
                Windows Batch (.bat)
              </button>
            </div>
          </div>

          {/* Forensic Audit Log Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Audit Trail (Reversible)</span>
            </h3>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500">No actions logged yet.</p>
              ) : (
                auditLogs.slice(0, 6).map((log, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                        {log.action}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-amber-300 truncate">
                      {log.newName}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Via: {log.performedBy}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
