import React, { createContext, useContext, useState, useEffect, useCallback, useTransition } from 'react';
import { User } from 'firebase/auth';
import { 
  ImageItem, 
  AiSettings, 
  DriveSyncConfig, 
  FolderRule, 
  BatchProgress, 
  ScriptBundle, 
  AuditRecord 
} from '../types/index.ts';
import { INITIAL_SAMPLE_ITEMS } from '../utils/sampleData.ts';
import { 
  initAuth, 
  googleSignIn, 
  googleSignOut, 
  getAccessToken 
} from '../services/googleAuth.ts';
import { 
  fetchDriveImageFiles, 
  downloadDriveFileBlob, 
  uploadManifestFileToDrive 
} from '../services/googleDrive.ts';
import { 
  createOrUpdateInventorySheet, 
  SheetCreationResult 
} from '../services/googleSheets.ts';
import { 
  loadGooglePickerApi, 
  openGoogleDrivePicker, 
  PickedGoogleDoc 
} from '../services/googlePicker.ts';

interface AppContextType {
  items: ImageItem[];
  selectedItemId: string | null;
  selectedItem: ImageItem | null;
  setSelectedItemId: (id: string | null) => void;
  addItem: (item: ImageItem) => void;
  addItems: (items: ImageItem[]) => void;
  updateItem: (id: string, updates: Partial<ImageItem>) => void;
  deleteItem: (id: string) => void;
  clearItems: () => void;
  loadSampleItems: () => void;
  
  // Selection
  selectedIds: Set<string>;
  toggleSelectId: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  
  // Batch approvals
  approveItem: (id: string) => void;
  approveSelected: () => void;
  rejectSelected: () => void;
  approveAll: () => void;
  
  // Batch worker & checkpoint
  batchProgress: BatchProgress;
  startBatchAnalysis: () => Promise<void>;
  pauseBatchAnalysis: () => void;
  resumeBatchAnalysis: () => Promise<void>;
  
  // AI Settings
  aiSettings: AiSettings;
  updateAiSettings: (settings: Partial<AiSettings>) => void;
  
  // Drive Config
  driveConfig: DriveSyncConfig;
  updateDriveConfig: (config: Partial<DriveSyncConfig>) => void;
  detectDrivePaths: () => Promise<void>;
  
  // Folder Rules
  folderRule: FolderRule;
  updateFolderRule: (rule: Partial<FolderRule>) => void;
  
  // Scripts & Execution
  scriptBundle: ScriptBundle | null;
  generateScripts: () => Promise<ScriptBundle | null>;
  executeApprovedRenamesLocally: () => Promise<void>;
  
  // Audit Logs
  auditLogs: AuditRecord[];
  clearAuditLogs: () => void;

