import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  RotateCw, 
  RotateCcw, 
  FlipHorizontal, 
  FlipVertical, 
  Crop, 
  Sun, 
  Contrast, 
  Sliders, 
  Rotate3d, 
  Undo2, 
  Redo2, 
  RefreshCw, 
  Layers, 
  Save, 
  Check, 
  Eye, 
  Split, 
  Sparkles,
  Maximize2
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { ImageItem, ImageEditRevision, ImageCropArea, ImageAdjustments } from '../../types/index.ts';

interface HistoryState {
  rotation: number;
  straightenAngle: number;
  flipH: boolean;
  flipV: boolean;
  crop?: ImageCropArea;
  adjustments: ImageAdjustments;
}

const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  exposure: 0,
  saturation: 0,
  sharpness: 0,
};

const ASPECT_PRESETS: Array<{ id: NonNullable<ImageCropArea['aspectPreset']>; label: string; ratio: number | null }> = [
  { id: 'free', label: 'Freeform', ratio: null },
  { id: 'card_2.5_3.5', label: 'Standard Card (2.5 : 3.5)', ratio: 2.5 / 3.5 },
  { id: 'slab', label: 'Graded Slab (3 : 5.5)', ratio: 3 / 5.5 },
  { id: '1:1', label: 'Square (1:1)', ratio: 1 },
  { id: '4:3', label: 'Standard (4:3)', ratio: 4 / 3 },
  { id: '16:9', label: 'Widescreen (16:9)', ratio: 16 / 9 },
];

