import React, { createContext, useContext, useState, useEffect, useCallback, useTransition } from 'react';
import { User } from 'firebase/auth';
import { 
  ImageItem, 
  AiSettings, 
  DriveSyncConfig, 
  FolderRule, 
  BatchProgress, 
  ScriptBundle, 
  AuditRecord,
  InventoryItemGroup,
  ImageEditRevision,
  DuplicateCandidate
} from '../types/index.ts';
import { logger } from '../services/logger.ts';
import { INITIAL_SAMPLE_ITEMS, INITIAL_SAMPLE_GROUPS } from '../utils/sampleData.ts';
import { autoGroupInventoryItems, detectDuplicates } from '../lib/groupingAndDedup.ts';
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

  // Intelligent Item Grouping
  itemGroups: InventoryItemGroup[];
  setItemGroups: React.Dispatch<React.SetStateAction<InventoryItemGroup[]>>;
  updateItemGroup: (id: string, updates: Partial<InventoryItemGroup>) => void;
  deleteItemGroup: (id: string) => void;
  createItemGroup: (title: string, category: string, imageIds: string[]) => InventoryItemGroup;
  autoGroupAllItems: () => void;

  // Deduplication
  duplicateCandidates: DuplicateCandidate[];
  refreshDuplicates: () => void;
  resolveDuplicateCandidate: (id: string, action: 'merge' | 'keep_both' | 'assign_view' | 'discard') => void;

  // Reversible Image Editor
  editingImage: ImageItem | null;
  setEditingImage: (item: ImageItem | null) => void;
  saveImageRevision: (imageId: string, revision: ImageEditRevision) => void;

  // Social Media Marketing
  marketingModalItem: ImageItem | null;
  setMarketingModalItem: (item: ImageItem | null) => void;

  // Active View Tab
  activeTab: 'dashboard' | 'analyzer' | 'grouping' | 'duplicates' | 'rename-preview' | 'folder-builder' | 'ebay-studio' | 'collectibles' | 'plugins' | 'ai-chat' | 'sync-scripts' | 'database-schema' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'analyzer' | 'grouping' | 'duplicates' | 'rename-preview' | 'folder-builder' | 'ebay-studio' | 'collectibles' | 'plugins' | 'ai-chat' | 'sync-scripts' | 'database-schema' | 'settings') => void;

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

  // Intelligent Item Groups
  const [itemGroups, setItemGroups] = useState<InventoryItemGroup[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_groups');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_SAMPLE_GROUPS;
  });

  // Duplicate candidates
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_dups');
      if (saved) return JSON.parse(saved);
    } catch {}
    return detectDuplicates(INITIAL_SAMPLE_ITEMS);
  });

  // Reversible Image Editor State
  const [editingImage, setEditingImage] = useState<ImageItem | null>(null);

  // Social Media Marketing Modal State
  const [marketingModalItem, setMarketingModalItem] = useState<ImageItem | null>(null);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + '_items', JSON.stringify(items));
    } catch {}
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + '_groups', JSON.stringify(itemGroups));
    } catch {}
  }, [itemGroups]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + '_dups', JSON.stringify(duplicateCandidates));
    } catch {}
  }, [duplicateCandidates]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + '_audit', JSON.stringify(auditLogs));
    } catch {}
  }, [auditLogs]);

  // Methods for Item Groups
  const updateItemGroup = (id: string, updates: Partial<InventoryItemGroup>) => {
    setItemGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g));
  };

  const deleteItemGroup = (id: string) => {
    setItemGroups(prev => prev.filter(g => g.id !== id));
    // Clear groupId on items
    setItems(prev => prev.map(it => it.groupId === id ? { ...it, groupId: undefined } : it));
  };

  const createItemGroup = (title: string, category: string, imageIds: string[]): InventoryItemGroup => {
    const primaryId = imageIds[0] || '';
    const newGroup: InventoryItemGroup = {
      id: `group-manual-${Date.now()}`,
      title,
      category,
      primaryImageId: primaryId,
      imageAssignments: imageIds.map((id, idx) => ({
        imageId: id,
        role: idx === 0 ? 'front' : idx === 1 ? 'rear' : 'other',
        order: idx,
        includedInEbayDraft: true,
      })),
      confidenceScore: 100,
      autoGrouped: false,
      status: 'grouped',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setItemGroups(prev => [newGroup, ...prev]);
    setItems(prev => prev.map(it => imageIds.includes(it.id) ? { ...it, groupId: newGroup.id } : it));
    return newGroup;
  };

  const autoGroupAllItems = () => {
    const result = autoGroupInventoryItems(items, itemGroups);
    setItemGroups(result.groups);
    // Link items
    const groupMap = new Map<string, string>();
    for (const g of result.groups) {
      for (const a of g.imageAssignments) {
        groupMap.set(a.imageId, g.id);
      }
    }
    setItems(prev => prev.map(it => groupMap.has(it.id) ? { ...it, groupId: groupMap.get(it.id) } : it));
  };

  // Methods for Duplicates
  const refreshDuplicates = () => {
    const dups = detectDuplicates(items);
    setDuplicateCandidates(dups);
  };

  const resolveDuplicateCandidate = (id: string, action: 'merge' | 'keep_both' | 'assign_view' | 'discard') => {
    const cand = duplicateCandidates.find(c => c.id === id);
    if (!cand) return;

    if (action === 'merge') {
      // Point duplicate references to original and delete duplicate image
      setItems(prev => prev.filter(it => it.id !== cand.duplicateImageId));
    } else if (action === 'assign_view') {
      // Find original's group and attach duplicate as an extra view
      const origItem = items.find(it => it.id === cand.originalImageId);
      if (origItem?.groupId) {
        setItemGroups(prev => prev.map(g => {
          if (g.id === origItem.groupId) {
            return {
              ...g,
              imageAssignments: [
                ...g.imageAssignments,
                { imageId: cand.duplicateImageId, role: 'surface_detail', order: g.imageAssignments.length, includedInEbayDraft: false }
              ]
            };
          }
          return g;
        }));
      }
    }

    setDuplicateCandidates(prev => prev.map(c => c.id === id ? {
      ...c,
      status: action === 'merge' ? 'resolved_merged' :
              action === 'keep_both' ? 'resolved_kept_both' :
              action === 'assign_view' ? 'resolved_assigned_view' : 'resolved_discarded'
    } : c));
  };

  // Method to save non-destructive image revision
  const saveImageRevision = (imageId: string, revision: ImageEditRevision) => {
    setItems(prev => prev.map(it => {
      if (it.id === imageId) {
        return {
          ...it,
          editRevision: revision,
          updatedAt: new Date().toISOString(),
        };
      }
      return it;
    }));
    setEditingImage(null);
  };

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
    setItems(prev => {
      const merged = [...newItems, ...prev];
      setTimeout(() => {
        setDuplicateCandidates(detectDuplicates(merged));
      }, 50);
      return merged;
    });
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
        let base64ToSend = item.previewUrl || '';
        // If previewUrl is a blob URL (from local file picker), read blob as base64 in browser
        if (base64ToSend.startsWith('blob:')) {
          try {
            const blobRes = await fetch(base64ToSend);
            const blobData = await blobRes.blob();
            base64ToSend = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blobData);
            });
          } catch (e) {
            console.warn('Could not read blob as base64 data URL:', e);
          }
        }

        const opId = logger.generateId('batch-ai');
        logger.info('Gemini Vision', 'batch_analyze_item_start', `Analyzing item ${item.originalName} (${i + 1}/${unanalyzed.length})`, {
          operationId: opId,
          details: { itemId: item.id, mimeType: item.mimeType },
        });

        const assetId = item.id.replace(/^(drive|photos)-/, '');

        const response = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Requested-With': 'ebay-hero'
          },
          body: JSON.stringify({
            imageBase64: base64ToSend,
            assetId,
            mimeType: item.mimeType,
            originalFilename: item.originalName,
            provider: aiSettings.provider,
            model: aiSettings.provider === 'gemini' ? aiSettings.geminiModel : aiSettings.localModelName,
            enableThinking: aiSettings.enableThinking,
          }),
        });

        if (response.ok) {
          const analysis = await response.json();
          const proposedName = analysis.proposedFilename || analysis.suggestedFilename || item.originalName;
          const proposedFolder = analysis.proposedRelativeFolder || analysis.suggestedFolder || 'Inventory/Collectibles';

          updateItem(item.id, {
            status: 'approved',
            confidence: analysis.confidenceScore || 85,
            proposedName,
            proposedFolder,
            analysis,
            ebayDraft: analysis.ebayDraft,
          });

          logger.info('Gemini Vision', 'batch_analyze_item_success', `Analysis succeeded for ${item.originalName}`, {
            operationId: opId,
            details: {
              category: analysis.category,
              proposedName,
              hasEbayDraft: Boolean(analysis.ebayDraft),
            },
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
              newName: proposedName,
              originalPath: item.originalPath,
              newPath: proposedFolder,
              status: 'success',
              performedBy: `Gemini Vision (${aiSettings.geminiModel})`,
            },
            ...prev,
          ]);
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server returned HTTP ${response.status}`);
        }
      } catch (err: any) {
        logger.error('Gemini Vision', 'batch_analyze_item_failed', `Failed analyzing ${item.originalName}: ${err.message}`, {
          details: { error: err.message, itemId: item.id },
        });

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
        itemGroups,
        setItemGroups,
        updateItemGroup,
        deleteItemGroup,
        createItemGroup,
        autoGroupAllItems,
        duplicateCandidates,
        refreshDuplicates,
        resolveDuplicateCandidate,
        editingImage,
        setEditingImage,
        saveImageRevision,
        marketingModalItem,
        setMarketingModalItem,
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
