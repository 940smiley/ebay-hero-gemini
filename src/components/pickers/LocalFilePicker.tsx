import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  FolderOpen, 
  UploadCloud, 
  Image as ImageIcon, 
  Check, 
  AlertCircle, 
  Download, 
  RefreshCw, 
  Trash2, 
  FolderTree,
  XCircle,
  FileWarning
} from 'lucide-react';
import { ImageItem } from '../../types/index.ts';
import { logger } from '../../services/logger.ts';

interface LocalFilePickerProps {
  initialMode?: 'files' | 'folder' | 'both';
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
  validationError?: string;
}

interface UploadProgress {
  total: number;
  completed: number;
  currentName: string;
  importedCount: number;
  duplicateCount: number;
  failedCount: number;
}

const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif|tiff?|bmp|gif|cr2|nef|arw|dng)$/i;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export const LocalFilePicker: React.FC<LocalFilePickerProps> = ({ 
  initialMode = 'both', 
  onImportComplete, 
  onCancel 
}) => {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [directoryName, setDirectoryName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    total: 0,
    completed: 0,
    currentName: '',
    importedCount: 0,
    duplicateCount: 0,
    failedCount: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hidden inputs & abort controller
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stagedUrlsRef = useRef<Set<string>>(new Set());

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      for (const url of stagedUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const addFilesToStaging = useCallback((fileList: Array<{ file: File; relativePath?: string }>) => {
    setErrorMessage(null);
    const newStaged: StagedFile[] = [];
    const validIdsToAdd: string[] = [];

    for (const item of fileList) {
      const file = item.file;
      const isExtSupported = SUPPORTED_EXTENSIONS.test(file.name);
      const isMimeSupported = file.type.startsWith('image/');
      
      let validationError: string | undefined;
      if (!isExtSupported && !isMimeSupported) {
        validationError = 'Unsupported format';
      } else if (file.size === 0) {
        validationError = 'Empty file (0 B)';
      } else if (file.size > MAX_FILE_SIZE) {
        validationError = 'Exceeds 100 MB limit';
      }

      const previewUrl = URL.createObjectURL(file);
      stagedUrlsRef.current.add(previewUrl);
      const stagedId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      newStaged.push({
        id: stagedId,
        file,
        name: file.name,
        relativePath: item.relativePath || file.name,
        size: file.size,
        type: file.type || 'image/jpeg',
        previewUrl,
        validationError,
      });

      if (!validationError) {
        validIdsToAdd.push(stagedId);
      }
    }

    setStagedFiles(prev => {
      const updated = [...prev, ...newStaged];
      return updated;
    });

    setSelectedIds(prev => {
      const updated = new Set(prev);
      for (const id of validIdsToAdd) {
        updated.add(id);
      }
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
          console.warn('Directory picker fallback:', err);
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
    const validIds = stagedFiles.filter(f => !f.validationError).map(f => f.id);
    setSelectedIds(new Set(validIds));
  };

  const handleClear = () => {
    setSelectedIds(new Set());
  };

  const handleRemoveStaged = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setStagedFiles(prev => {
      const item = prev.find(f => f.id === id);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        stagedUrlsRef.current.delete(item.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      logger.info('Managed Library', 'upload_cancelled', 'User cancelled local upload', {
        details: { completed: uploadProgress.completed, total: uploadProgress.total },
      });
    }
  };

  // Execute Upload with bounded concurrency (3 concurrent uploads) and persist to /api/library/upload
  const handleImport = async () => {
    const selected = stagedFiles.filter(f => selectedIds.has(f.id) && !f.validationError);
    if (selected.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);
    const opId = logger.generateId('loc-imp');
    const controller = new AbortController();
    abortControllerRef.current = controller;

    logger.info('Managed Library', 'upload_batch_start', `Starting upload of ${selected.length} local files`, {
      operationId: opId,
      details: { count: selected.length, directory: directoryName },
    });

    setUploadProgress({
      total: selected.length,
      completed: 0,
      currentName: selected[0].name,
      importedCount: 0,
      duplicateCount: 0,
      failedCount: 0,
    });

    const importedItems: ImageItem[] = [];
    const concurrency = 3;
    let nextIndex = 0;

    async function uploadWorker() {
      while (nextIndex < selected.length) {
        if (controller.signal.aborted) break;
        const index = nextIndex++;
        const staged = selected[index];

        setUploadProgress(prev => ({
          ...prev,
          currentName: staged.name,
        }));

        try {
          const dataBase64 = await fileToBase64(staged.file);
          if (controller.signal.aborted) break;

          const res = await fetch('/api/library/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-requested-with': 'ebay-hero',
              'x-operation-id': opId,
            },
            body: JSON.stringify({
              filename: staged.name,
              dataBase64,
              relativePath: staged.relativePath,
              lastModified: staged.file.lastModified,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server responded with ${res.status}`);
          }

          const result = await res.json();
          const rec = result.item;
          const isDup = Boolean(result.duplicate);

          importedItems.push({
            id: rec.id,
            originalName: rec.originalName,
            originalPath: staged.relativePath || rec.originalName,
            fileSize: rec.size,
            mimeType: rec.mimeType,
            previewUrl: rec.url, // Persistent endpoint: /api/library/:id/file
            proposedName: rec.originalName,
            proposedFolder: `Inventory/${directoryName ? directoryName.replace(/[:\\\/]+/g, '_') : 'Local_Imports'}`,
            status: 'pending',
            confidence: 0,
            sha256: rec.sha256,
            isDuplicate: isDup,
            sourceType: 'local_folder',
            sourceLocation: directoryName || staged.relativePath || 'Local Storage',
            createdAt: rec.importedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          setUploadProgress(prev => ({
            ...prev,
            completed: prev.completed + 1,
            importedCount: isDup ? prev.importedCount : prev.importedCount + 1,
            duplicateCount: isDup ? prev.duplicateCount + 1 : prev.duplicateCount,
          }));
        } catch (err: any) {
          if (controller.signal.aborted) break;
          logger.error('Managed Library', 'file_upload_error', `Failed to upload ${staged.name}: ${err.message}`, {
            operationId: opId,
            details: { filename: staged.name, error: err.message },
          });

          setUploadProgress(prev => ({
            ...prev,
            completed: prev.completed + 1,
            failedCount: prev.failedCount + 1,
          }));
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, selected.length) }, () => uploadWorker());
    await Promise.all(workers);

    setIsUploading(false);
    abortControllerRef.current = null;

    logger.info('Managed Library', 'upload_batch_complete', `Batch complete. Ingested: ${importedItems.length}`, {
      operationId: opId,
      details: {
        imported: importedItems.length,
        totalSelected: selected.length,
      },
    });

    if (importedItems.length > 0) {
      onImportComplete(importedItems);
    } else if (!controller.signal.aborted) {
      setErrorMessage('Could not import selected files. Check console or server logs for details.');
    }
  };

  const selectedFiles = stagedFiles.filter(f => selectedIds.has(f.id));
  const totalSelectedSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
      {/* Top Action Toolbar */}
      <div className="p-4 px-6 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePickDirectoryNative}
            disabled={isUploading}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-cyan-600/20 cursor-pointer"
          >
            <FolderTree className="w-4 h-4" />
            <span>Import an Entire Folder (Recursive)</span>
          </button>

          <button
            onClick={() => filesInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Import from Computer (Select Files)</span>
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
              Folder: <strong className="text-white">{directoryName}</strong>
            </span>
          )}
        </div>

        {stagedFiles.length > 0 && !isUploading && (
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-mono text-[11px]">
              Total Size: <strong className="text-emerald-400">{formatBytes(totalSelectedSize)}</strong>
            </span>
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 font-bold border border-emerald-500/30 cursor-pointer text-xs"
            >
              Select All Valid ({stagedFiles.filter(f => !f.validationError).length})
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

      {/* Uploading Progress Screen */}
      {isUploading && (
        <div className="p-8 bg-slate-950/80 border-b border-slate-800 flex flex-col items-center justify-center space-y-4">
          <div className="w-full max-w-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Ingesting to Managed Asset Library...</span>
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {uploadProgress.completed} / {uploadProgress.total} ({Math.round((uploadProgress.completed / Math.max(1, uploadProgress.total)) * 100)}%)
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${(uploadProgress.completed / Math.max(1, uploadProgress.total)) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate max-w-md font-mono text-slate-300">
                {uploadProgress.currentName}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400">Imported: {uploadProgress.importedCount}</span>
                {uploadProgress.duplicateCount > 0 && (
                  <span className="text-amber-400">Duplicates: {uploadProgress.duplicateCount}</span>
                )}
                {uploadProgress.failedCount > 0 && (
                  <span className="text-rose-400">Failed: {uploadProgress.failedCount}</span>
                )}
                <button
                  onClick={handleCancelUpload}
                  className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mx-auto" />
            <p className="text-xs text-slate-300">Scanning local directory structure recursively...</p>
          </div>
        )}

        {stagedFiles.length === 0 && !isProcessing ? (
          <div className="max-w-xl mx-auto py-16 text-center space-y-5">
            <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl p-10 cursor-pointer bg-slate-950/40 hover:bg-slate-950/70 transition-all group">
              <UploadCloud className="w-12 h-12 text-slate-500 group-hover:text-emerald-400 mx-auto mb-3 transition-colors" />
              <h4 className="text-base font-bold text-white">Drag & Drop Local Images or Folders Here</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Supports individual files, batches, or recursive directories. All photos are securely stored in the backend library.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  onClick={handlePickDirectoryNative}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderTree className="w-4 h-4" />
                  <span>Choose Entire Folder</span>
                </button>
                <button
                  onClick={() => filesInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
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
              const isInvalid = Boolean(item.validationError);

              return (
                <div
                  key={item.id}
                  onClick={() => !isInvalid && !isUploading && toggleSelect(item.id)}
                  className={`rounded-xl border overflow-hidden p-2 bg-slate-950 cursor-pointer transition-all flex flex-col justify-between group relative ${
                    isInvalid
                      ? 'border-rose-900/60 bg-rose-950/10 opacity-75'
                      : selected
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
                    
                    {/* Checkbox / Validation indicator */}
                    <div className="absolute top-2 left-2">
                      {isInvalid ? (
                        <div className="w-5 h-5 rounded bg-rose-600 text-white flex items-center justify-center shadow-md">
                          <FileWarning className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className={`w-5 h-5 rounded flex items-center justify-center ${
                          selected ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-950/80 border border-slate-700 text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    {/* Remove button */}
                    {!isUploading && (
                      <button
                        onClick={(e) => handleRemoveStaged(item.id, e)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-md bg-slate-950/80 hover:bg-rose-600 text-slate-400 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="mt-2 space-y-0.5 text-[11px]">
                    <p className="font-semibold text-slate-200 truncate" title={item.name}>
                      {item.name}
                    </p>
                    
                    {isInvalid ? (
                      <span className="text-[10px] text-rose-400 font-bold block">
                        {item.validationError}
                      </span>
                    ) : (
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{formatBytes(item.size)}</span>
                        <span className="truncate max-w-[80px]" title={item.relativePath}>{item.relativePath}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Commit Bar */}
      {stagedFiles.length > 0 && (
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Selected: <strong className="text-emerald-400 font-mono text-sm">{selectedIds.size}</strong> of {stagedFiles.length} photos ({formatBytes(totalSelectedSize)})
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              disabled={isUploading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || isUploading}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 fill-current" />
                  <span>Persist {selectedIds.size} Photos into Library</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
