import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Folder, 
  FolderOpen, 
  HardDrive, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Check, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  Layers, 
  Users, 
  Share2, 
  CheckCheck, 
  Sliders, 
  X,
  FileQuestion,
  CornerDownRight,
  ShieldAlert
} from 'lucide-react';
import { apiRequest, streamNdjson } from '../../services/api.ts';
import { 
  SelectionState, 
  SelectionScope, 
  emptySelection, 
  makeScope, 
  addScope, 
  removeScope, 
  toggleItem, 
  isSelected, 
  clearSelection, 
  serialize 
} from '../../lib/selection.ts';
import { ImageItem } from '../../types/index.ts';

interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
  driveId?: string;
  isShortcut: boolean;
  modifiedTime?: string;
}

interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  hasThumbnail: boolean;
  supported: boolean;
  isShortcut: boolean;
}

interface SelectionSummary {
  files: number;
  folders: number;
  totalBytes: number;
  bytesUnknownFiles: number;
  unsupported: number;
  duplicates: number;
  truncated: boolean;
}

interface GoogleDrivePickerProps {
  onImportComplete: (items: ImageItem[]) => void;
  onCancel: () => void;
}

export const GoogleDrivePicker: React.FC<GoogleDrivePickerProps> = ({ onImportComplete, onCancel }) => {
  // Navigation State
  const [scope, setScope] = useState<'my_drive' | 'shared_drives' | 'shared_with_me'>('my_drive');
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [currentFolderName, setCurrentFolderName] = useState<string>('My Drive');
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([
    { id: 'root', name: 'My Drive' }
  ]);
  const [sharedDrives, setSharedDrives] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSharedDriveId, setSelectedSharedDriveId] = useState<string | undefined>();

  // Folder Listing State
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [images, setImages] = useState<DriveImage[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection Model State
  const [selection, setSelection] = useState<SelectionState>(emptySelection());
  const [summary, setSummary] = useState<SelectionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; currentName: string }>({
    current: 0,
    total: 0,
    currentName: '',
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch Shared Drives when scope changes
  useEffect(() => {
    if (scope === 'shared_drives') {
      apiRequest<{ drives: Array<{ id: string; name: string }> }>('/api/google/drive/shared-drives')
        .then(res => {
          setSharedDrives(res.drives || []);
          if (res.drives.length > 0 && !selectedSharedDriveId) {
            setSelectedSharedDriveId(res.drives[0].id);
            setCurrentFolderId(res.drives[0].id);
            setCurrentFolderName(res.drives[0].name);
            setBreadcrumbs([{ id: res.drives[0].id, name: res.drives[0].name }]);
          }
        })
        .catch(err => setError(err.message));
    }
  }, [scope]);

  // Load Folder Contents
  const loadFolder = useCallback(async (isLoadMore: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      p.set('scope', scope);
      if (currentFolderId && currentFolderId !== 'root') p.set('folderId', currentFolderId);
      if (selectedSharedDriveId) p.set('driveId', selectedSharedDriveId);
      if (searchQuery.trim()) p.set('search', searchQuery.trim());
      if (isLoadMore && nextPageToken) p.set('pageToken', nextPageToken);

      const data = await apiRequest<{
        folders: DriveFolder[];
        images: DriveImage[];
        nextPageToken?: string;
        skippedNonImage: number;
      }>(`/api/google/drive/list?${p.toString()}`);

      if (isLoadMore) {
        setFolders(prev => [...prev, ...data.folders]);
        setImages(prev => [...prev, ...data.images]);
      } else {
        setFolders(data.folders);
        setImages(data.images);
      }
      setNextPageToken(data.nextPageToken);
    } catch (err: any) {
      setError(err.message || 'Failed to list Drive files');
    } finally {
      setLoading(false);
    }
  }, [scope, currentFolderId, selectedSharedDriveId, searchQuery, nextPageToken]);

  useEffect(() => {
    loadFolder(false);
  }, [scope, currentFolderId, selectedSharedDriveId, searchQuery]);

  // Fetch Real Selection Summary from Server whenever selection changes
  useEffect(() => {
    const serialized = serialize(selection);
    if (serialized.scopes.length === 0 && serialized.included.length === 0) {
      setSummary(null);
      return;
    }

    setSummaryLoading(true);
    const timeout = setTimeout(() => {
      apiRequest<SelectionSummary>('/api/google/drive/selection/summary', {
        method: 'POST',
        body: JSON.stringify(serialized),
      })
        .then(res => setSummary(res))
        .catch(err => console.warn('Could not compute selection summary:', err))
        .finally(() => setSummaryLoading(false));
    }, 250);

    return () => clearTimeout(timeout);
  }, [selection]);

  // Folder Navigation Handlers
  const navigateToFolder = (fId: string, fName: string) => {
    setCurrentFolderId(fId);
    setCurrentFolderName(fName);
    setBreadcrumbs(prev => [...prev, { id: fId, name: fName }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setCurrentFolderId(target.id);
    setCurrentFolderName(target.name);
  };

  // Selection Actions
  const currentPathArray = breadcrumbs.map(b => b.id);

  const handleToggleFile = (img: DriveImage) => {
    setSelection(prev => toggleItem(prev, { id: img.id, path: currentPathArray }));
  };

  const handleSelectCurrentFolderDirect = () => {
    const newScope = makeScope({
      source: 'google_drive',
      folderId: currentFolderId,
      driveId: selectedSharedDriveId,
      recursive: false,
      label: currentFolderName,
    });
    setSelection(prev => addScope(prev, newScope));
  };

  const handleSelectCurrentFolderRecursive = () => {
    const newScope = makeScope({
      source: 'google_drive',
      folderId: currentFolderId,
      driveId: selectedSharedDriveId,
      recursive: true,
      label: `${currentFolderName} (recursive)`,
    });
    setSelection(prev => addScope(prev, newScope));
  };

  const handleRemoveScope = (key: string) => {
    setSelection(prev => removeScope(prev, key));
  };

  // Execution: Start Streaming Import
  const handleExecuteImport = async () => {
    setIsImporting(true);
    const importedItems: ImageItem[] = [];
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    try {
      await streamNdjson(
        '/api/google/drive/import',
        serialize(selection),
        (event) => {
          if (event.type === 'start') {
            setImportProgress({ current: 0, total: summary?.files || 0, currentName: 'Starting import...' });
          } else if (event.type === 'item') {
            setImportProgress(prev => ({
              ...prev,
              current: prev.current + 1,
              currentName: event.item.originalName,
            }));
            importedItems.push({
              id: `drive-${event.item.id}`,
              originalName: event.item.originalName,
              originalPath: `Google Drive/${event.folderPath || 'My Drive'}/${event.item.originalName}`,
              fileSize: event.item.size,
              mimeType: event.item.mimeType,
              previewUrl: event.item.url,
              proposedName: event.item.originalName,
              proposedFolder: `Inventory/${event.folderPath || 'Google Drive'}`,
              status: 'pending',
              confidence: 0,
              sourceType: 'google_drive',
              sourceLocation: event.folderPath || 'Google Drive',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else if (event.type === 'error') {
            console.warn('Import item error:', event);
          } else if (event.type === 'done') {
            onImportComplete(importedItems);
          }
        },
        abortCtrl.signal
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(`Import failed: ${err.message}`);
      }
    } finally {
      setIsImporting(false);
      abortControllerRef.current = null;
    }
  };

  const cancelImport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
      {/* Top Scope Tabs */}
      <div className="p-3 px-6 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {[
            { id: 'my_drive', label: 'My Drive', icon: HardDrive },
            { id: 'shared_drives', label: 'Shared Drives', icon: Users },
            { id: 'shared_with_me', label: 'Shared With Me', icon: Share2 },
          ].map((t) => {
            const Icon = t.icon;
            const active = scope === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setScope(t.id as any);
                  setCurrentFolderId('root');
                  setCurrentFolderName(t.label);
                  setBreadcrumbs([{ id: 'root', name: t.label }]);
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold cursor-pointer transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live Drive Search */}
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Drive images..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Breadcrumb Bar & Folder Selection Actions */}
      <div className="p-3 px-6 bg-slate-950/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 font-mono text-[11px]">
          {breadcrumbs.map((b, idx) => (
            <React.Fragment key={b.id}>
              {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
              <button
                onClick={() => navigateToBreadcrumb(idx)}
                className={`px-2 py-1 rounded hover:bg-slate-800 cursor-pointer transition-colors ${
                  idx === breadcrumbs.length - 1 ? 'text-blue-400 font-bold bg-blue-500/10' : 'text-slate-400'
                }`}
              >
                {b.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Folder Scope Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectCurrentFolderDirect}
            className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/30 flex items-center gap-1.5 cursor-pointer"
            title="Select all image files directly in this folder"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Select All in Folder</span>
          </button>

          <button
            onClick={handleSelectCurrentFolderRecursive}
            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/30 flex items-center gap-1.5 cursor-pointer"
            title="Select all image files in this folder AND every subfolder recursively"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Include Subdirectories (Recursive)</span>
          </button>
        </div>
      </div>

      {/* Drive for Desktop / Computers Clarification Note */}
      <div className="px-6 py-2 bg-blue-950/20 border-b border-blue-900/30 text-[11px] text-blue-300/80 flex items-center gap-2">
        <InfoIcon className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
        <span>
          <strong>Google Drive API Note:</strong> Drive API browses cloud-synced My Drive and Shared Drives. For files backed up via Google Drive for Desktop from your PC (e.g. <code>F:\Images</code>), browse them using the <strong>Local Computer</strong> tab if accessible locally.
        </span>
      </div>

      {/* Main Browse Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Folders Section */}
        {folders.length > 0 && (
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-blue-400" />
              <span>Folders ({folders.length})</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {folders.map(f => (
                <div
                  key={f.id}
                  onClick={() => navigateToFolder(f.id, f.name)}
                  className="p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all flex items-center gap-2.5 group"
                >
                  <Folder className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                  <span className="text-xs text-slate-200 font-semibold truncate" title={f.name}>
                    {f.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Images Grid */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Images in {currentFolderName} ({images.length})</span>
            </h4>
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />}
          </div>

          {images.length === 0 && !loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No supported images found directly in this directory.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {images.map(img => {
                const selected = isSelected(selection, img.id, currentPathArray);
                const thumbUrl = `/api/google/drive/thumb/${img.id}?size=256`;

                return (
                  <div
                    key={img.id}
                    onClick={() => handleToggleFile(img)}
                    className={`rounded-xl border overflow-hidden p-2 bg-slate-950 cursor-pointer transition-all flex flex-col justify-between ${
                      selected
                        ? 'border-blue-500 ring-2 ring-blue-500/40 bg-blue-500/5'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="h-28 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center relative">
                      <img
                        src={thumbUrl}
                        alt={img.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback icon if no thumbnail preview is returned by Drive
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute top-2 left-2">
                        <div className={`w-5 h-5 rounded flex items-center justify-center ${
                          selected ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-950/80 border border-slate-700 text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 space-y-0.5">
                      <p className="font-semibold text-xs text-slate-200 truncate" title={img.name}>
                        {img.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {img.size ? `${(img.size / 1024).toFixed(0)} KB` : 'Size unknown'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {nextPageToken && (
            <div className="pt-4 text-center">
              <button
                onClick={() => loadFolder(true)}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {loading ? 'Loading more...' : 'Load More Drive Files'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active Selection Scopes Pill Bar & Summary */}
      {selection.scopes.length > 0 && (
        <div className="p-3 px-6 bg-slate-950 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">
            Selected Scopes:
          </span>
          {selection.scopes.map(s => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30 text-[11px] flex-shrink-0"
            >
              <span>{s.label}</span>
              <X
                className="w-3 h-3 hover:text-white cursor-pointer"
                onClick={() => handleRemoveScope(s.key)}
              />
            </span>
          ))}
        </div>
      )}

      {/* Bottom Action Footer with Selection Summary */}
      <div className="p-4 px-6 border-t border-slate-800 bg-slate-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Real Summary Metrics Display */}
        <div className="text-xs text-slate-400 space-y-1">
          {summaryLoading ? (
            <div className="flex items-center gap-2 text-blue-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Calculating total files and storage across directory tree...</span>
            </div>
          ) : summary ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span>Selected Files: <strong className="text-white font-mono text-sm">{summary.files}</strong></span>
              {summary.folders > 0 && <span>Folders Included: <strong className="text-white font-mono">{summary.folders}</strong></span>}
              <span>Est. Storage: <strong className="text-blue-300 font-mono">{(summary.totalBytes / (1024 * 1024)).toFixed(1)} MB</strong></span>
              {summary.duplicates > 0 && (
                <span className="text-amber-400">Duplicates: {summary.duplicates}</span>
              )}
              {summary.unsupported > 0 && (
                <span className="text-rose-400">Unsupported files: {summary.unsupported}</span>
              )}
            </div>
          ) : (
            <span>No files or folders selected</span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          {summary && summary.files > 0 && (
            <button
              onClick={() => setSelection(clearSelection())}
              className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
            >
              Clear Selection
            </button>
          )}

          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>

          {isImporting ? (
            <button
              onClick={cancelImport}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20"
            >
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Cancel Import ({importProgress.current}/{importProgress.total})</span>
            </button>
          ) : (
            <button
              onClick={handleExecuteImport}
              disabled={!summary || summary.files === 0}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              <Download className="w-4 h-4 fill-current" />
              <span>Import {summary?.files || 0} Photos into Queue</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
