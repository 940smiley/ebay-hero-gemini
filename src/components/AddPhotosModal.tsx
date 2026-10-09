import React, { useState } from 'react';
import { 
  X, 
  HardDrive, 
  Image as ImageIcon, 
  Laptop, 
  Plus, 
  ChevronRight, 
  ArrowLeft,
  FolderTree,
  UploadCloud,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { GoogleDrivePicker } from './pickers/GoogleDrivePicker.tsx';
import { GooglePhotosPicker } from './pickers/GooglePhotosPicker.tsx';
import { LocalFilePicker } from './pickers/LocalFilePicker.tsx';
import { ImageItem } from '../types/index.ts';

interface AddPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type ImportSourceType = 'google_drive' | 'google_photos' | 'local_upload';

export const AddPhotosModal: React.FC<AddPhotosModalProps> = ({ isOpen, onClose }) => {
  const { addItems } = useApp();
  const [activeSource, setActiveSource] = useState<ImportSourceType | null>(null);

  if (!isOpen) return null;

  const handleImportComplete = (items: ImageItem[]) => {
    if (items.length > 0) {
      addItems(items);
    }
    setActiveSource(null);
    onClose();
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
                {activeSource && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 font-semibold border border-slate-700 uppercase">
                    {activeSource === 'google_drive' ? 'Google Drive' :
                     activeSource === 'google_photos' ? 'Google Photos' : 'Local Computer & Storage'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {activeSource === 'google_drive'
                  ? 'Browsing official Google Drive structure: My Drive, Shared Drives, and Shared With Me'
                  : activeSource === 'google_photos'
                  ? 'Selecting media directly via the official Google Photos Picker API'
                  : activeSource === 'local_upload'
                  ? 'Importing local files, drag-and-drop batches, or recursive PC directories'
                  : 'Independent import workflows: each source maintains its own appropriate integration and permissions.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {activeSource && (
              <button
                onClick={() => setActiveSource(null)}
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

        {/* Source Selection Screen */}
        {!activeSource ? (
          <div className="flex-1 overflow-y-auto p-8 space-y-8 flex flex-col justify-center">
            <div className="text-center max-w-lg mx-auto space-y-2">
              <h4 className="text-xl font-extrabold text-white">Select Photo Storage Source</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose where your collectibles photos reside. Sources are kept strictly separate so you never see unrelated directories or random folders.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full pt-2">
              {/* 1. Google Drive Card */}
              <div
                onClick={() => setActiveSource('google_drive')}
                className="p-6 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group flex flex-col justify-between space-y-5 shadow-lg relative overflow-hidden"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-semibold border border-blue-500/20">
                      Google Drive API
                    </span>
                  </div>
                  <div>
                    <h5 className="font-extrabold text-base text-white group-hover:text-blue-300">Google Drive</h5>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Hierarchical cloud drive browsing:
                    </p>
                    <ul className="text-[11px] text-slate-400 mt-2 space-y-1 font-mono">
                      <li className="flex items-center gap-1.5 text-blue-300">
                        <span className="text-slate-600">•</span> My Drive & Nested Folders
                      </li>
                      <li className="flex items-center gap-1.5 text-blue-300">
                        <span className="text-slate-600">•</span> Shared Drives & Shared with Me
                      </li>
                      <li className="flex items-center gap-1.5 text-blue-300">
                        <span className="text-slate-600">•</span> True Recursive Directory Select All
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
                onClick={() => setActiveSource('google_photos')}
                className="p-6 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer group flex flex-col justify-between space-y-5 shadow-lg relative overflow-hidden"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
                      Photos Picker API
                    </span>
                  </div>
                  <div>
                    <h5 className="font-extrabold text-base text-white group-hover:text-amber-300">Google Photos</h5>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Select approved images via Google's secure picker:
                    </p>
                    <ul className="text-[11px] text-slate-400 mt-2 space-y-1 font-mono">
                      <li className="flex items-center gap-1.5 text-amber-300">
                        <span className="text-slate-600">•</span> Official Google Picker window
                      </li>
                      <li className="flex items-center gap-1.5 text-amber-300">
                        <span className="text-slate-600">•</span> High-res photo & scan imports
                      </li>
                      <li className="flex items-center gap-1.5 text-amber-300">
                        <span className="text-slate-600">•</span> Ingests original quality bytes
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-amber-400 font-semibold">
                  <span>Open Photos Selection</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* 3. Local Computer & Desktop Sync Card */}
              <div
                onClick={() => setActiveSource('local_upload')}
                className="p-6 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col justify-between space-y-5 shadow-lg relative overflow-hidden"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                      <Laptop className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20">
                      Local Filesystem
                    </span>
                  </div>
                  <div>
                    <h5 className="font-extrabold text-base text-white group-hover:text-emerald-300">Local Computer & Disks</h5>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Import local folders directly from your PC:
                    </p>
                    <ul className="text-[11px] text-slate-400 mt-2 space-y-1 font-mono">
                      <li className="flex items-center gap-1.5 text-emerald-300 font-bold">
                        <span className="text-slate-600">•</span> Entire Folder Import (Recursive)
                      </li>
                      <li className="flex items-center gap-1.5 text-emerald-300">
                        <span className="text-slate-600">•</span> Drag & Drop Multiple Photos
                      </li>
                      <li className="flex items-center gap-1.5 text-emerald-300">
                        <span className="text-slate-600">•</span> JPG, PNG, WEBP, HEIC, TIFF, RAW
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400 font-semibold">
                  <span>Browse Local Storage</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Active Source Implementation */
          <div className="flex-1 flex overflow-hidden">
            {activeSource === 'google_drive' && (
              <GoogleDrivePicker
                onImportComplete={handleImportComplete}
                onCancel={() => setActiveSource(null)}
              />
            )}
            {activeSource === 'google_photos' && (
              <GooglePhotosPicker
                onImportComplete={handleImportComplete}
                onCancel={() => setActiveSource(null)}
              />
            )}
            {activeSource === 'local_upload' && (
              <LocalFilePicker
                onImportComplete={handleImportComplete}
                onCancel={() => setActiveSource(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