export const ImageEditorModal: React.FC = () => {
  const { editingImage, setEditingImage, saveImageRevision, itemGroups, updateItemGroup } = useApp();

  if (!editingImage) return null;

  // Initial state from previous revision or defaults
  const initialRevision = editingImage.editRevision;
  const [rotation, setRotation] = useState<number>(initialRevision?.rotation || 0);
  const [straightenAngle, setStraightenAngle] = useState<number>(initialRevision?.straightenAngle || 0);
  const [flipH, setFlipH] = useState<boolean>(initialRevision?.flipH || false);
  const [flipV, setFlipV] = useState<boolean>(initialRevision?.flipV || false);
  const [crop, setCrop] = useState<ImageCropArea>(initialRevision?.crop || { x: 0, y: 0, width: 100, height: 100, aspectPreset: 'free' });
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(initialRevision?.adjustments || { ...DEFAULT_ADJUSTMENTS });

  // Compare mode
  const [compareMode, setCompareMode] = useState<'split' | 'original' | 'edited'>('edited');
  const [applyToGroup, setApplyToGroup] = useState(false);
  const [activeTab, setActiveTab] = useState<'crop' | 'adjust' | 'transform'>('crop');

  // Undo / Redo history
  const [history, setHistory] = useState<HistoryState[]>([
    {
      rotation: initialRevision?.rotation || 0,
      straightenAngle: initialRevision?.straightenAngle || 0,
      flipH: initialRevision?.flipH || false,
      flipV: initialRevision?.flipV || false,
      crop: initialRevision?.crop || { x: 0, y: 0, width: 100, height: 100, aspectPreset: 'free' },
      adjustments: initialRevision?.adjustments || { ...DEFAULT_ADJUSTMENTS },
    }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = useCallback((nextState: HistoryState) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), nextState]);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setRotation(prev.rotation);
      setStraightenAngle(prev.straightenAngle);
      setFlipH(prev.flipH);
      setFlipV(prev.flipV);
      if (prev.crop) setCrop(prev.crop);
      setAdjustments(prev.adjustments);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setRotation(next.rotation);
      setStraightenAngle(next.straightenAngle);
      setFlipH(next.flipH);
      setFlipV(next.flipV);
      if (next.crop) setCrop(next.crop);
      setAdjustments(next.adjustments);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleReset = () => {
    setRotation(0);
    setStraightenAngle(0);
    setFlipH(false);
    setFlipV(false);
    setCrop({ x: 0, y: 0, width: 100, height: 100, aspectPreset: 'free' });
    setAdjustments({ ...DEFAULT_ADJUSTMENTS });
    pushHistory({
      rotation: 0,
      straightenAngle: 0,
      flipH: false,
      flipV: false,
      crop: { x: 0, y: 0, width: 100, height: 100, aspectPreset: 'free' },
      adjustments: { ...DEFAULT_ADJUSTMENTS },
    });
  };

  const rotate90Clockwise = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    pushHistory({ rotation: nextRot, straightenAngle, flipH, flipV, crop, adjustments });
  };

  const rotate90CounterClockwise = () => {
    const nextRot = (rotation - 90 + 360) % 360;
    setRotation(nextRot);
    pushHistory({ rotation: nextRot, straightenAngle, flipH, flipV, crop, adjustments });
  };

  const toggleFlipH = () => {
    const next = !flipH;
    setFlipH(next);
    pushHistory({ rotation, straightenAngle, flipH: next, flipV, crop, adjustments });
  };

  const toggleFlipV = () => {
    const next = !flipV;
    setFlipV(next);
    pushHistory({ rotation, straightenAngle, flipH, flipV: next, crop, adjustments });
  };

  const handleAutoCropCard = () => {
    // Smart bounds detection preset for trading card border margins
    const autoCrop: ImageCropArea = {
      x: 5,
      y: 5,
      width: 90,
      height: 90,
      aspectPreset: 'card_2.5_3.5',
    };
    setCrop(autoCrop);
    pushHistory({ rotation, straightenAngle, flipH, flipV, crop: autoCrop, adjustments });
  };

  const handleSave = () => {
    const revision: ImageEditRevision = {
      id: `rev-${Date.now()}`,
      imageId: editingImage.id,
      rotation,
      straightenAngle,
      flipH,
      flipV,
      crop,
      adjustments,
      updatedAt: new Date().toISOString(),
    };

    saveImageRevision(editingImage.id, revision);

    // If batch mode is checked, apply to other photos in the group
    if (applyToGroup && editingImage.groupId) {
      const group = itemGroups.find(g => g.id === editingImage.groupId);
      if (group) {
        group.imageAssignments.forEach(a => {
          if (a.imageId !== editingImage.id) {
            saveImageRevision(a.imageId, {
              ...revision,
              id: `rev-batch-${Date.now()}-${a.imageId}`,
              imageId: a.imageId,
            });
          }
        });
      }
    }
  };

  // Build CSS transform string
  const totalRotation = rotation + straightenAngle;
  const scaleX = flipH ? -1 : 1;
  const scaleY = flipV ? -1 : 1;
  const transformStyle = `rotate(${totalRotation}deg) scale(${scaleX}, ${scaleY})`;

  // Build CSS filter string for live color adjustments
  const brightnessFilter = 100 + adjustments.brightness;
  const contrastFilter = 100 + adjustments.contrast;
  const saturateFilter = 100 + adjustments.saturation;
  const filterStyle = `brightness(${brightnessFilter}%) contrast(${contrastFilter}%) saturate(${saturateFilter}%)`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Bar */}
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <span>Nondestructive Image Editor</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                  Reversible
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-md">
                Editing: <span className="text-slate-300 font-mono">{editingImage.originalName}</span>
              </p>
            </div>
          </div>

          {/* Quick Undo / Redo & Compare Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={handleUndo}
                disabled={historyIndex === 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleReset}
                className="px-2 py-1 text-[11px] text-slate-400 hover:text-amber-400 cursor-pointer font-medium"
                title="Reset all edits to original"
              >
                Reset All
              </button>
            </div>

            {/* Compare Toggle */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setCompareMode('original')}
                className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer transition-all ${
                  compareMode === 'original' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Original
              </button>
              <button
                onClick={() => setCompareMode('edited')}
                className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer transition-all ${
                  compareMode === 'edited' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Edited
              </button>
              <button
                onClick={() => setCompareMode('split')}
                className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer transition-all ${
                  compareMode === 'split' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Side-by-Side
              </button>
            </div>

            <button
              onClick={() => setEditingImage(null)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body: Preview Stage (Center) + Tool Panels (Right) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Canvas Preview Area */}
          <div className="flex-1 bg-slate-950/90 p-8 flex items-center justify-center overflow-hidden relative">
            {compareMode === 'split' ? (
              <div className="w-full h-full grid grid-cols-2 gap-4 items-center">
                {/* Original side */}
                <div className="h-full flex flex-col items-center justify-center p-4 border border-slate-800 rounded-xl bg-slate-950/60 relative">
                  <span className="absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                    ORIGINAL
                  </span>
                  <img
                    src={editingImage.previewUrl}
                    alt="Original"
                    className="max-h-[70vh] max-w-full object-contain rounded shadow-lg"
                  />
                </div>

                {/* Edited side */}
                <div className="h-full flex flex-col items-center justify-center p-4 border border-amber-500/40 rounded-xl bg-slate-950/60 relative overflow-hidden">
                  <span className="absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold">
                    EDITED REVISION
                  </span>
                  <div className="overflow-hidden flex items-center justify-center max-h-[70vh] max-w-full">
                    <img
                      src={editingImage.previewUrl}
                      alt="Edited"
                      style={{
                        transform: transformStyle,
                        filter: filterStyle,
                        transition: 'transform 0.15s ease, filter 0.15s ease',
                      }}
                      className="max-h-[65vh] max-w-full object-contain rounded shadow-xl"
                    />
                  </div>
                </div>
              </div>
            ) : compareMode === 'original' ? (
              <div className="relative flex items-center justify-center">
                <span className="absolute top-3 left-3 text-[10px] px-2.5 py-1 rounded bg-slate-800 text-slate-200 font-bold shadow">
                  Viewing Original Unmodified File
                </span>
                <img
                  src={editingImage.previewUrl}
                  alt="Original"
                  className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl"
                />
              </div>
            ) : (
              <div className="relative flex items-center justify-center overflow-hidden">
                <div 
                  className="relative overflow-hidden rounded-xl shadow-2xl border border-slate-800"
                  style={{
                    clipPath: crop.aspectPreset !== 'free' ? 'inset(0% round 8px)' : undefined,
                  }}
                >
                  <img
                    src={editingImage.previewUrl}
                    alt="Edited Preview"
                    style={{
                      transform: transformStyle,
                      filter: filterStyle,
                      transition: 'transform 0.15s ease, filter 0.15s ease',
                    }}
                    className="max-h-[75vh] max-w-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Toolbar Panel */}
          <div className="w-80 border-l border-slate-800 bg-slate-950 flex flex-col justify-between overflow-y-auto select-none">
            <div className="p-5 space-y-6">
              
              {/* Tab Selector */}
              <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('crop')}
                  className={`py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'crop' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Crop className="w-3.5 h-3.5" />
                  <span>Crop</span>
                </button>
                <button
                  onClick={() => setActiveTab('transform')}
                  className={`py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'transform' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate</span>
                </button>
                <button
                  onClick={() => setActiveTab('adjust')}
                  className={`py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'adjust' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Color</span>
                </button>
              </div>

              {/* 1. Crop Controls */}
              {activeTab === 'crop' && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">Aspect Ratio Presets</span>
                    <button
                      onClick={handleAutoCropCard}
                      className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto-Detect Card</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {ASPECT_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          const next = { ...crop, aspectPreset: preset.id };
                          setCrop(next);
                          pushHistory({ rotation, straightenAngle, flipH, flipV, crop: next, adjustments });
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          crop.aspectPreset === preset.id
                            ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-semibold text-[11px] truncate">{preset.label}</div>
                      </button>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
                    Presets automatically frame standard trading cards, grading slabs, or e-commerce square ratios for eBay.
                  </div>
                </div>
              )}

              {/* 2. Rotate & Transform Controls */}
              {activeTab === 'transform' && (
                <div className="space-y-5 text-xs">
                  <div className="space-y-2">
                    <label className="font-bold text-slate-200">90° Rotation & Flips</label>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={rotate90CounterClockwise}
                        className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 flex flex-col items-center gap-1 border border-slate-800 cursor-pointer"
                        title="Rotate Left 90°"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span className="text-[9px]">-90°</span>
                      </button>
                      <button
                        onClick={rotate90Clockwise}
                        className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 flex flex-col items-center gap-1 border border-slate-800 cursor-pointer"
                        title="Rotate Right 90°"
                      >
                        <RotateCw className="w-4 h-4" />
                        <span className="text-[9px]">+90°</span>
                      </button>
                      <button
                        onClick={toggleFlipH}
                        className={`p-2.5 rounded-xl flex flex-col items-center gap-1 border cursor-pointer ${
                          flipH ? 'bg-amber-500/10 border-amber-500 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                        title="Flip Horizontal"
                      >
                        <FlipHorizontal className="w-4 h-4" />
                        <span className="text-[9px]">Flip H</span>
                      </button>
                      <button
                        onClick={toggleFlipV}
                        className={`p-2.5 rounded-xl flex flex-col items-center gap-1 border cursor-pointer ${
                          flipV ? 'bg-amber-500/10 border-amber-500 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                        title="Flip Vertical"
                      >
                        <FlipVertical className="w-4 h-4" />
                        <span className="text-[9px]">Flip V</span>
                      </button>
                    </div>
                  </div>

                  {/* Fine Straighten Slider */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">Fine Angle Straightening</span>
                      <span className="font-mono text-amber-400 font-bold">{straightenAngle}°</span>
                    </div>
                    <input
                      type="range"
                      min="-45"
                      max="45"
                      step="0.5"
                      value={straightenAngle}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setStraightenAngle(val);
                      }}
                      onMouseUp={() => {
                        pushHistory({ rotation, straightenAngle, flipH, flipV, crop, adjustments });
                      }}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>-45°</span>
                      <span onClick={() => setStraightenAngle(0)} className="hover:text-white cursor-pointer">0° (Reset)</span>
                      <span>+45°</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Color & Adjustments */}
              {activeTab === 'adjust' && (
                <div className="space-y-4 text-xs">
                  {/* Brightness */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300 font-semibold">Brightness</span>
                      <span className="font-mono text-amber-400">{adjustments.brightness > 0 ? `+${adjustments.brightness}` : adjustments.brightness}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={adjustments.brightness}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setAdjustments(prev => ({ ...prev, brightness: val }));
                      }}
                      onMouseUp={() => pushHistory({ rotation, straightenAngle, flipH, flipV, crop, adjustments })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Contrast */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300 font-semibold">Contrast</span>
                      <span className="font-mono text-amber-400">{adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={adjustments.contrast}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setAdjustments(prev => ({ ...prev, contrast: val }));
                      }}
                      onMouseUp={() => pushHistory({ rotation, straightenAngle, flipH, flipV, crop, adjustments })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Saturation */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300 font-semibold">Color Saturation</span>
                      <span className="font-mono text-amber-400">{adjustments.saturation > 0 ? `+${adjustments.saturation}` : adjustments.saturation}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={adjustments.saturation}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setAdjustments(prev => ({ ...prev, saturation: val }));
                      }}
                      onMouseUp={() => pushHistory({ rotation, straightenAngle, flipH, flipV, crop, adjustments })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Batch Toggle */}
              {editingImage.groupId && (
                <div className="pt-4 border-t border-slate-800/80">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={applyToGroup}
                      onChange={(e) => setApplyToGroup(e.target.checked)}
                      className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Apply edits to all photos in this group</span>
                  </label>
                </div>
              )}
            </div>

            {/* Bottom Save Action */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-2">
              <button
                onClick={() => setEditingImage(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save Revision</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