  // Active View Tab
  activeTab: 'dashboard' | 'analyzer' | 'rename-preview' | 'folder-builder' | 'ebay-studio' | 'collectibles' | 'ai-chat' | 'sync-scripts' | 'database-schema' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'analyzer' | 'rename-preview' | 'folder-builder' | 'ebay-studio' | 'collectibles' | 'ai-chat' | 'sync-scripts' | 'database-schema' | 'settings') => void;

  // Google Workspace Integrations
  googleUser: User | null;
  googleAccessToken: string | null;
  isGoogleSigningIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutWithGoogle: () => Promise<void>;
  exportCatalogToGoogleSheets: () => Promise<SheetCreationResult | null>;
  openDrivePickerForImport: () => Promise<void>;
  syncManifestToGoogleDrive: () => Promise<void>;
  isCloudPickerOpen: boolean;
  setIsCloudPickerOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'ebay_hero_gemini_state_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ImageItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_items');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not restore cached items:', e);
    }
    return INITIAL_SAMPLE_ITEMS;
  });

  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.id || null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(items.map(i => i.id)));
  const [activeTab, setActiveTab] = useState<AppContextType['activeTab']>('dashboard');
  const [, startTransition] = useTransition();

  const [aiSettings, setAiSettings] = useState<AiSettings>({
    provider: 'gemini',
    geminiModel: 'gemini-3.8-flash',
    enableThinking: true,
    thinkingLevel: 'HIGH',
    localEndpoint: 'http://127.0.0.1:11434',
    localModelName: 'qwen2.5-vl:7b',
    batchConcurrency: 2,
  });

  const [driveConfig, setDriveConfig] = useState<DriveSyncConfig>({
    mode: 'stream',
    platform: 'windows',
    detectedPath: 'G:\\My Drive',
    customPath: 'C:\\Users\\Seller\\My Drive\\Inventory',
    activePath: 'G:\\My Drive',
    libraryName: 'Primary eBay Collectibles Vault',
    autoSyncEnabled: true,
  });

  const [folderRule, setFolderRule] = useState<FolderRule>({
    pattern: 'Inventory/{Category}/{Subcategory}',
    caseStyle: 'UPPER_SNAKE',
    numberPadding: 3,
    prefixYear: true,
    preserveExtension: true,
    sanitizeChars: true,
  });

  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    jobId: 'job-default',
    total: 0,
    processed: 0,
    approved: 0,
    rejected: 0,
    failed: 0,
    inProgress: false,
    isPaused: false,
    checkpointIndex: 0,
  });

  const [scriptBundle, setScriptBundle] = useState<ScriptBundle | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_audit');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        timestamp: new Date().toISOString(),
        action: 'analyze',
        imageId: 'item-001',
        originalName: 'IMG_20261008_142319_raw.jpg',
        newName: '1999_POKEMON_BASE_SET_CHARIZARD_4-102_HOLO_PSA9_001.jpg',
        originalPath: 'C:/Users/Seller/My Drive/Incoming/IMG_20261008_142319_raw.jpg',
        newPath: 'Inventory/Trading Cards/Pokemon/Base Set',
        status: 'success',
        performedBy: 'Gemini Vision AI',
      },
    ];
  });

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + '_items', JSON.stringify(items));
    } catch {}
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + '_audit', JSON.stringify(auditLogs));
    } catch {}
  }, [auditLogs]);

  // Query server for local Drive auto-detection
  const detectDrivePaths = useCallback(async () => {
    try {
      const res = await fetch('/api/drive/detect');
      if (res.ok) {
        const data = await res.json();
        setDriveConfig(prev => ({
          ...prev,
          detectedPath: data.detectedPath || prev.detectedPath,
          mode: data.mode || prev.mode,
          platform: data.platform === 'win32' ? 'windows' : data.platform === 'darwin' ? 'mac' : 'linux',
          activePath: prev.activePath || data.detectedPath,
        }));
      }
    } catch (e) {
      console.warn('Drive detect fetch failed:', e);
    }
  }, []);

  useEffect(() => {
    detectDrivePaths();
  }, [detectDrivePaths]);

  const selectedItem = items.find(i => i.id === selectedItemId) || null;

  const addItem = (item: ImageItem) => {
    setItems(prev => [item, ...prev]);
    setSelectedIds(prev => new Set([...prev, item.id]));
  };

  const addItems = (newItems: ImageItem[]) => {
    setItems(prev => [...newItems, ...prev]);
    setSelectedIds(prev => {
      const next = new Set(prev);
      newItems.forEach(i => next.add(i.id));
      return next;
    });
  };

  const updateItem = (id: string, updates: Partial<ImageItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (selectedItemId === id) {
      setSelectedItemId(null);
    }
  };

  const clearItems = () => {
    setItems([]);
    setSelectedIds(new Set());
    setSelectedItemId(null);
  };

  const loadSampleItems = () => {
    setItems(INITIAL_SAMPLE_ITEMS);
    setSelectedIds(new Set(INITIAL_SAMPLE_ITEMS.map(i => i.id)));
    setSelectedItemId(INITIAL_SAMPLE_ITEMS[0].id);
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(items.map(i => i.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const approveItem = (id: string) => {
    updateItem(id, { status: 'approved' });
  };

  const approveSelected = () => {
    setItems(prev => prev.map(it => selectedIds.has(it.id) ? { ...it, status: 'approved' } : it));
  };

  const rejectSelected = () => {
    setItems(prev => prev.map(it => selectedIds.has(it.id) ? { ...it, status: 'rejected' } : it));
  };

  const approveAll = () => {
    setItems(prev => prev.map(it => ({ ...it, status: 'approved' })));
  };

  const updateAiSettings = (updates: Partial<AiSettings>) => {
    setAiSettings(prev => ({ ...prev, ...updates }));
  };

  const updateDriveConfig = (updates: Partial<DriveSyncConfig>) => {
    setDriveConfig(prev => ({ ...prev, ...updates }));
  };

  const updateFolderRule = (updates: Partial<FolderRule>) => {
    setFolderRule(prev => ({ ...prev, ...updates }));
  };

  const clearAuditLogs = () => {
    setAuditLogs([]);
  };

  // Live Batch Analysis Engine with Checkpoint recovery
  const startBatchAnalysis = async () => {
    const unanalyzed = items.filter(it => it.status === 'pending');
    if (unanalyzed.length === 0) return;

    setBatchProgress({
      jobId: `job-${Date.now()}`,
      total: unanalyzed.length,
      processed: 0,
      approved: 0,
      rejected: 0,
      failed: 0,
      inProgress: true,
      isPaused: false,
      checkpointIndex: 0,
    });

    let currentCheckpoint = 0;

    for (let i = 0; i < unanalyzed.length; i++) {
      const item = unanalyzed[i];
      setBatchProgress(prev => ({
        ...prev,
        currentFilename: item.originalName,
        checkpointIndex: i,
      }));

      updateItem(item.id, { status: 'analyzing' });

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: item.previewUrl,
            mimeType: item.mimeType,
            originalFilename: item.originalName,
            model: aiSettings.geminiModel,
            enableThinking: aiSettings.enableThinking,
          }),
        });

        if (response.ok) {
          const analysis = await response.json();
          updateItem(item.id, {
            status: 'approved',
            confidence: analysis.confidenceScore || 90,
            proposedName: analysis.proposedFilename || item.originalName,
            proposedFolder: analysis.proposedRelativeFolder || 'Inventory/Collectibles',
            analysis,
            ebayDraft: analysis.ebayDraft,
          });

          setBatchProgress(prev => ({
            ...prev,
            processed: prev.processed + 1,
            approved: prev.approved + 1,
          }));

          setAuditLogs(prev => [
            {
              timestamp: new Date().toISOString(),
              action: 'analyze',
              imageId: item.id,
              originalName: item.originalName,
              newName: analysis.proposedFilename || item.originalName,
              originalPath: item.originalPath,
              newPath: analysis.proposedRelativeFolder || 'Inventory/Collectibles',
              status: 'success',
              performedBy: `Gemini Vision (${aiSettings.geminiModel})`,
            },
            ...prev,
          ]);
        } else {
          throw new Error(`Server returned ${response.status}`);
        }
      } catch (err: any) {
        updateItem(item.id, {
          status: 'error',
          errorMessage: err.message || 'Analysis failed',
        });
        setBatchProgress(prev => ({
          ...prev,
          processed: prev.processed + 1,
          failed: prev.failed + 1,
        }));
      }

      currentCheckpoint = i + 1;
    }

    setBatchProgress(prev => ({
      ...prev,
      inProgress: false,
      checkpointIndex: currentCheckpoint,
    }));
  };

  const pauseBatchAnalysis = () => {
    setBatchProgress(prev => ({ ...prev, isPaused: true, inProgress: false }));
  };

  const resumeBatchAnalysis = async () => {
    await startBatchAnalysis();
  };

  // Generate Script Bundle
  const generateScripts = async (): Promise<ScriptBundle | null> => {
    const targetItems = items.filter(it => it.status === 'approved' || it.status === 'pending');
    if (targetItems.length === 0) return null;

    try {
      const payload = {
        baseDirectory: driveConfig.activePath || driveConfig.detectedPath,
        createDestinationFolders: true,
        backupBeforeRename: true,
        items: targetItems.map(it => ({
          id: it.id,
          originalPath: it.originalPath,
          originalName: it.originalName,
          proposedName: it.proposedName || it.originalName,
          targetFolder: it.proposedFolder || 'Inventory/Uncategorized',
          relativeOldPath: it.originalName,
          relativeNewPath: `${it.proposedFolder || 'Inventory/Uncategorized'}/${it.proposedName || it.originalName}`,
        })),
      };

      const res = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const bundle = await res.json();
        setScriptBundle(bundle);
        return bundle;
      }
    } catch (e) {
      console.error('Failed to generate scripts:', e);
    }
    return null;
  };

  // Simulate local execution with atomic update & audit logging
  const executeApprovedRenamesLocally = async () => {
    const approved = items.filter(i => i.status === 'approved');
    if (approved.length === 0) return;

    startTransition(() => {
      setItems(prev =>
        prev.map(item => {
          if (item.status === 'approved') {
            return {
              ...item,
              status: 'executed',
              originalName: item.proposedName,
              originalPath: `${driveConfig.activePath}/${item.proposedFolder}/${item.proposedName}`,
            };
          }
          return item;
        })
      );
    });

    const newAuditRecords: AuditRecord[] = approved.map(it => ({
      timestamp: new Date().toISOString(),
      action: 'rename',
      imageId: it.id,
      originalName: it.originalName,
      newName: it.proposedName,
      originalPath: it.originalPath,
      newPath: `${driveConfig.activePath}/${it.proposedFolder}/${it.proposedName}`,
      status: 'success',
      performedBy: 'Local Executor / Desktop Sync',
    }));

    setAuditLogs(prev => [...newAuditRecords, ...prev]);
  };

  // Google Workspace Integrations
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isCloudPickerOpen, setIsCloudPickerOpen] = useState(false);

  useEffect(() => {
    // Listen for Firebase auth state changes
    initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleAccessToken(null);
      }
    );
  }, []);

  const signInWithGoogle = async () => {
    setIsGoogleSigningIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleAccessToken(result.accessToken);
      }
    } catch (e: any) {
      console.error('Sign-in failed:', e);
      alert(`Google Sign-In Error: ${e.message}`);
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const signOutWithGoogle = async () => {
    await googleSignOut();
    setGoogleUser(null);
    setGoogleAccessToken(null);
  };

  const exportCatalogToGoogleSheets = async (): Promise<SheetCreationResult | null> => {
    let token = googleAccessToken;
    if (!token) {
      const res = await googleSignIn();
      if (!res) return null;
      token = res.accessToken;
      setGoogleUser(res.user);
      setGoogleAccessToken(res.accessToken);
    }

    try {
      const result = await createOrUpdateInventorySheet(token, items);
      alert(`Google Sheet created successfully!\n\nSpreadsheet: ${result.title}\nRows: ${result.rowsCount}\n\nOpening in a new tab...`);
      window.open(result.spreadsheetUrl, '_blank');
      return result;
    } catch (err: any) {
      if (err.message !== 'Operation cancelled by user.') {
        console.error('Export to Sheets error:', err);
        alert(`Google Sheets export error: ${err.message}`);
      }
      return null;
    }
  };

  const openDrivePickerForImport = async () => {
    setIsCloudPickerOpen(true);
    if (!googleAccessToken) {
      try {
        await signInWithGoogle();
      } catch (err) {
        console.warn('Sign-in can also be completed in the picker dialog');
      }
    }
  };

  const syncManifestToGoogleDrive = async () => {
    let token = googleAccessToken;
    if (!token) {
      const res = await googleSignIn();
      if (!res) return;
      token = res.accessToken;
      setGoogleUser(res.user);
      setGoogleAccessToken(res.accessToken);
    }

    try {
      const manifestPayload = {
        exportedAt: new Date().toISOString(),
        library: driveConfig.libraryName,
        totalItems: items.length,
        items: items.map(it => ({
          id: it.id,
          originalName: it.originalName,
          proposedName: it.proposedName,
          proposedFolder: it.proposedFolder,
          analysis: it.analysis,
          ebayDraft: it.ebayDraft,
        })),
      };

      const result = await uploadManifestFileToDrive(
        token,
        `ebay_hero_manifest_${Date.now()}.json`,
        JSON.stringify(manifestPayload, null, 2)
      );

      alert(`Manifest successfully saved to Google Drive! File ID: ${result.id}`);
    } catch (err: any) {
      if (err.message !== 'Operation cancelled by user.') {
        alert(`Sync error: ${err.message}`);
      }
    }
  };

  return (
    <AppContext.Provider
      value={{
        items,
        selectedItemId,
        selectedItem,
        setSelectedItemId,
        addItem,
        addItems,
        updateItem,
        deleteItem,
        clearItems,
        loadSampleItems,
        selectedIds,
        toggleSelectId,
        selectAll,
        deselectAll,
        approveItem,
        approveSelected,
        rejectSelected,
        approveAll,
        batchProgress,
        startBatchAnalysis,
        pauseBatchAnalysis,
        resumeBatchAnalysis,
        aiSettings,
        updateAiSettings,
        driveConfig,
        updateDriveConfig,
        detectDrivePaths,
        folderRule,
        updateFolderRule,
        scriptBundle,
        generateScripts,
        executeApprovedRenamesLocally,
        auditLogs,
        clearAuditLogs,
        activeTab,
        setActiveTab,
        googleUser,
        googleAccessToken,
        isGoogleSigningIn,
        signInWithGoogle,
        signOutWithGoogle,
        exportCatalogToGoogleSheets,
        openDrivePickerForImport,
        syncManifestToGoogleDrive,
        isCloudPickerOpen,
        setIsCloudPickerOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
