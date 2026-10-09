import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { 
  PhotoSourceType, 
  DriveScopeType, 
  DriveFolderTreeItem 
} from '../types/index.ts';
import { 
  fetchDriveImageFiles, 
  fetchAllMatchingDriveImageIds, 
  fetchDriveCompleteHierarchy, 
  downloadDriveFileBlob, 
  DriveFileItem 
} from '../services/googleDrive.ts';
import { 
  fetchGooglePhotosLibrary, 
  fetchGooglePhotosAlbums, 
  PhotoAlbum 
} from '../services/googlePhotos.ts';
import { 
  openGoogleDrivePicker, 
  loadGooglePickerApi 
} from '../services/googlePicker.ts';
import { 
  X, 
  Search, 
  Folder, 
  Check, 
  HardDrive, 
  Image as ImageIcon, 
  Calendar, 
  Sparkles, 
  AlertCircle, 
  FolderTree, 
  ChevronRight, 
  ChevronDown, 
  UploadCloud, 
  Laptop, 
  Share2, 
  Users, 
  Download, 
  RefreshCw,
  Sliders,
  ExternalLink,
  Star,
  CheckCheck,
  Plus,
  ArrowLeft,
  FolderPlus,
  FolderOpen,
  Zap,
  FileCheck2,
  Lock,
  LogIn
} from 'lucide-react';
import { ImageItem } from '../types/index.ts';

interface AddPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LocalImageFile {
  name: string;
  fullPath: string;
  size: number;
  previewUrl: string;
  fileObject?: File;
}

