import React, { useState, useRef, useCallback } from 'react';
import { 
  Laptop, 
  FolderOpen, 
  UploadCloud, 
  Image as ImageIcon, 
  Check, 
  AlertCircle, 
  Download, 
  RefreshCw, 
  Trash2, 
  FileCheck2, 
  Layers,
  FolderTree
} from 'lucide-react';
import { ImageItem } from '../../types/index.ts';

interface LocalFilePickerProps {
  onImportComplete: (items: ImageItem[]) => void;
  onCancel: () => void;
}

interface StagedFile {
  id: string;
  file: File;
  name: string;
  relativePath: string;
  size: number;
  type: string;
  previewUrl: string;
  error?: string;
}

const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif|tiff?|bmp|gif|cr2|nef|arw|dng)$/i;

export const LocalFilePicker: React.FC<LocalFilePickerProps> = ({ onImportComplete, onCancel }) => {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [directoryName, setDirectoryName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hidden inputs
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const addFilesToStaging = useCallback((fileList: Array<{ file: File; relativePath?: string }>) => {
    setErrorMessage(null);
    const newStaged: StagedFile[] = [];

    for (const item of fileList) {
      const file = item.file;
      const isImage = file.type.startsWith('image/') || SUPPORTED_EXTENSIONS.test(file.name);
      if (!isImage) continue;

      const previewUrl = URL.createObjectURL(file);
      const stagedId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      newStaged.push({
        id: stagedId,
        file,
        name: file.name,
        relativePath: item.relativePath || file.name,
        size: file.size,
        type: file.type || 'image/jpeg',
        previewUrl,
      });
    }

    setStagedFiles(prev => {
      const updated = [...prev, ...newStaged];
      // Select newly added files
      setSelectedIds(new Set(updated.map(f => f.id)));
      return updated;
    });
  }, []);

  // 1. Native showDirectoryPicker (supports true recursive directory traversal)
  const handlePickDirectoryNative = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        setDirectoryName(dirHandle.name);
        setIsProcessing(true);

        const collectedFiles: Array<{ file: File; relativePath: string }> = [];

        async function traverseDirectory(handle: any, currentPath: string) {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              if (file.type.startsWith('image/') || SUPPORTED_EXTENSIONS.test(file.name)) {
                collectedFiles.push({
                  file,
                  relativePath: currentPath ? `${currentPath}/${file.name}` : file.name,
                });
              }
            } else if (entry.kind === 'directory') {
              const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
              await traverseDirectory(entry, nextPath);
            }
          }
        }

        await traverseDirectory(dirHandle, dirHandle.name);
        addFilesToStaging(collectedFiles);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Directory picker error:', err);
          directoryInputRef.current?.click();
        }
      } finally {
        setIsProcessing(false);
      }
    } else {
      directoryInputRef.current?.click();
    }
  };

  // 2. Fallback webkitdirectory folder input
  const handleDirectoryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const firstPath = (files[0] as any).webkitRelativePath;
      if (firstPath) {
        setDirectoryName(firstPath.split('/')[0] || 'Selected Folder');
      }
      const list = files.map(file => ({
        file,
        relativePath: (file as any).webkitRelativePath || file.name,
      }));
      addFilesToStaging(list);
    }
  };

  // 3. Multi-file input
  const handleFilesInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).map(file => ({ file }));
      addFilesToStaging(files);
    }
  };

  // 4. Drag and Drop Handler
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    setIsProcessing(true);
    const collected: Array<{ file: File; relativePath?: string }> = [];

    // Helper for DataTransferItemList directory scanning
    async function scanEntry(entry: any, path: string = '') {
      if (entry.isFile) {
        return new Promise<void>((resolve) => {
          entry.file((file: File) => {
            if (file.type.startsWith('image/') || SUPPORTED_EXTENSIONS.test(file.name)) {
              collected.push({ file, relativePath: path ? `${path}/${file.name}` : file.name });
            }
            resolve();
          });
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        return new Promise<void>((resolve) => {
          dirReader.readEntries(async (entries: any[]) => {
            for (const sub of entries) {
              await scanEntry(sub, path ? `${path}/${entry.name}` : entry.name);
            }
            resolve();
          });
        });
      }
    }

    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (typeof item.webkitGetAsEntry === 'function') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          promises.push(scanEntry(entry));
        }
      } else {
        const file = item.getAsFile();
        if (file) collected.push({ file });
      }
    }

    await Promise.all(promises);
    setIsProcessing(false);
    addFilesToStaging(collected);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(stagedFiles.map(f => f.id)));
  };

  const handleClear = () => {
    setSelectedIds(new Set());
  };

  const handleRemoveStaged = (id: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Convert staged files to ImageItem objects and pass to onImportComplete
  const handleImport = () => {
    const selected = stagedFiles.filter(f => selectedIds.has(f.id));
    if (selected.length === 0) return;

    const imported: ImageItem[] = selected.map((staged, idx) => ({
      id: `local-${Date.now()}-${idx}`,
      originalName: staged.name,
      originalPath: staged.relativePath,
      fileSize: staged.size,
      mimeType: staged.type,
      previewUrl: staged.previewUrl,
      proposedName: staged.name,
      proposedFolder: `Inventory/${directoryName ? directoryName.replace(/[:\\\/]+/g, '_') : 'Local_Imports'}`,
      status: 'pending',
      confidence: 0,
      sourceType: 'local_folder',
      sourceLocation: directoryName || 'Local File Upload',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    onImportComplete(imported);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
      {/* Top Toolbar */}
      <div className="p-4 px-6 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePickDirectoryNative}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Choose Entire Folder (Recursive)</span>
          </button>

          <button
            onClick={() => filesInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-2 cursor-pointer"
          >
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span>Select Multiple Images</span>
          </button>

          {/* Hidden Inputs */}
          <input
            ref={directoryInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleDirectoryInputChange}
          />
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept="image/*,.cr2,.nef,.arw,.dng"
            className="hidden"
            onChange={handleFilesInputChange}
          />

          {directoryName && (
            <span className="text-slate-400 font-mono text-[11px] hidden md:inline">
              Source Directory: <strong className="text-white">{directoryName}</strong>
            </span>
          )}
        </div>

        {stagedFiles.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 font-bold border border-emerald-500/30 cursor-pointer text-xs"
            >
              Select All ({stagedFiles.length})
            </button>
            <button
              onClick={handleClear}
              className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Main Drop Area & Staged Grid */}
      <div 
        className={`flex-1 overflow-y-auto p-6 space-y-6 ${
          isDragging ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40' : ''
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isProcessing && (
          <div className="py-12 text-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
            <p className="text-xs text-slate-300">Scanning local directory structure recursively...</p>
          </div>
        )}

        {stagedFiles.length === 0 && !isProcessing ? (
          <div className="max-w-xl mx-auto py-16 text-center space-y-5">
            <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl p-10 cursor-pointer bg-slate-950/40 hover:bg-slate-950/70 transition-all group">
              <UploadCloud className="w-12 h-12 text-slate-500 group-hover:text-emerald-400 mx-auto mb-3 transition-colors" />
              <h4 className="text-base font-bold text-white">Drag & Drop Images or Folders Here</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Supports single images, batches, or full directories. Compatible with JPG, PNG, WEBP, HEIC, TIFF, BMP, and Camera RAW.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  onClick={handlePickDirectoryNative}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Browse Folder</span>
                </button>
                <button
                  onClick={() => filesInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Choose Files</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {stagedFiles.map((item) => {
              const selected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`rounded-xl border overflow-hidden p-2 bg-slate-950 cursor-pointer transition-all flex flex-col justify-between group ${
                    selected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-500/5'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="h-28 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center relative">
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${
                        selected ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-950/80 border border-slate-700 text-transparent'
                      }`}>
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 space-y-0.5 text-[11px]">
                    <p className="font-semibold text-slate-200 truncate" title={item.name}>
                      {item.name}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{(item.size / (1024 * 1024)).toFixed(1)} MB</span>
                      <span className="truncate max-w-[80px]" title={item.relativePath}>{item.relativePath}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {stagedFiles.length > 0 && (
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Selected: <strong className="text-emerald-400 font-mono text-sm">{selectedIds.size}</strong> of {stagedFiles.length} photos
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Download className="w-4 h-4 fill-current" />
              <span>Import {selectedIds.size} Photos into Queue</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
