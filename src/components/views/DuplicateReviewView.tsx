import React, { useState } from 'react';
import { 
  Copy, 
  RefreshCw, 
  Check, 
  Trash2, 
  ExternalLink, 
  Split, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  GitMerge, 
  Layers, 
  Eye, 
  Filter, 
  Image as ImageIcon 
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { DuplicateCandidate, ImageItem } from '../../types/index.ts';

export const DuplicateReviewView: React.FC = () => {
  const { 
    items, 
    duplicateCandidates, 
    refreshDuplicates, 
    resolveDuplicateCandidate, 
    setEditingImage 
  } = useApp();

  const [filterType, setFilterType] = useState<'all' | 'exact' | 'visual' | 'pending' | 'resolved'>('pending');

  const filteredCandidates = duplicateCandidates.filter(c => {
    if (filterType === 'pending') return c.status === 'pending';
    if (filterType === 'resolved') return c.status !== 'pending';
    if (filterType === 'exact') return c.matchType === 'exact_sha256';
    if (filterType === 'visual') return c.matchType === 'visual_phash' || c.matchType === 'catalog_copy';
    return true;
  });

  const pendingCount = duplicateCandidates.filter(c => c.status === 'pending').length;
  const exactCount = duplicateCandidates.filter(c => c.matchType === 'exact_sha256').length;
  const visualCount = duplicateCandidates.filter(c => c.matchType === 'visual_phash').length;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <span>Smart Deduplication & Similarity Review</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                  {pendingCount} Pending Review
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Identify exact SHA-256 byte duplicates and perceptual hash (pHash) visual similarities across your imported images.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={refreshDuplicates}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer border border-slate-700 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Rescan All Images</span>
        </button>
      </div>

      {/* Stats Summary Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold">Exact File Duplicates</span>
            <div className="text-xl font-black text-rose-400 font-mono">{exactCount}</div>
            <p className="text-[11px] text-slate-500">Identical byte hash (SHA-256)</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
            <Copy className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold">Visual Similarity Matches</span>
            <div className="text-xl font-black text-amber-400 font-mono">{visualCount}</div>
            <p className="text-[11px] text-slate-500">Perceptual hash (pHash) Hamming distance</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Eye className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold">Catalog vs Physical Distinction</span>
            <div className="text-xl font-black text-emerald-400 font-mono">Active</div>
            <p className="text-[11px] text-slate-500">Preserves distinct collectible grades</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 text-xs">
        <button
          onClick={() => setFilterType('pending')}
          className={`px-3.5 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
            filterType === 'pending'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          Pending Review ({pendingCount})
        </button>

        <button
          onClick={() => setFilterType('exact')}
          className={`px-3.5 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
            filterType === 'exact'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          Exact File Hashes ({exactCount})
        </button>

        <button
          onClick={() => setFilterType('visual')}
          className={`px-3.5 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
            filterType === 'visual'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          Visual Similarities ({visualCount})
        </button>

        <button
          onClick={() => setFilterType('all')}
          className={`px-3.5 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
            filterType === 'all'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          All ({duplicateCandidates.length})
        </button>

        <button
          onClick={() => setFilterType('resolved')}
          className={`px-3.5 py-1.5 rounded-lg font-bold cursor-pointer transition-all ml-auto ${
            filterType === 'resolved'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          Resolved ({duplicateCandidates.filter(c => c.status !== 'pending').length})
        </button>
      </div>

      {/* Comparison Cards List */}
      {filteredCandidates.length === 0 ? (
        <div className="p-16 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h4 className="font-bold text-white text-base">No Duplicate Candidates In This View</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Your image library has no unresolved duplicates matching this filter.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredCandidates.map(candidate => {
            const orig = items.find(i => i.id === candidate.originalImageId);
            const dup = items.find(i => i.id === candidate.duplicateImageId);

            if (!orig || !dup) return null;

            const isExact = candidate.matchType === 'exact_sha256';
            const isResolved = candidate.status !== 'pending';

            return (
              <div
                key={candidate.id}
                className={`rounded-2xl border bg-slate-950 overflow-hidden shadow-xl transition-all ${
                  isResolved ? 'border-slate-800 opacity-60' : 'border-slate-700 hover:border-amber-500/40'
                }`}
              >
                {/* Match Banner Header */}
                <div className="p-3.5 px-6 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                      isExact 
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {isExact ? 'Exact SHA-256 Match (100%)' : `Visual Similarity (${candidate.similarityScore}%)`}
                    </span>

                    {candidate.hammingDistance !== undefined && (
                      <span className="text-slate-400 font-mono text-[11px]">
                        Hamming Distance: {candidate.hammingDistance} / 64 bits
                      </span>
                    )}
                  </div>

                  {isResolved && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold uppercase">
                      Status: {candidate.status.replace('resolved_', '')}
                    </span>
                  )}
                </div>

                {/* Side-by-Side Comparison Grid */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Original Image */}
                  <div className="space-y-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Image A (Original)
                      </span>
                      <button
                        onClick={() => setEditingImage(orig)}
                        className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                      >
                        Inspect / Edit
                      </button>
                    </div>

                    <div className="h-48 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center">
                      <img 
                        src={orig.previewUrl} 
                        alt={orig.originalName} 
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-white truncate" title={orig.originalName}>
                        {orig.originalName}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 font-mono">
                        <div>Size: {(orig.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                        <div>Type: {orig.mimeType}</div>
                        <div className="truncate" title={orig.originalPath}>Path: {orig.originalPath}</div>
                        <div>Source: {orig.sourceType || 'Local Library'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Duplicate Candidate */}
                  <div className="space-y-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Image B (Duplicate Candidate)
                      </span>
                      <button
                        onClick={() => setEditingImage(dup)}
                        className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                      >
                        Inspect / Edit
                      </button>
                    </div>

                    <div className="h-48 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center">
                      <img 
                        src={dup.previewUrl} 
                        alt={dup.originalName} 
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-white truncate" title={dup.originalName}>
                        {dup.originalName}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 font-mono">
                        <div>Size: {(dup.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                        <div>Type: {dup.mimeType}</div>
                        <div className="truncate" title={dup.originalPath}>Path: {dup.originalPath}</div>
                        <div>Source: {dup.sourceType || 'Local Library'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resolution Action Footer */}
                {!isResolved && (
                  <div className="p-4 px-6 border-t border-slate-800 bg-slate-900/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-slate-400">
                      Choose resolution strategy:
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => resolveDuplicateCandidate(candidate.id, 'merge')}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                        title="Merge references into Image A and safely remove Image B"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        <span>Merge References (Keep A)</span>
                      </button>

                      <button
                        onClick={() => resolveDuplicateCandidate(candidate.id, 'assign_view')}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                        title="Attach Image B as a detail/alternate angle of the item"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Assign as Alternate Angle</span>
                      </button>

                      <button
                        onClick={() => resolveDuplicateCandidate(candidate.id, 'keep_both')}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-all"
                        title="Flag as distinct physical copies (different cards/grades)"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Keep Both (Distinct Items)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
