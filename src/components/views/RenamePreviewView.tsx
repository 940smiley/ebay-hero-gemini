import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { 
  FileCheck2, 
  Check, 
  X, 
  Edit3, 
  CheckCircle2, 
  ArrowRight, 
  FolderTree, 
  Play, 
  CheckCheck, 
  Filter, 
  AlertTriangle,
  FolderSync
} from 'lucide-react';

export const RenamePreviewView: React.FC = () => {
  const { 
    items, 
    updateItem, 
    selectedIds, 
    toggleSelectId, 
    selectAll, 
    deselectAll, 
    approveSelected, 
    rejectSelected, 
    approveAll,
    executeApprovedRenamesLocally,
    driveConfig,
    setActiveTab
  } = useApp();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isExecuting, setIsExecuting] = useState(false);

  const categories = ['all', ...Array.from(new Set(items.map(i => i.analysis?.category || 'Uncategorized')))];

  const filteredItems = items.filter(i => {
    if (filterCategory === 'all') return true;
    return (i.analysis?.category || 'Uncategorized') === filterCategory;
  });

  const approvedCount = items.filter(i => i.status === 'approved').length;

  const handleStartEdit = (id: string, currentProposed: string) => {
    setEditingId(id);
    setEditedName(currentProposed);
  };

  const handleSaveEdit = (id: string) => {
    if (editedName.trim()) {
      updateItem(id, { proposedName: editedName.trim() });
    }
    setEditingId(null);
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      await executeApprovedRenamesLocally();
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Intelligent Rename & Folder Preview</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20">
              Safety Guard Active
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Zero-risk staging area. Inspect AI proposed filenames, reasoning, and folder destinations before anything touches your local disk or Google Drive.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={approveAll}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Approve All ({items.length})</span>
          </button>
          <button
            onClick={approveSelected}
            disabled={selectedIds.size === 0}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Approve Selected ({selectedIds.size})</span>
          </button>
          <button
            onClick={rejectSelected}
            disabled={selectedIds.size === 0}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-rose-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reject Selected</span>
          </button>
          <button
            onClick={handleExecute}
            disabled={approvedCount === 0 || isExecuting}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20 ml-2"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Apply Local Renames ({approvedCount})</span>
          </button>
        </div>
      </div>

      {/* Filter and selection helper */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={selectAll}
            className="text-slate-400 hover:text-white underline cursor-pointer"
          >
            Select All
          </button>
          <span className="text-slate-700">•</span>
          <button
            onClick={deselectAll}
            className="text-slate-400 hover:text-white underline cursor-pointer"
          >
            Deselect All
          </button>
          <span className="text-slate-700">•</span>
          <span className="text-slate-400">
            Selected: <strong className="text-amber-300">{selectedIds.size}</strong> of {items.length}
          </span>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400">Category:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rename Diff Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === items.length && items.length > 0}
                    onChange={(e) => (e.target.checked ? selectAll() : deselectAll())}
                    className="rounded bg-slate-900 border-slate-700 text-amber-500"
                  />
                </th>
                <th className="py-3 px-4">Item & Preview</th>
                <th className="py-3 px-4">Original Filename</th>
                <th className="py-3 px-4">Proposed Filename (Gemini Vision)</th>
                <th className="py-3 px-4">Destination Folder</th>
                <th className="py-3 px-4">Confidence & Reasoning</th>
                <th className="py-3 px-4 text-center">Status / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredItems.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const isEditing = editingId === item.id;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isSelected ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectId(item.id)}
                        className="rounded bg-slate-950 border-slate-700 text-amber-500"
                      />
                    </td>

                    {/* Preview Thumbnail */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-16 rounded-md bg-slate-950 overflow-hidden border border-slate-800 flex-shrink-0">
                          <img
                            src={item.previewUrl}
                            alt={item.originalName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                            {item.analysis?.category || 'Item'}
                          </span>
                          <p className="font-semibold text-slate-200 mt-1 truncate max-w-[150px]">
                            {item.analysis?.productName || item.originalName}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Original Filename */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-[11px] text-slate-400 break-all max-w-[200px]">
                        {item.originalName}
                      </div>
                    </td>

                    {/* Proposed Filename */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="bg-slate-950 border border-amber-500 text-amber-300 font-mono text-xs px-2 py-1 rounded w-full focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="group/edit flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] text-amber-300 font-semibold break-all">
                            {item.proposedName}
                          </span>
                          <button
                            onClick={() => handleStartEdit(item.id, item.proposedName)}
                            className="opacity-0 group-hover/edit:opacity-100 p-1 text-slate-400 hover:text-white transition-opacity cursor-pointer"
                            title="Edit manually"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Destination Folder */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-blue-300 font-mono text-[11px]">
                        <FolderTree className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        <span className="truncate max-w-[180px]">
                          {item.proposedFolder}
                        </span>
                      </div>
                    </td>

                    {/* Confidence & Reasoning */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                            <div
                              className="bg-emerald-400 h-full rounded-full"
                              style={{ width: `${item.confidence || 85}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-emerald-400 text-[10px]">
                            {item.confidence || 85}%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2" title={item.analysis?.reasoning}>
                          {item.analysis?.reasoning || 'Standard collectibles naming format applied.'}
                        </p>
                      </div>
                    </td>

                    {/* Status & Quick Action */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {item.status === 'executed' ? (
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px] border border-blue-500/30">
                            RENAMED
                          </span>
                        ) : item.status === 'approved' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                            APPROVED
                          </span>
                        ) : (
                          <button
                            onClick={() => updateItem(item.id, { status: 'approved' })}
                            className="p-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs cursor-pointer"
                            title="Approve this rename"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => updateItem(item.id, { status: 'rejected' })}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs cursor-pointer"
                          title="Reject rename"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