export const AddPhotosModal: React.FC<AddPhotosModalProps> = ({ isOpen, onClose }) => {
  const { 
    googleUser, 
    googleAccessToken, 
    signInWithGoogle, 
    signOutWithGoogle,
    isGoogleSigningIn, 
    addItems, 
    driveConfig,
    updateDriveConfig
  } = useApp();

  // Current Screen: null = 'source_select' | 'google_drive' | 'google_photos' | 'local_folder'
  const [selectedSource, setSelectedSource] = useState<PhotoSourceType | null>(null);

  // Google Drive state
  const [driveTree, setDriveTree] = useState<DriveFolderTreeItem[]>([]);
  const [activeDriveNode, setActiveDriveNode] = useState<DriveFolderTreeItem | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveNextPageToken, setDriveNextPageToken] = useState<string | undefined>();
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(['root', 'root-my-drive', 'root-computers', 'comp-my-computer-root'])
  );
  const [customFolderDialogOpen, setCustomFolderDialogOpen] = useState(false);
  const [customFolderName, setCustomFolderName] = useState('');
  const [customFolderIdOrPath, setCustomFolderIdOrPath] = useState('');

  // Google Photos state
  const [photosCategory, setPhotosCategory] = useState<'all' | 'favorites' | 'recent' | 'album'>('all');
  const [photosAlbums, setPhotosAlbums] = useState<PhotoAlbum[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | undefined>();
  const [photoStartDate, setPhotoStartDate] = useState<string>('');
  const [photoEndDate, setPhotoEndDate] = useState<string>('');
  const [photosFiles, setPhotosFiles] = useState<DriveFileItem[]>([]);

  // Local storage state
  const [activeLocalFolderName, setActiveLocalFolderName] = useState<string>('F:\\Backups\\Images');
  const [localLoadedImages, setLocalLoadedImages] = useState<LocalImageFile[]>([]);
  const localFolderInputRef = useRef<HTMLInputElement>(null);
  const localFilesInputRef = useRef<HTMLInputElement>(null);

  // Selection & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; filename: string }>({
    current: 0,
    total: 0,
    filename: '',
  });

  // Reset or initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  }, [isOpen]);

  // Load Google Drive Tree hierarchy
  const loadDriveHierarchy = useCallback(async () => {
    if (!googleAccessToken) return;
    setIsLoading(true);
    try {
      const tree = await fetchDriveCompleteHierarchy(googleAccessToken);
      setDriveTree(tree);
      if (!activeDriveNode && tree.length > 0) {
        // Default to Computers -> F:\Images or My Drive
        const computersRoot = tree.find(n => n.scope === 'computers');
        const fImages = computersRoot?.children?.[0]?.children?.find(c => c.name.includes('F:') || c.name.toLowerCase().includes('images'));
        if (fImages) {
          setActiveDriveNode(fImages);
        } else {
          setActiveDriveNode(tree[0]);
        }
      }
    } catch (e) {
      console.warn('Could not load drive tree:', e);
    } finally {
      setIsLoading(false);
    }
  }, [googleAccessToken, activeDriveNode]);

  // Load files for selected Drive folder/scope
  const loadDriveFilesForActiveNode = useCallback(async (isLoadMore: boolean = false) => {
    if (!googleAccessToken || !activeDriveNode) return;
    setIsLoading(true);
    try {
      let folderIdToQuery = activeDriveNode.id;
      if (folderIdToQuery.startsWith('root-') || folderIdToQuery.startsWith('comp-')) {
        folderIdToQuery = 'all';
      }

      const res = await fetchDriveImageFiles(googleAccessToken, {
        folderId: folderIdToQuery === 'all' ? undefined : folderIdToQuery,
        scope: activeDriveNode.scope,
        searchQuery,
        pageSize: 40,
        pageToken: isLoadMore ? driveNextPageToken : undefined,
      });

      if (isLoadMore) {
        setDriveFiles(prev => [...prev, ...res.files]);
      } else {
        setDriveFiles(res.files);
        setSelectedIds(new Set());
      }
      setDriveNextPageToken(res.nextPageToken);
    } catch (err) {
      console.error('Error fetching drive files:', err);
    } finally {
      setIsLoading(false);
    }
  }, [googleAccessToken, activeDriveNode, searchQuery, driveNextPageToken]);

  // Load Google Photos files
  const loadPhotosFiles = useCallback(async () => {
    if (!googleAccessToken) return;
    setIsLoading(true);
    try {
      const [photosRes, albumsRes] = await Promise.all([
        fetchGooglePhotosLibrary(googleAccessToken, {
          category: photosCategory,
          albumId: selectedAlbumId,
          startDate: photoStartDate,
          endDate: photoEndDate,
          searchQuery,
          pageSize: 40,
        }),
        fetchGooglePhotosAlbums(googleAccessToken),
      ]);
      setPhotosFiles(photosRes.photos);
      setPhotosAlbums(albumsRes);
      setSelectedIds(new Set());
    } catch (err) {
      console.warn('Error fetching photos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [googleAccessToken, photosCategory, selectedAlbumId, photoStartDate, photoEndDate, searchQuery]);

  // Trigger data loading when source or node changes
  useEffect(() => {
    if (selectedSource === 'google_drive' && googleAccessToken) {
      loadDriveHierarchy();
    } else if (selectedSource === 'google_photos' && googleAccessToken) {
      loadPhotosFiles();
    }
  }, [selectedSource, googleAccessToken]);

  useEffect(() => {
    if (selectedSource === 'google_drive' && activeDriveNode) {
      loadDriveFilesForActiveNode(false);
    }
  }, [activeDriveNode, selectedSource]);

  if (!isOpen) return null;

  // Toggle single item selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // TRUE SELECT ALL for current view
  const handleSelectAllCurrent = async () => {
    if (selectedSource === 'google_drive') {
      if (!googleAccessToken) return;
      setIsLoading(true);
      try {
        const allMatching = await fetchAllMatchingDriveImageIds(googleAccessToken, {
          folderId: activeDriveNode?.id.startsWith('root') || activeDriveNode?.id.startsWith('comp') 
            ? undefined 
            : activeDriveNode?.id,
          scope: activeDriveNode?.scope,
          searchQuery,
        }, 5000);
        setDriveFiles(allMatching);
        setSelectedIds(new Set(allMatching.map(f => f.id)));
      } catch (e) {
        setSelectedIds(new Set(driveFiles.map(f => f.id)));
      } finally {
        setIsLoading(false);
      }
    } else if (selectedSource === 'google_photos') {
      setSelectedIds(new Set(photosFiles.map(f => f.id)));
    } else if (selectedSource === 'local_folder') {
      setSelectedIds(new Set(localLoadedImages.map(f => f.fullPath)));
    }
  };

  // Select quick batch (e.g. 10, 25, 50)
  const handleSelectBatch = (count: number) => {
    if (selectedSource === 'google_drive') {
      setSelectedIds(new Set(driveFiles.slice(0, count).map(f => f.id)));
    } else if (selectedSource === 'google_photos') {
      setSelectedIds(new Set(photosFiles.slice(0, count).map(f => f.id)));
    } else if (selectedSource === 'local_folder') {
      setSelectedIds(new Set(localLoadedImages.slice(0, count).map(f => f.fullPath)));
    }
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Import single photo immediately
  const handleImportSingleDriveFile = async (file: DriveFileItem) => {
    if (!googleAccessToken) return;
    setIsImporting(true);
    setImportProgress({ current: 1, total: 1, filename: file.name });
    try {
      let base64 = '';
      try {
        const dl = await downloadDriveFileBlob(googleAccessToken, file.id);
        base64 = dl.base64;
      } catch {
        base64 = file.thumbnailLink || 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=500';
      }

      const item: ImageItem = {
        id: `drive-${file.id}`,
        originalName: file.name,
        originalPath: `Google Drive/${activeDriveNode?.name || 'My Drive'}/${file.name}`,
        fileSize: parseInt(file.size || '2048000'),
        mimeType: file.mimeType || 'image/jpeg',
        previewUrl: base64,
        proposedName: file.name,
        proposedFolder: `Inventory/${activeDriveNode?.name || 'Google Drive'}`,
        status: 'pending',
        confidence: 0,
        sourceType: 'google_drive',
        sourceLocation: activeDriveNode?.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addItems([item]);
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  // Import all selected items
  const handleImportSelected = async () => {
    setIsImporting(true);
    const newItems: ImageItem[] = [];

    if (selectedSource === 'google_drive' && googleAccessToken) {
      const targetFiles = driveFiles.filter(f => selectedIds.has(f.id));
      for (let i = 0; i < targetFiles.length; i++) {
        const file = targetFiles[i];
        setImportProgress({ current: i + 1, total: targetFiles.length, filename: file.name });
        let base64 = '';
        try {
          const dl = await downloadDriveFileBlob(googleAccessToken, file.id);
          base64 = dl.base64;
        } catch {
          base64 = file.thumbnailLink || 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=500';
        }

        newItems.push({
          id: `drive-${file.id}`,
          originalName: file.name,
          originalPath: `Google Drive/${activeDriveNode?.name || 'My Drive'}/${file.name}`,
          fileSize: parseInt(file.size || '2048000'),
          mimeType: file.mimeType || 'image/jpeg',
          previewUrl: base64,
          proposedName: file.name,
          proposedFolder: `Inventory/${activeDriveNode?.name || 'Google Drive'}`,
          status: 'pending',
          confidence: 0,
          sourceType: 'google_drive',
          sourceLocation: activeDriveNode?.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } else if (selectedSource === 'google_photos' && googleAccessToken) {
      const targetFiles = photosFiles.filter(f => selectedIds.has(f.id));
      for (let i = 0; i < targetFiles.length; i++) {
        const file = targetFiles[i];
        setImportProgress({ current: i + 1, total: targetFiles.length, filename: file.name });
        let base64 = '';
        try {
          const dl = await downloadDriveFileBlob(googleAccessToken, file.id);
          base64 = dl.base64;
        } catch {
          base64 = file.thumbnailLink || '';
        }

        newItems.push({
          id: `photos-${file.id}`,
          originalName: file.name,
          originalPath: `Google Photos/${file.name}`,
          fileSize: parseInt(file.size || '2048000'),
          mimeType: file.mimeType || 'image/jpeg',
          previewUrl: base64,
          proposedName: file.name,
          proposedFolder: 'Inventory/Google Photos',
          status: 'pending',
          confidence: 0,
          sourceType: 'google_photos',
          sourceLocation: 'Google Photos Library',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } else if (selectedSource === 'local_folder') {
      const targetFiles = localLoadedImages.filter(f => selectedIds.has(f.fullPath));
      for (let i = 0; i < targetFiles.length; i++) {
        const file = targetFiles[i];
        newItems.push({
          id: `local-${Date.now()}-${i}`,
          originalName: file.name,
          originalPath: file.fullPath,
          fileSize: file.size,
          mimeType: 'image/jpeg',
          previewUrl: file.previewUrl,
          proposedName: file.name,
          proposedFolder: `Inventory/${activeLocalFolderName.replace(/[:\\\/]+/g, '_')}`,
          status: 'pending',
          confidence: 0,
          sourceType: 'local_folder',
          sourceLocation: activeLocalFolderName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (newItems.length > 0) {
      addItems(newItems);
    }
    setIsImporting(false);
    onClose();
  };

  // Toggle folder expansion in tree
  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  // Add custom folder or drive ID to Computers or tree
  const handleAddCustomFolder = () => {
    if (!customFolderName.trim()) return;
    const cleanName = customFolderName.trim();
    const cleanId = customFolderIdOrPath.trim() || `custom-${Date.now()}`;

    setDriveTree(prev => {
      const copy = [...prev];
      const compRoot = copy.find(n => n.scope === 'computers');
      if (compRoot && compRoot.children && compRoot.children[0]) {
        compRoot.children[0].children = compRoot.children[0].children || [];
        compRoot.children[0].children.push({
          id: cleanId,
          name: cleanName,
          scope: 'computers',
          computerName: 'My Computer',
          originalLocalPath: cleanName,
          iconType: 'folder',
        });
      }
      return copy;
    });

    setCustomFolderName('');
    setCustomFolderIdOrPath('');
    setCustomFolderDialogOpen(false);
  };

  // Direct native browser folder picker for Local (e.g. F:\Images, P:\My Drive)
  const handlePickLocalFolderNative = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        setActiveLocalFolderName(dirHandle.name);
        const images: LocalImageFile[] = [];

        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|gif)$/i.test(file.name)) {
              const previewUrl = URL.createObjectURL(file);
              images.push({
                name: file.name,
                fullPath: `${dirHandle.name}/${file.name}`,
                size: file.size,
                previewUrl,
                fileObject: file,
              });
            }
          }
        }
        setLocalLoadedImages(images);
        setSelectedIds(new Set(images.map(img => img.fullPath)));
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Native directory picker error:', err);
          localFolderInputRef.current?.click();
        }
      }
    } else {
      localFolderInputRef.current?.click();
    }
  };

  // Fallback webkitdirectory folder picker
  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const firstPath = (files[0] as any).webkitRelativePath;
      if (firstPath) {
        const folderName = firstPath.split('/')[0];
        setActiveLocalFolderName(folderName || 'Selected Folder');
      }

      const images: LocalImageFile[] = [];
      files.forEach((file) => {
        if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|gif)$/i.test(file.name)) {
          const previewUrl = URL.createObjectURL(file);
          images.push({
            name: file.name,
            fullPath: (file as any).webkitRelativePath || file.name,
            size: file.size,
            previewUrl,
            fileObject: file,
          });
        }
      });
      setLocalLoadedImages(images);
      setSelectedIds(new Set(images.map(img => img.fullPath)));
    }
  };

  // File multi-select input
  const handleFilesInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const images: LocalImageFile[] = [];
      files.forEach((file) => {
        if (file.type.startsWith('image/')) {
          const previewUrl = URL.createObjectURL(file);
          images.push({
            name: file.name,
            fullPath: file.name,
            size: file.size,
            previewUrl,
            fileObject: file,
          });
        }
      });
      setLocalLoadedImages(prev => [...images, ...prev]);
      setSelectedIds(new Set(images.map(img => img.fullPath)));
    }
  };

  // Launch Google Picker popup dialog
  const handleLaunchNativePicker = async () => {
    if (!googleAccessToken) {
      await signInWithGoogle();
      return;
    }
    try {
      await loadGooglePickerApi();
      openGoogleDrivePicker(
        googleAccessToken,
        async (docs) => {
          setIsImporting(true);
          const newItems: ImageItem[] = [];
          for (const doc of docs) {
            let base64 = '';
            try {
              const dl = await downloadDriveFileBlob(googleAccessToken, doc.id);
              base64 = dl.base64;
            } catch {
              base64 = doc.url;
            }
            newItems.push({
              id: `picker-${doc.id}`,
              originalName: doc.name,
              originalPath: `Google Drive/${doc.name}`,
              fileSize: doc.sizeBytes || 2048000,
              mimeType: doc.mimeType || 'image/jpeg',
              previewUrl: base64,
              proposedName: doc.name,
              proposedFolder: 'Inventory/Google Drive Picker',
              status: 'pending',
              confidence: 0,
              sourceType: 'google_drive',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          if (newItems.length > 0) {
            addItems(newItems);
            onClose();
          }
          setIsImporting(false);
        },
        () => {
          setIsImporting(false);
        }
      );
    } catch (e: any) {
      console.error('Picker error:', e);
      alert(`Could not launch Google Picker: ${e.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2.5">
                <span>Add Photos & Choose Source</span>
                {selectedSource && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 font-semibold border border-slate-700 uppercase">
                    {selectedSource === 'google_drive' ? 'Google Drive (My Drive & Computers)' :
                     selectedSource === 'google_photos' ? 'Google Photos' : 'Local Computer & Desktop'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {selectedSource === 'google_drive'
                  ? 'Browsing Google Drive structure: My Drive, Shared Drives, Shared With Me, and Computers'
                  : selectedSource === 'google_photos'
                  ? 'Browsing Google Photos library, albums, and camera imports'
                  : selectedSource === 'local_folder'
                  ? 'Browsing local desktop files and Google Drive for Desktop synced folders (F:\\Images, P:\\My Drive)'
                  : 'Independent source selection: browse Google Drive, Google Photos, or Local Computer storage'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {selectedSource && (
              <button
                onClick={() => setSelectedSource(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer border border-slate-700 flex items-center gap-1.5 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Source</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: SOURCE SELECTION SCREEN (Separates all file sources cleanly)      */}
        {/* ========================================================================= */}
        {!selectedSource ? (
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            <div className="text-center max-w-lg mx-auto space-y-2">
              <h4 className="text-xl font-extrabold text-white">Select Photo Storage Source</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose where your collectibles photos reside. Sources are kept strictly separate so you never see unrelated directories or random folders.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto pt-2">
              {/* 1. Google Drive Card */}
              <div
                onClick={() => setSelectedSource('google_drive')}
                className="p-6 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group flex flex-col justify-between space-y-5 shadow-lg relative overflow-hidden"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-semibold border border-blue-500/20">
                      Cloud Drive & Backups
                    </span>
                  </div>
                  <div>
                    <h5 className="font-extrabold text-base text-white group-hover:text-blue-300">Google Drive</h5>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Complete Drive structure:
                    </p>
                    <ul className="text-[11px] text-slate-400 mt-2 space-y-1 font-mono">
                      <li className="flex items-center gap-1.5 text-blue-300">
                        <span className="text-slate-600">•</span> My Drive
                      </li>
                      <li className="flex items-center gap-1.5 text-blue-300">
                        <span className="text-slate-600">•</span> Shared Drives & Shared With Me
                      </li>
                      <li className="flex items-center gap-1.5 text-amber-300 font-bold">
                        <span className="text-slate-600">•</span> Computers (F:\Images & Backups)
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-blue-400 font-semibold">
                  <span>Browse Drive Structure</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* 2. Google Photos Card */}
              <div
                onClick={() => setSelectedSource('google_photos')}
                className="p-6 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer group flex flex-col justify-between space-y-5 shadow-lg relative overflow-hidden"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
                      Cloud Photos
                    </span>
                  </div>
                  <div>
                    <h5 className="font-extrabold text-base text-white group-hover:text-amber-300">Google Photos</h5>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Filter and select from your synced photo collection:
                    </p>
                    <ul className="text-[11px] text-slate-400 mt-2 space-y-1 font-mono">
                      <li className="flex items-center gap-1.5 text-amber-300">
                        <span className="text-slate-600">•</span> Albums & Collectibles Sets
                      </li>
                      <li className="flex items-center gap-1.5 text-amber-300">
                        <span className="text-slate-600">•</span> Starred / Favorites
                      </li>
                      <li className="flex items-center gap-1.5 text-amber-300">
                        <span className="text-slate-600">•</span> Date Range / Recent Uploads
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-amber-400 font-semibold">
                  <span>Browse Photos Library</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* 3. Local Computer & Desktop Sync Card */}
              <div
                onClick={() => setSelectedSource('local_folder')}
                className="p-6 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col justify-between space-y-5 shadow-lg relative overflow-hidden"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                      <Laptop className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20">
                      Desktop & Local Disks
                    </span>
                  </div>
                  <div>
                    <h5 className="font-extrabold text-base text-white group-hover:text-emerald-300">Local Computer / Disks</h5>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Select local directories directly from your PC:
                    </p>
                    <ul className="text-[11px] text-slate-400 mt-2 space-y-1 font-mono">
                      <li className="flex items-center gap-1.5 text-emerald-300 font-bold">
                        <span className="text-slate-600">•</span> F:\Backups\Images (Backup Location)
                      </li>
                      <li className="flex items-center gap-1.5 text-emerald-300">
                        <span className="text-slate-600">•</span> P:\My Drive (Drive Stream)
                      </li>
                      <li className="flex items-center gap-1.5 text-emerald-300">
                        <span className="text-slate-600">•</span> Native Browser Folder Picker
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400 font-semibold">
                  <span>Browse Local Folders</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Quick Local Drop Zone */}
            <div className="max-w-5xl mx-auto pt-2">
              <div 
                onClick={() => {
                  setSelectedSource('local_folder');
                  setTimeout(() => handlePickLocalFolderNative(), 50);
                }}
                className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-slate-950/70"
              >
                <UploadCloud className="w-7 h-7 mx-auto text-slate-500 mb-2" />
                <span className="text-xs font-semibold text-slate-300 block">
                  Or click here to select any local folder or photos directly
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Select <code className="text-amber-400">F:\Backups\Images</code>, <code className="text-blue-400">P:\My Drive</code>, or local desktop scans
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* STEP 2: ACTIVE SOURCE SCREEN                                             */
          /* ========================================================================= */
          <div className="flex-1 flex overflow-hidden">
            
            {/* ===================================================================== */}
            {/* SOURCE 1: GOOGLE DRIVE VIEW                                           */}
            {/* Displays exact requested structure:                                   */}
            {/* Google Drive                                                          */}
            {/* ├── My Drive                                                          */}
            {/* ├── Shared Drives                                                     */}
            {/* ├── Shared With Me                                                    */}
            {/* └── Computers                                                         */}
            {/*     └── Computer Name                                                 */}
            {/*         ├── F:\Images                                                 */}
            {/*         ├── Documents                                                 */}
            {/*         └── Other Backed Up Folders                                   */}
            {/* ===================================================================== */}
            {selectedSource === 'google_drive' && (
              <div className="flex-1 flex overflow-hidden">
                {/* Left Tree Browser */}
                <div className="w-80 border-r border-slate-800 bg-slate-950 flex flex-col justify-between">
                  <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <FolderTree className="w-4 h-4 text-blue-400" />
                      <span>Google Drive Hierarchy</span>
                    </div>
                    <button
                      onClick={() => setCustomFolderDialogOpen(true)}
                      className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded border border-blue-500/20"
                      title="Add a custom backup folder or paste Drive folder ID"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Folder</span>
                    </button>
                  </div>

                  {/* Google Account Bar inside Drive view */}
                  <div className="p-3 border-b border-slate-850 bg-slate-950/80 text-xs">
                    {googleUser ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {googleUser.photoURL ? (
                            <img src={googleUser.photoURL} alt="User" className="w-5 h-5 rounded-full" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-blue-600 text-[10px] text-white flex items-center justify-center font-bold">G</div>
                          )}
                          <span className="text-slate-300 font-medium truncate text-[11px]" title={googleUser.email || ''}>
                            {googleUser.email}
                          </span>
                        </div>
                        <button
                          onClick={signOutWithGoogle}
                          className="text-[10px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
                        >
                          Switch
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Not connected</span>
                        <button
                          onClick={signInWithGoogle}
                          disabled={isGoogleSigningIn}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <LogIn className="w-3 h-3" />
                          <span>{isGoogleSigningIn ? 'Connecting...' : 'Connect'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Folder Tree Scrollable Pane */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
                    {driveTree.map((rootNode) => {
                      const isExpanded = expandedFolderIds.has(rootNode.id);
                      const isSelected = activeDriveNode?.id === rootNode.id;
                      const hasChildren = rootNode.children && rootNode.children.length > 0;

                      return (
                        <div key={rootNode.id} className="space-y-1">
                          {/* Root Node Header (e.g. My Drive, Shared Drives, Computers) */}
                          <div
                            onClick={() => {
                              setActiveDriveNode(rootNode);
                              toggleFolderExpand(rootNode.id);
                            }}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30'
                                : 'text-slate-300 hover:bg-slate-900'
                            }`}
                          >
                            {hasChildren ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFolderExpand(rootNode.id);
                                }}
                                className="text-slate-500 hover:text-slate-300"
                              >
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>
                            ) : <div className="w-3.5" />}

                            {rootNode.iconType === 'my_drive' ? <HardDrive className="w-4 h-4 text-blue-400 flex-shrink-0" /> :
                             rootNode.iconType === 'shared_drive' ? <Users className="w-4 h-4 text-indigo-400 flex-shrink-0" /> :
                             rootNode.iconType === 'shared_with_me' ? <Share2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> :
                             rootNode.iconType === 'computer' ? <Laptop className="w-4 h-4 text-amber-400 flex-shrink-0" /> :
                             <Folder className="w-4 h-4 text-slate-400 flex-shrink-0" />}

                            <span className="truncate font-semibold">{rootNode.name}</span>
                          </div>

                          {/* Children under root (e.g. Subfolders, or Computer Name) */}
                          {isExpanded && rootNode.children && (
                            <div className="pl-4 space-y-1 border-l border-slate-800/80 ml-3">
                              {rootNode.children.map(child => {
                                const isChildExpanded = expandedFolderIds.has(child.id);
                                const isChildSelected = activeDriveNode?.id === child.id;
                                const childHasGrandchildren = child.children && child.children.length > 0;

                                return (
                                  <div key={child.id} className="space-y-1">
                                    <div
                                      onClick={() => {
                                        setActiveDriveNode(child);
                                        if (childHasGrandchildren) toggleFolderExpand(child.id);
                                      }}
                                      className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors ${
                                        isChildSelected
                                          ? 'bg-blue-500/25 text-blue-200 font-bold border border-blue-500/30'
                                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                                      }`}
                                    >
                                      {childHasGrandchildren ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFolderExpand(child.id);
                                          }}
                                        >
                                          {isChildExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                                        </button>
                                      ) : <div className="w-3" />}

                                      {child.iconType === 'computer' ? (
                                        <Laptop className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                      ) : (
                                        <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                      )}
                                      
                                      <span className="truncate font-medium">{child.name}</span>
                                    </div>

                                    {/* Grandchildren (e.g. Under My Computer -> F:\Images, Documents) */}
                                    {isChildExpanded && child.children && (
                                      <div className="pl-4 space-y-1 border-l border-slate-800/80 ml-2.5">
                                        {child.children.map(grandchild => (
                                          <div
                                            key={grandchild.id}
                                            onClick={() => setActiveDriveNode(grandchild)}
                                            className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] cursor-pointer transition-colors ${
                                              activeDriveNode?.id === grandchild.id
                                                ? 'bg-amber-500/25 text-amber-200 font-bold border border-amber-500/30'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                                            }`}
                                          >
                                            <Folder className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                            <span className="truncate">{grandchild.name}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Folder Modal Dialog if opened */}
                  {customFolderDialogOpen && (
                    <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-white flex items-center justify-between">
                        <span>Add Backup / Drive Folder</span>
                        <button onClick={() => setCustomFolderDialogOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                      </div>
                      <input
                        type="text"
                        placeholder="Folder Name (e.g. F:\Images)"
                        value={customFolderName}
                        onChange={(e) => setCustomFolderName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded p-1.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Optional Drive Folder ID"
                        value={customFolderIdOrPath}
                        onChange={(e) => setCustomFolderIdOrPath(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded p-1.5 text-xs font-mono"
                      />
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => setCustomFolderDialogOpen(false)}
                          className="px-2 py-1 text-[11px] text-slate-400"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddCustomFolder}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded text-[11px]"
                        >
                          Add to Tree
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bottom Quick Help */}
                  <div className="p-3 border-t border-slate-800 bg-slate-950 text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="truncate">Active: <strong className="text-white">{activeDriveNode?.name || 'All'}</strong></span>
                    <button
                      onClick={handleLaunchNativePicker}
                      className="text-blue-400 hover:text-blue-300 font-semibold text-[10px] underline cursor-pointer"
                      title="Launch Google's popup dialog"
                    >
                      Google Picker Popup
                    </button>
                  </div>
                </div>

                {/* Right Files Grid */}
                <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
                  {/* Toolbar */}
                  <div className="p-3 px-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/60">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <div className="relative w-full">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && loadDriveFilesForActiveNode(false)}
                          placeholder={`Search in ${activeDriveNode?.name || 'Drive'}...`}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAllCurrent}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold border border-blue-500/30 text-xs cursor-pointer flex items-center gap-1.5 transition-all"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Select All ({driveFiles.length})</span>
                      </button>

                      <div className="hidden sm:flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                        <button
                          onClick={() => handleSelectBatch(10)}
                          className="px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                        >
                          +10
                        </button>
                        <button
                          onClick={() => handleSelectBatch(25)}
                          className="px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                        >
                          +25
                        </button>
                        <button
                          onClick={() => handleSelectBatch(50)}
                          className="px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                        >
                          +50
                        </button>
                      </div>

                      {selectedIds.size > 0 && (
                        <button
                          onClick={deselectAll}
                          className="text-slate-400 hover:text-white text-xs underline cursor-pointer ml-1"
                        >
                          Clear ({selectedIds.size})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Drive Grid */}
                  <div className="flex-1 overflow-y-auto p-5">
                    {isLoading && driveFiles.length === 0 ? (
                      <div className="py-24 text-center text-slate-400 space-y-2">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-xs">Fetching Google Drive photos in {activeDriveNode?.name}...</p>
                      </div>
                    ) : driveFiles.length === 0 ? (
                      <div className="py-24 text-center text-slate-400 max-w-sm mx-auto space-y-3">
                        <FolderOpen className="w-10 h-10 mx-auto text-slate-600" />
                        <h5 className="font-bold text-white text-sm">No Images Found in this Folder</h5>
                        <p className="text-xs text-slate-500">
                          {activeDriveNode?.name === 'F:\\Images' 
                            ? 'If your computer images are syncing via Google Drive for Desktop, ensure Google Drive for Desktop has synced them, or use the "Local Computer" tab to browse F:\\Images directly.'
                            : 'Try expanding subfolders in the left tree or searching for file names.'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                        {driveFiles.map(file => {
                          const isSelected = selectedIds.has(file.id);
                          return (
                            <div
                              key={file.id}
                              onClick={() => toggleSelect(file.id)}
                              className={`rounded-xl border overflow-hidden p-2.5 bg-slate-950 cursor-pointer transition-all group relative flex flex-col justify-between ${
                                isSelected ? 'border-blue-500 ring-2 ring-blue-500/40 bg-blue-500/5' : 'border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="h-32 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center relative">
                                {file.thumbnailLink ? (
                                  <img 
                                    src={file.thumbnailLink} 
                                    alt={file.name} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                    loading="lazy"
                                  />
                                ) : (
                                  <ImageIcon className="w-8 h-8 text-slate-600" />
                                )}

                                {/* Checkbox Badge */}
                                <div className="absolute top-2 left-2">
                                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                    isSelected ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-950/80 border border-slate-700 text-transparent'
                                  }`}>
                                    <Check className="w-3.5 h-3.5" />
                                  </div>
                                </div>

                                {/* Quick Single Import Button on Hover */}
                                <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleImportSingleDriveFile(file);
                                    }}
                                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-lg cursor-pointer"
                                  >
                                    <Zap className="w-3 h-3 fill-current" />
                                    <span>Import Photo</span>
                                  </button>
                                </div>
                              </div>

                              <div className="mt-2 space-y-0.5">
                                <p className="font-semibold text-xs text-slate-200 truncate" title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {file.size ? `${(parseInt(file.size) / (1024 * 1024)).toFixed(1)} MB` : 'Cloud File'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ===================================================================== */}
            {/* SOURCE 2: GOOGLE PHOTOS VIEW                                          */}
            {/* ===================================================================== */}
            {selectedSource === 'google_photos' && (
              <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
                {/* Photos Toolbar */}
                <div className="p-4 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    {['all', 'favorites', 'recent'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setPhotosCategory(cat as any);
                          loadPhotosFiles();
                        }}
                        className={`px-3 py-1.5 rounded-lg font-semibold capitalize cursor-pointer transition-all ${
                          photosCategory === cat
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}

                    {photosAlbums.length > 0 && (
                      <select
                        value={selectedAlbumId || ''}
                        onChange={(e) => {
                          setSelectedAlbumId(e.target.value || undefined);
                          loadPhotosFiles();
                        }}
                        className="bg-slate-900 border border-slate-800 text-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none"
                      >
                        <option value="">All Albums</option>
                        {photosAlbums.map(alb => (
                          <option key={alb.id} value={alb.id}>{alb.title}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <input
                      type="date"
                      value={photoStartDate}
                      onChange={(e) => setPhotoStartDate(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-slate-300 rounded px-2 py-1 text-xs"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="date"
                      value={photoEndDate}
                      onChange={(e) => setPhotoEndDate(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-slate-300 rounded px-2 py-1 text-xs"
                    />
                    <button
                      onClick={handleSelectAllCurrent}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 cursor-pointer"
                    >
                      Select All Photos ({photosFiles.length})
                    </button>
                  </div>
                </div>

                {/* Photos Grid */}
                <div className="flex-1 overflow-y-auto p-5">
                  {isLoading ? (
                    <div className="py-24 text-center text-slate-400">Loading Google Photos...</div>
                  ) : photosFiles.length === 0 ? (
                    <div className="py-24 text-center text-slate-400">No photos found in selected album / category.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                      {photosFiles.map(file => {
                        const isSelected = selectedIds.has(file.id);
                        return (
                          <div
                            key={file.id}
                            onClick={() => toggleSelect(file.id)}
                            className={`rounded-xl border overflow-hidden p-2.5 bg-slate-950 cursor-pointer transition-all group flex flex-col justify-between ${
                              isSelected ? 'border-amber-500 ring-2 ring-amber-500/40 bg-amber-500/5' : 'border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="h-32 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center relative">
                              {file.thumbnailLink ? (
                                <img src={file.thumbnailLink} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <ImageIcon className="w-8 h-8 text-slate-600" />
                              )}
                              <div className="absolute top-2 left-2">
                                <div className={`w-5 h-5 rounded flex items-center justify-center ${
                                  isSelected ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-950/80 border border-slate-700 text-transparent'
                                }`}>
                                  <Check className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </div>
                            <p className="font-semibold text-xs text-slate-200 mt-2 truncate">{file.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===================================================================== */}
            {/* SOURCE 3: LOCAL COMPUTER / DESKTOP FOLDERS (Clean, isolated, no clutter)*/}
            {/* ===================================================================== */}
            {selectedSource === 'local_folder' && (
              <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
                {/* Local Toolbar with Native Picker buttons */}
                <div className="p-4 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handlePickLocalFolderNative}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Choose Folder on My Computer</span>
                    </button>

                    <button
                      onClick={() => localFilesInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      <span>Select Photo Files</span>
                    </button>

                    {/* Hidden Native File and Directory Inputs */}
                    <input
                      ref={localFolderInputRef}
                      type="file"
                      // @ts-ignore
                      webkitdirectory=""
                      directory=""
                      multiple
                      className="hidden"
                      onChange={handleFolderInputChange}
                    />
                    <input
                      ref={localFilesInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleFilesInputChange}
                    />

                    <span className="text-slate-400 font-mono text-[11px] hidden md:inline">
                      Folder: <strong className="text-white">{activeLocalFolderName}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAllCurrent}
                      disabled={localLoadedImages.length === 0}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 font-bold border border-emerald-500/30 cursor-pointer disabled:opacity-50"
                    >
                      Select All ({localLoadedImages.length})
                    </button>
                    {selectedIds.size > 0 && (
                      <button
                        onClick={deselectAll}
                        className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
                      >
                        Clear ({selectedIds.size})
                      </button>
                    )}
                  </div>
                </div>

                {/* Local Files Grid */}
                <div className="flex-1 overflow-y-auto p-5">
                  {localLoadedImages.length === 0 ? (
                    <div className="py-24 text-center max-w-md mx-auto space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                        <Laptop className="w-8 h-8" />
                      </div>
                      <div>
                        <h5 className="font-extrabold text-base text-white">No Local Photos Loaded Yet</h5>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Click <strong>"Choose Folder on My Computer"</strong> to browse directly to <code className="text-emerald-300">F:\Backups\Images</code>, <code className="text-blue-300">P:\My Drive</code>, or any folder on your PC.
                        </p>
                      </div>
                      <button
                        onClick={handlePickLocalFolderNative}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>Browse F:\Backups\Images on Computer</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                      {localLoadedImages.map(file => {
                        const isSelected = selectedIds.has(file.fullPath);
                        return (
                          <div
                            key={file.fullPath}
                            onClick={() => toggleSelect(file.fullPath)}
                            className={`rounded-xl border overflow-hidden p-2.5 bg-slate-950 cursor-pointer transition-all group flex flex-col justify-between ${
                              isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-500/5' : 'border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="h-32 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center relative">
                              <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover" />
                              <div className="absolute top-2 left-2">
                                <div className={`w-5 h-5 rounded flex items-center justify-center ${
                                  isSelected ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-950/80 border border-slate-700 text-transparent'
                                }`}>
                                  <Check className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 space-y-0.5">
                              <p className="font-semibold text-xs text-slate-200 truncate">{file.name}</p>
                              <p className="text-[10px] text-slate-500">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Footer Actions (Active whenever a source is open) */}
        {selectedSource && (
          <div className="p-4 px-6 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Selected: <strong className="text-amber-400 font-mono text-sm">{selectedIds.size}</strong> photos to import
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedSource(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Back to Sources
              </button>

              <button
                onClick={handleImportSelected}
                disabled={selectedIds.size === 0 || isImporting}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Importing ({importProgress.current}/{importProgress.total})...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 fill-current" />
                    <span>Import {selectedIds.size} Photos into Queue</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
