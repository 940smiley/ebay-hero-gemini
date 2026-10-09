import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { 
  LayoutDashboard, 
  ScanSearch, 
  FileDiff, 
  FolderTree, 
  ShoppingBag, 
  Trophy, 
  MessageSquareCode, 
  Terminal, 
  Database, 
  Settings,
  FolderGit2,
  HardDriveDownload,
  ShieldCheck,
  Plus,
  Boxes,
  Layers,
  Copy
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    items, 
    itemGroups, 
    duplicateCandidates, 
    driveConfig, 
    openDrivePickerForImport 
  } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'analyzer', label: 'Batch Photo Analyzer', icon: ScanSearch, badge: items.filter(i => i.status === 'pending').length || null },
    { id: 'grouping', label: 'Item Grouping & Roles', icon: Layers, badge: itemGroups.length || null },
    { id: 'duplicates', label: 'Duplicate Review', icon: Copy, badge: duplicateCandidates.filter(c => c.status === 'pending').length || null },
    { id: 'rename-preview', label: 'Rename & Diff Preview', icon: FileDiff, badge: items.filter(i => i.status === 'approved').length || null },
    { id: 'folder-builder', label: 'Directory Builder', icon: FolderTree, badge: null },
    { id: 'ebay-studio', label: 'eBay Listing Studio', icon: ShoppingBag, badge: items.filter(i => i.ebayDraft).length || null },
    { id: 'collectibles', label: 'Collectibles Vault', icon: Trophy, badge: null },
    { id: 'plugins', label: 'Specialty Plugins', icon: Boxes, badge: 'v1.0' },
    { id: 'ai-chat', label: 'Gemini Appraiser Chat', icon: MessageSquareCode, badge: 'AI' },
    { id: 'sync-scripts', label: 'Script & Drive Sync Hub', icon: Terminal, badge: null },
    { id: 'database-schema', label: 'Enterprise Schema (SQL)', icon: Database, badge: null },
    { id: 'settings', label: 'Settings & Local AI', icon: Settings, badge: null },
  ] as const;

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between select-none">
      <div className="py-4">
        {/* Quick Add Photos Button */}
        <div className="px-3 mb-4">
          <button
            onClick={openDrivePickerForImport}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Photos / Sources</span>
          </button>
        </div>

        <div className="px-5 mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Core Workflows
        </div>
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/25 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-amber-500 text-slate-950'
                        : item.badge === 'AI'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Local Cloud Sync Architecture box */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 m-3 rounded-xl border">
        <div className="flex items-center gap-2 mb-2">
          <FolderGit2 className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Local AI Engine Safe
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
          Bypasses Google Photos API quotas. Images reorganize locally via generated scripts and sync through Google Drive for Desktop automatically.
        </p>
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Reversible
          </span>
          <span className="flex items-center gap-1 text-blue-400">
            <HardDriveDownload className="w-3 h-3" /> {driveConfig.mode.toUpperCase()}
          </span>
        </div>
      </div>
    </aside>
  );
};
