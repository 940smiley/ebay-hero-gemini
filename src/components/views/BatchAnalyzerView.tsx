import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { 
  UploadCloud, 
  Play, 
  Pause, 
  RotateCcw, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  FolderSync, 
  Brain, 
  Layers,
  Trash2,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import { ImageItem } from '../../types/index.ts';

export const BatchAnalyzerView: React.FC = () => {
  const { 
    items, 
    addItems, 
    deleteItem, 
    batchProgress, 
    startBatchAnalysis, 
    pauseBatchAnalysis, 
    resumeBatchAnalysis,
    aiSettings,
    updateAiSettings,
    driveConfig,
    setSelectedItemId,
    setActiveTab,
    openDrivePickerForImport,
    exportCatalogToGoogleSheets,
    syncManifestToGoogleDrive,
    googleUser,
    signInWithGoogle
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const pendingItems = items.filter(i => i.status === 'pending');
  const analyzingItems = items.filter(i => i.status === 'analyzing');
  const completedItems = items.filter(i => i.status === 'approved' || i.status === 'executed');
  const errorItems = items.filter(i => i.status === 'error');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const validImageFiles = files.filter(f => f.type.startsWith('image/'));
    const newItems: ImageItem[] = [];

    validImageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const previewUrl = event.target?.result as string;
        const newItem: ImageItem = {
          id: `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          originalName: file.name,
          originalPath: `${driveConfig.activePath}/${file.name}`,
          fileSize: file.size,
          mimeType: file.type || 'image/jpeg',
          previewUrl,
          proposedName: file.name,
          proposedFolder: 'Inventory/Uncategorized',
          status: 'pending',
          confidence: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addItems([newItem]);
      };
      reader.readAsDataURL(file);
    });
  };

  const percentComplete = batchProgress.total > 0 
    ? Math.round((batchProgress.processed / batchProgress.total) * 100) 
    : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Batch Photo Analyzer</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
              Multimodal Vision
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Analyze 10 to 10,000+ photos with Gemini Vision. Generates intelligent names, condition notes, and folder paths with checkpoint recovery.
          </p>
        </div>

        {/* Engine Settings Toolbar */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800">
          {/* Provider Selector */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <Brain className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={aiSettings.provider}
              onChange={(e) => updateAiSettings({ provider: e.target.value as any })}
              className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer uppercase text-[11px]"
            >
              <option value="gemini" className="bg-slate-900 text-white">Google Gemini</option>
              <option value="ollama" className="bg-slate-900 text-white">Ollama Local</option>
              <option value="openai" className="bg-slate-900 text-white">OpenAI / Compatible</option>
            </select>
          </div>

          {/* Gemini Model */}
          {aiSettings.provider === 'gemini' && (
            <>
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                <select
                  value={aiSettings.geminiModel}
                  onChange={(e) => updateAiSettings({ geminiModel: e.target.value as any })}
                  className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="gemini-3.8-flash" className="bg-slate-900 text-white">Gemini 3.8 Flash (Fast & Scalable)</option>
                  <option value="gemini-3.1-pro-preview" className="bg-slate-900 text-white">Gemini 3.1 Pro (Deep Reasoning)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 px-3 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiSettings.enableThinking}
                  onChange={(e) => updateAiSettings({ enableThinking: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
                />
                <span>Thinking Mode</span>
              </label>
            </>
          )}

          {/* Local Provider Identifier */}
          {aiSettings.provider !== 'gemini' && (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 text-[10px]">Model:</span>
              <input
                type="text"
                value={aiSettings.localModelName}
                onChange={(e) => updateAiSettings({ localModelName: e.target.value })}
                placeholder="e.g. qwen2.5-vl:7b"
                className="bg-transparent text-white font-mono text-xs w-32 focus:outline-none"
              />
            </div>
          )}

          <div className="h-4 w-px bg-slate-800" />

          {batchProgress.inProgress ? (
            <button
              onClick={pauseBatchAnalysis}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Worker</span>
            </button>
          ) : batchProgress.isPaused ? (
            <button
              onClick={resumeBatchAnalysis}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume Checkpoint ({batchProgress.checkpointIndex})</span>
            </button>
          ) : (
            <button
              onClick={startBatchAnalysis}
              disabled={pendingItems.length === 0}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Analyze Pending ({pendingItems.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Checkpoint Progress Banner (if active or paused) */}
      {(batchProgress.inProgress || batchProgress.isPaused || batchProgress.processed > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${batchProgress.inProgress ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="font-bold text-white">
                Batch Job: {batchProgress.jobId}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">
                Checkpoint {batchProgress.checkpointIndex} of {batchProgress.total}
              </span>
            </div>
            <span className="font-mono text-amber-400 font-bold">{percentComplete}%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-amber-500 to-emerald-400 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${percentComplete}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>Current Item: <strong className="text-slate-200">{batchProgress.currentFilename || 'Idle'}</strong></span>
            <div className="flex items-center gap-4">
              <span className="text-emerald-400">Approved: {batchProgress.approved}</span>
              <span className="text-rose-400">Failed: {batchProgress.failed}</span>
            </div>
          </div>
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-amber-400 bg-amber-500/5 scale-[1.005]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/70'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileInput}
        />
        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto text-amber-400 border border-slate-700">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-200">
              Drag and drop collectibles photos or local folders
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Supports JPEG, PNG, WEBP, HEIC. Point directly to your Google Drive Desktop sync folder or local storage.
            </p>
          </div>
          <div className="inline-block text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            Click or drop to select files
          </div>
        </div>
      </div>

      {/* Cloud Workspace Integration Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderSync className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-white">Google Cloud Workspace Tools:</span>
          <span className="text-[11px] text-slate-400">Select files directly or sync catalog to Google Sheets</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={openDrivePickerForImport}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>Add Photos (Drive, Photos, Local)</span>
          </button>

          <button
            onClick={exportCatalogToGoogleSheets}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <span>Export to Google Sheets</span>
          </button>

          <button
            onClick={syncManifestToGoogleDrive}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Save Manifest to Drive</span>
          </button>
        </div>
      </div>

      {/* Items Filter Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-300">Catalog Items ({items.length}):</span>
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-medium">Pending: {pendingItems.length}</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-medium">Completed: {completedItems.length}</span>
          {errorItems.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 font-medium">Errors: {errorItems.length}</span>
          )}
        </div>
      </div>

      {/* Grid of photos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {items.map((item, idx) => (
          <div
            key={`${item.id}-${idx}`}
            className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all flex flex-col group relative"
          >
            {/* Image Thumbnail */}
            <div className="h-56 bg-slate-950 relative overflow-hidden flex items-center justify-center">
              <img
                src={item.previewUrl}
                alt={item.originalName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />

              {/* Status Badge */}
              <div className="absolute top-2.5 left-2.5">
                {item.status === 'analyzing' ? (
                  <span className="px-2 py-1 rounded-md bg-amber-500/90 text-slate-950 text-[10px] font-bold flex items-center gap-1 shadow-md">
                    <div className="w-2.5 h-2.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>ANALYZING</span>
                  </span>
                ) : item.status === 'approved' || item.status === 'executed' ? (
                  <span className="px-2 py-1 rounded-md bg-emerald-500/90 text-slate-950 text-[10px] font-bold flex items-center gap-1 shadow-md">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{item.status.toUpperCase()}</span>
                  </span>
                ) : item.status === 'error' ? (
                  <span className="px-2 py-1 rounded-md bg-rose-500/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                    <AlertCircle className="w-3 h-3" />
                    <span>ERROR</span>
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-md bg-slate-950/80 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                    PENDING
                  </span>
                )}
              </div>

              {/* Confidence Badge */}
              {item.confidence > 0 && (
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-emerald-400 font-mono text-[10px] font-bold">
                  {item.confidence}% Match
                </div>
              )}

              {/* Hover Quick Action Buttons */}
              <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setActiveTab('ebay-studio');
                  }}
                  className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-lg"
                  title="Open in eBay Studio"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-lg"
                  title="Remove Item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
              <div>
                <p className="text-[11px] text-slate-500 font-mono truncate" title={item.originalName}>
                  {item.originalName}
                </p>
                <h4 className="font-semibold text-xs text-slate-200 mt-1 line-clamp-2">
                  {item.proposedName || 'Awaiting Vision analysis'}
                </h4>
              </div>

              {item.analysis && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px]">
                  {item.analysis.estimatedCondition && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Condition:</span>
                      <span className="font-bold text-emerald-400 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        {item.analysis.estimatedCondition}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 truncate max-w-[120px]">
                      {item.analysis.category}
                    </span>
                    {item.analysis.estimatedMarketValueUsd && (
                      <span className="font-bold text-amber-400 font-mono">
                        ${item.analysis.estimatedMarketValueUsd.median}
                      </span>
                    )}
                  </div>

                  {item.analysis.ocrSummary && (
                    <p className="text-[10px] text-slate-500 line-clamp-1 italic font-mono">
                      OCR: {item.analysis.ocrSummary}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
