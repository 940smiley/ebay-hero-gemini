/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { Header } from './components/Header.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { DashboardView } from './components/views/DashboardView.tsx';
import { BatchAnalyzerView } from './components/views/BatchAnalyzerView.tsx';
import { RenamePreviewView } from './components/views/RenamePreviewView.tsx';
import { FolderBuilderView } from './components/views/FolderBuilderView.tsx';
import { EbayStudioView } from './components/views/EbayStudioView.tsx';
import { CollectiblesVaultView } from './components/views/CollectiblesVaultView.tsx';
import { AiChatAssistantView } from './components/views/AiChatAssistantView.tsx';
import { ScriptSyncHubView } from './components/views/ScriptSyncHubView.tsx';
import { DatabaseSchemaView } from './components/views/DatabaseSchemaView.tsx';
import { SettingsView } from './components/views/SettingsView.tsx';
import { AddPhotosModal } from './components/AddPhotosModal.tsx';

const MainContent: React.FC = () => {
  const { activeTab } = useApp();

  return (
    <main className="flex-1 overflow-y-auto bg-slate-950 text-slate-100">
      {activeTab === 'dashboard' && <DashboardView />}
      {activeTab === 'analyzer' && <BatchAnalyzerView />}
      {activeTab === 'rename-preview' && <RenamePreviewView />}
      {activeTab === 'folder-builder' && <FolderBuilderView />}
      {activeTab === 'ebay-studio' && <EbayStudioView />}
      {activeTab === 'collectibles' && <CollectiblesVaultView />}
      {activeTab === 'ai-chat' && <AiChatAssistantView />}
      {activeTab === 'sync-scripts' && <ScriptSyncHubView />}
      {activeTab === 'database-schema' && <DatabaseSchemaView />}
      {activeTab === 'settings' && <SettingsView />}
    </main>
  );
};

const MainLayout: React.FC = () => {
  const { isCloudPickerOpen, setIsCloudPickerOpen } = useApp();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans selection:bg-amber-500/20 selection:text-amber-300">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainContent />
      </div>
      <AddPhotosModal
        isOpen={isCloudPickerOpen}
        onClose={() => setIsCloudPickerOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
