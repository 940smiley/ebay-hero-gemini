import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Image as ImageIcon, 
  ExternalLink, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  Check, 
  Info, 
  X,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { apiRequest, streamNdjson } from '../../services/api.ts';
import { ImageItem } from '../../types/index.ts';
import { logger } from '../../services/logger.ts';

interface PickedPhotoItem {
  id: string;
  type: string;
  filename: string | null;
  filenameAvailable: boolean;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  createTime: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
}

interface PickerSession {
  id: string;
  pickerUri: string;
  pollIntervalMs: number;
  timeoutMs: number;
  mediaItemsSet: boolean;
  itemCount?: number | null;
}

interface GoogleAccountStatus {
  configured: boolean;
  activeAccountId: string | null;
  accounts: Array<{
    id: string;
    email: string;
    photos: boolean;
    active: boolean;
  }>;
}

interface GooglePhotosPickerProps {
  onImportComplete: (items: ImageItem[]) => void;
  onCancel: () => void;
}

export const GooglePhotosPicker: React.FC<GooglePhotosPickerProps> = ({ onImportComplete, onCancel }) => {
  // Connection state
  const [accountStatus, setAccountStatus] = useState<GoogleAccountStatus | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Picker session state
  const [session, setSession] = useState<PickerSession | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isWaitingForGoogle, setIsWaitingForGoogle] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [windowClosedPrompt, setWindowClosedPrompt] = useState(false);
  const [pickedItems, setPickedItems] = useState<PickedPhotoItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    currentName: string;
    importedCount: number;
    duplicateCount: number;
    failedCount: number;
  }>({
    current: 0,
    total: 0,
    currentName: '',
    importedCount: 0,
    duplicateCount: 0,
    failedCount: 0,
  });

  const activeSessionIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<any>(null);
  const popupRef = useRef<Window | null>(null);
  const popupWatcherRef = useRef<any>(null);
  const importedItemsRef = useRef<ImageItem[]>([]);

  // Check Google Photos connection status on mount
  const checkGoogleConnection = useCallback(async () => {
    setCheckingAuth(true);
    try {
      const status = await apiRequest<GoogleAccountStatus>('/api/google/status');
      setAccountStatus(status);
    } catch (e: any) {
      console.warn('Could not check Google status:', e);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkGoogleConnection();

    // Listen for OAuth completion from popup
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ebay-hero-google') {
        checkGoogleConnection();
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [checkGoogleConnection]);

  // Clean up session and timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (popupWatcherRef.current) clearInterval(popupWatcherRef.current);
      const sid = activeSessionIdRef.current;
      if (sid && !importedItemsRef.current.length) {
        apiRequest(`/api/google/photos/session/${sid}`, { method: 'DELETE' }).catch(() => {});
      }
    };
  }, []);

  const activeAccount = accountStatus?.accounts.find(a => a.active);
  const hasPhotosPermission = activeAccount?.photos ?? false;

  // Launch OAuth connection popup for Google Photos
  const handleConnectPhotos = () => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(
      '/api/google/oauth/start?service=photos',
      'ebay-hero-google-oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
  };

  // Check active session status
  const checkSessionStatus = useCallback(async (sessionId: string, isManual = false) => {
    if (isManual) {
      setCheckingStatus(true);
      setStatusMessage(null);
    }
    logger.debug('Google Photos', 'session_status_check', `Checking session status for ${sessionId}`, {
      operationId: sessionId,
      action: isManual ? 'manual_check' : 'poll_tick',
    });

    try {
      const s = await apiRequest<PickerSession>(`/api/google/photos/session/${sessionId}`);
      setSession(s);

      if (s.mediaItemsSet) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        if (popupWatcherRef.current) clearInterval(popupWatcherRef.current);
        popupWatcherRef.current = null;
        setIsWaitingForGoogle(false);
        setWindowClosedPrompt(false);
        setStatusMessage(null);
        logger.info('Google Photos', 'media_items_ready', `User completed selection in Google Photos for session ${sessionId}`, {
          operationId: sessionId,
          details: { itemCount: s.itemCount },
        });
        await loadPickedItems(sessionId);
        return true;
      }

      if (isManual) {
        setStatusMessage('Google Photos indicates items have not been confirmed yet. If you selected photos and clicked Done, please wait a moment and click Check Status again. Or click Reopen Window.');
        setIsWaitingForGoogle(false);
        setWindowClosedPrompt(true);
      }
      return false;
    } catch (e: any) {
      logger.warn('Google Photos', 'session_check_warning', `Session check returned: ${e.message}`, {
        operationId: sessionId,
        details: { error: e.message, status: e.status },
      });
      if (isManual) {
        if (e.status === 404 || e.message?.includes('expired') || e.message?.includes('not found')) {
          setStatusMessage('The previous Google Photos session has expired. Click Reopen Google Photos to create a fresh session.');
        } else {
          setStatusMessage(`Could not verify status: ${e.message}`);
        }
        setIsWaitingForGoogle(false);
        setWindowClosedPrompt(true);
      }
      return false;
    } finally {
      if (isManual) {
        setCheckingStatus(false);
      }
    }
  }, []);

  // Poll for user selection in Google Photos
  const startPolling = useCallback((sessionId: string, intervalMs: number) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setIsWaitingForGoogle(true);
    setWindowClosedPrompt(false);
    setStatusMessage(null);

    const pollInterval = Math.max(intervalMs, 2000);
    pollTimerRef.current = setInterval(async () => {
      const finished = await checkSessionStatus(sessionId, false);
      if (finished) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }, pollInterval);

    // Watch for popup window closing
    if (popupWatcherRef.current) clearInterval(popupWatcherRef.current);
    popupWatcherRef.current = setInterval(async () => {
      if (popupRef.current && popupRef.current.closed) {
        clearInterval(popupWatcherRef.current);
        popupWatcherRef.current = null;
        popupRef.current = null;
        logger.info('Google Photos', 'popup_window_closed', `Picker popup closed for session ${sessionId}. Verifying selection state...`, {
          operationId: sessionId,
        });

        // The popup closed. Check immediately, then retry with backoff
        const finishedNow = await checkSessionStatus(sessionId, false);
        if (!finishedNow) {
          setTimeout(async () => {
            const finished2 = await checkSessionStatus(sessionId, false);
            if (!finished2) {
              setTimeout(async () => {
                const finished3 = await checkSessionStatus(sessionId, false);
                if (!finished3) {
                  // After retries, stop the indefinite waiting spinner and prompt the user cleanly
                  setIsWaitingForGoogle(false);
                  setWindowClosedPrompt(true);
                  setStatusMessage('Selection window was closed. If you selected photos and clicked Done, click Check for Selected Photos below. Or click Reopen Google Photos to start again.');
                  logger.info('Google Photos', 'popup_closed_unconfirmed', 'Popup closed without immediate media confirmation. Awaiting user action.', {
                    operationId: sessionId,
                  });
                }
              }, 2500);
            }
          }, 1200);
        }
      }
    }, 600);
  }, [checkSessionStatus]);

  // Window focus listener: if user comes back to our tab, check status
  useEffect(() => {
    const handleFocus = () => {
      const sid = activeSessionIdRef.current;
      if (sid && isWaitingForGoogle) {
        checkSessionStatus(sid, false);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isWaitingForGoogle, checkSessionStatus]);

  // Create Google Photos Picker Session & Launch Google UI
  const launchGooglePhotosPicker = async () => {
    setIsCreatingSession(true);
    setError(null);
    setStatusMessage(null);
    setWindowClosedPrompt(false);
    const opId = logger.generateId('photos-launch');

    try {
      logger.info('Google Photos', 'create_session_request', 'Creating Google Photos Picker session via API', { operationId: opId });
      const newSession = await apiRequest<PickerSession>('/api/google/photos/session', {
        method: 'POST',
        body: JSON.stringify({ maxItemCount: 500 }),
      });
      setSession(newSession);
      activeSessionIdRef.current = newSession.id;

      logger.info('Google Photos', 'session_created', `Picker session initialized with ID: ${newSession.id}`, {
        operationId: newSession.id,
        details: { pickerUri: newSession.pickerUri, pollIntervalMs: newSession.pollIntervalMs },
      });

      // Open Google's Picker Dialog in a popup
      const width = 840;
      const height = 760;
      const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
      const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
      const popup = window.open(
        newSession.pickerUri,
        'google-photos-picker',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,status=no`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        setError('The Google Photos selection window was blocked by your browser. Please allow popups for this site and click Retry.');
        setIsCreatingSession(false);
        logger.warn('Google Photos', 'popup_blocked', 'Browser blocked Google Photos popup window', { operationId: newSession.id });
        return;
      }

      popupRef.current = popup;
      startPolling(newSession.id, newSession.pollIntervalMs || 3000);
    } catch (err: any) {
      if (err.code === 'scope_missing' || err.message?.includes('Permission not granted')) {
        setError('Google Photos permission has not been granted yet. Please click Connect Google Photos below.');
      } else {
        setError(err.message || 'Failed to start Google Photos Picker session');
      }
      logger.error('Google Photos', 'create_session_failed', `Failed to initialize session: ${err.message}`, {
        operationId: opId,
        details: { error: err.message },
      });
    } finally {
      setIsCreatingSession(false);
    }
  };

  const reopenPickerWindow = () => {
    // If no session exists or status message indicates expiration, start a fresh session
    if (!session?.pickerUri || statusMessage?.includes('expired') || !activeSessionIdRef.current) {
      launchGooglePhotosPicker();
      return;
    }
    const width = 840;
    const height = 760;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const popup = window.open(
      session.pickerUri,
      'google-photos-picker',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,status=no`
    );
    popupRef.current = popup;
    setWindowClosedPrompt(false);
    setStatusMessage(null);
    startPolling(session.id, session.pollIntervalMs || 3000);
  };

  const loadPickedItems = async (sessionId: string) => {
    setLoadingItems(true);
    setError(null);
    try {
      const res = await apiRequest<{ items: PickedPhotoItem[] }>(`/api/google/photos/session/${sessionId}/items?refresh=true`);
      const items = res.items || [];
      setPickedItems(items);
      setSelectedIds(new Set(items.map(i => i.id)));
      if (items.length === 0) {
        setError('No photos were returned by Google Photos for this session. Please reopen and select one or more photos.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve selected photos from Google Photos');
    } finally {
      setLoadingItems(false);
    }
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
    setSelectedIds(new Set(pickedItems.map(i => i.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Execute Import
  const handleImport = async () => {
    if (!session?.id || selectedIds.size === 0) return;
    setIsImporting(true);
    setError(null);
    const importedItems: ImageItem[] = [];
    importedItemsRef.current = importedItems;

    const lastErrorDetails: Array<{ name?: string; message: string; code?: string; opId?: string }> = [];

    try {
      await streamNdjson(
        `/api/google/photos/session/${session.id}/import`,
        { itemIds: Array.from(selectedIds) },
        (event) => {
          if (event.type === 'start') {
            setImportProgress({
              current: 0,
              total: selectedIds.size,
              currentName: 'Starting import...',
              importedCount: 0,
              duplicateCount: 0,
              failedCount: 0,
            });
          } else if (event.type === 'item') {
            setImportProgress(prev => ({
              ...prev,
              current: prev.current + 1,
              currentName: event.item.originalName,
              importedCount: prev.importedCount + 1,
            }));
            importedItems.push({
              id: `photos-${event.item.id}`,
              originalName: event.item.originalName,
              originalPath: `Google Photos/${event.item.originalName}`,
              fileSize: event.item.size,
              mimeType: event.item.mimeType,
              previewUrl: event.item.url,
              proposedName: event.item.originalName,
              proposedFolder: 'Inventory/Google Photos',
              status: 'pending',
              confidence: 0,
              sourceType: 'google_photos',
              sourceLocation: 'Google Photos Library',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else if (event.type === 'skip') {
            setImportProgress(prev => ({
              ...prev,
              current: prev.current + 1,
              duplicateCount: prev.duplicateCount + 1,
            }));
          } else if (event.type === 'error') {
            setImportProgress(prev => ({
              ...prev,
              failedCount: prev.failedCount + 1,
            }));
            lastErrorDetails.push({
              name: event.name,
              message: event.message,
              code: event.code,
              opId: event.opId,
            });
            logger.error('Google Photos', 'item_import_failed', `Failed to import ${event.name || 'item'}: ${event.message}`, {
              operationId: event.opId || session.id,
              details: { name: event.name, code: event.code, error: event.message },
            });
          } else if (event.type === 'done') {
            if (importedItems.length > 0) {
              onImportComplete(importedItems);
            } else {
              const firstErr = lastErrorDetails[0];
              const msg = firstErr ? `${firstErr.name ? `"${firstErr.name}": ` : ''}${firstErr.message}` : 'Import finished but no valid image files could be imported.';
              setError(`Import failed: ${msg}`);
            }
          }
        }
      );
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancelSession = async () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (popupWatcherRef.current) {
      clearInterval(popupWatcherRef.current);
      popupWatcherRef.current = null;
    }
    if (popupRef.current && !popupRef.current.closed) {
      try { popupRef.current.close(); } catch {}
      popupRef.current = null;
    }
    const sid = session?.id || activeSessionIdRef.current;
    if (sid) {
      try {
        await apiRequest(`/api/google/photos/session/${sid}`, { method: 'DELETE' });
        logger.info('Google Photos', 'session_cancelled', `Deleted session ${sid} on server`, { operationId: sid });
      } catch (e) {
        console.warn('Session delete warning:', e);
      }
    }
    setSession(null);
    activeSessionIdRef.current = null;
    setPickedItems([]);
    setSelectedIds(new Set());
    setIsWaitingForGoogle(false);
    setCheckingStatus(false);
    setStatusMessage(null);
    setWindowClosedPrompt(false);
    setError(null);
  };

  // Render Auth requirement screen if Photos permission is missing
  if (!checkingAuth && (!activeAccount || !hasPhotosPermission)) {
    return (
      <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
        <div className="p-4 px-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white text-xs">Google Photos Connection Required</span>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h4 className="text-lg font-bold text-white">Google Photos Access Required</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              To import collectible images directly from Google Photos, eBay Hero needs read access via the official Google Photos Picker API.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-2.5 w-full text-xs text-slate-300">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Official, Zero-Storage Permissions</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Google Photos Picker only gives eBay Hero access to the photos you explicitly select and approve in Google's picker dialog.
            </p>
          </div>

          <button
            onClick={handleConnectPhotos}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Connect Google Account for Photos</span>
          </button>

          <button
            onClick={checkGoogleConnection}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check Connection Status Again</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
      {/* Informational Header */}
      <div className="p-4 px-6 bg-slate-950 border-b border-slate-800 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-white">Google Photos Selection Workflow</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
            Official Picker API
          </span>
          {activeAccount && (
            <span className="text-[11px] text-slate-400 font-mono ml-2 truncate max-w-[200px]">
              {activeAccount.email}
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <span>Select photos inside Google's secure popup window. Click "Done" when finished.</span>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-200 cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 1. Launch & Waiting Card */}
        {pickedItems.length === 0 && !loadingItems && (
          <div className="max-w-xl mx-auto py-10 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <ImageIcon className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h4 className="text-lg font-bold text-white">Select Collectibles Photos from Google Photos</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Clicking the button below will open Google Photos in a secure popup window. Browse your albums, search for cards or stamps, select up to 500 images, and click <strong>Done</strong>. Your approved selections will appear here automatically.
              </p>
            </div>

            {/* Launch or Waiting Button */}
            <div className="pt-2 flex flex-col items-center gap-3">
              <button
                onClick={launchGooglePhotosPicker}
                disabled={isCreatingSession || isWaitingForGoogle}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-extrabold text-xs inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
              >
                {isWaitingForGoogle ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Waiting for Selection in Google Photos...</span>
                  </>
                ) : isCreatingSession ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Opening Google Photos...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    <span>Open Google Photos Selection Window</span>
                  </>
                )}
              </button>

              {isWaitingForGoogle && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 max-w-md w-full space-y-3 mt-2 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Google Photos Window is Open
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Listening
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Choose photos in Google Photos, then click <strong>Done</strong>. When the popup closes, eBay Hero will automatically fetch your items.
                  </p>

                  {statusMessage && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                      {statusMessage}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <button
                      onClick={() => session && checkSessionStatus(session.id, true)}
                      disabled={checkingStatus}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-50 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${checkingStatus ? 'animate-spin' : ''}`} />
                      <span>{checkingStatus ? 'Checking Google...' : 'Check Status Now'}</span>
                    </button>
                    <button
                      onClick={reopenPickerWindow}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Reopen Window
                    </button>
                    <button
                      onClick={handleCancelSession}
                      className="text-slate-400 hover:text-white text-xs ml-auto cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Window Closed Prompt Banner */}
              {windowClosedPrompt && !isWaitingForGoogle && (
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 max-w-md w-full space-y-2.5 mt-2 text-left">
                  <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
                    <Info className="w-4 h-4" />
                    <span>Selection Window Closed</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Did you finish choosing photos and click Done? Click below to retrieve your photos or reopen the selection window.
                  </p>

                  {statusMessage && (
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-blue-500/30 text-[11px] text-blue-200">
                      {statusMessage}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <button
                      onClick={() => session && checkSessionStatus(session.id, true)}
                      disabled={checkingStatus}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${checkingStatus ? 'animate-spin' : ''}`} />
                      <span>{checkingStatus ? 'Checking Google...' : 'Check for Selected Photos'}</span>
                    </button>
                    <button
                      onClick={reopenPickerWindow}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Reopen Google Photos
                    </button>
                    <button
                      onClick={launchGooglePhotosPicker}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                    >
                      Start Fresh
                    </button>
                    <button
                      onClick={handleCancelSession}
                      className="text-slate-400 hover:text-white text-xs ml-auto cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading Selected Photos */}
        {loadingItems && (
          <div className="py-20 text-center space-y-4">
            <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <h5 className="font-bold text-white text-sm">Retrieving Selected Photos from Google Photos...</h5>
            <p className="text-xs text-slate-400">Loading metadata and thumbnails for approved items</p>
          </div>
        )}

        {/* 2. Selected Photos Grid Preview */}
        {pickedItems.length > 0 && !loadingItems && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Selected Photos from Google Photos ({pickedItems.length})</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    Ready to Import
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Select which photos to import into your inventory and image library.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                >
                  Select All ({pickedItems.length})
                </button>
                <button
                  onClick={handleClearSelection}
                  className="text-slate-400 hover:text-white text-xs underline cursor-pointer px-2"
                >
                  Clear Selection
                </button>
                <button
                  onClick={reopenPickerWindow}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Choose Different Photos</span>
                </button>
              </div>
            </div>

            {/* Grid of photos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {pickedItems.map((photo) => {
                const selected = selectedIds.has(photo.id);
                const thumbUrl = session ? `/api/google/photos/session/${session.id}/thumb/${photo.id}?size=256` : '';

                return (
                  <div
                    key={photo.id}
                    onClick={() => toggleSelect(photo.id)}
                    className={`rounded-xl border overflow-hidden p-2 bg-slate-950 cursor-pointer transition-all flex flex-col justify-between ${
                      selected
                        ? 'border-amber-500 ring-2 ring-amber-500/40 bg-amber-500/5 shadow-md'
                        : 'border-slate-800 hover:border-slate-700 opacity-70'
                    }`}
                  >
                    <div className="h-28 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center relative">
                      {thumbUrl && (
                        <img
                          src={thumbUrl}
                          alt={photo.filename || 'Photo'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="absolute top-2 left-2">
                        <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                          selected ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'bg-slate-950/80 border border-slate-700 text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 space-y-0.5 text-[11px]">
                      <p className="font-semibold text-slate-200 truncate" title={photo.filename || photo.id}>
                        {photo.filename || `Photo ${photo.id.slice(0, 8)}`}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        {photo.width && photo.height ? (
                          <span>{photo.width} × {photo.height}</span>
                        ) : (
                          <span>Photo</span>
                        )}
                        {photo.cameraMake && (
                          <span className="truncate max-w-[60px]" title={photo.cameraMake}>{photo.cameraMake}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Real-time Import Progress Bar */}
        {isImporting && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>Importing High-Res Collectible Photos...</span>
              </span>
              <span className="font-mono text-amber-400">
                {importProgress.current} / {importProgress.total}
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-200 rounded-full"
                style={{ width: `${Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate max-w-sm font-mono text-slate-300">
                {importProgress.currentName || 'Processing...'}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400">Imported: {importProgress.importedCount}</span>
                {importProgress.duplicateCount > 0 && (
                  <span className="text-blue-400">Duplicates/Skipped: {importProgress.duplicateCount}</span>
                )}
                {importProgress.failedCount > 0 && (
                  <span className="text-rose-400">Failed: {importProgress.failedCount}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      {pickedItems.length > 0 && (
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Selected: <strong className="text-amber-400 font-mono text-sm">{selectedIds.size}</strong> of {pickedItems.length} photos to import
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCancelSession}
              disabled={isImporting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || isImporting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
            >
              {isImporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Importing ({importProgress.current}/{importProgress.total})...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 fill-current" />
                  <span>Import {selectedIds.size} Photos into Library</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
