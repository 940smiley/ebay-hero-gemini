import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { 
  FolderTree, 
  Folder, 
  FolderOpen, 
  File, 
  Settings2, 
  Check, 
  Sparkles, 
  ChevronRight, 
  ChevronDown,
  Layers,
  ArrowRight
} from 'lucide-react';

export const FolderBuilderView: React.FC = () => {
  const { items, folderRule, updateFolderRule, driveConfig, updateItem } = useApp();

  const [customPattern, setCustomPattern] = useState(folderRule.pattern);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // Build tree data structure from items
  interface TreeNode {
    name: string;
    fullPath: string;
    children: Record<string, TreeNode>;
    files: Array<{ id: string; name: string; size: number }>;
  }

  const rootNode: TreeNode = {
    name: 'Inventory Root',
    fullPath: driveConfig.activePath,
    children: {},
    files: [],
  };

  items.forEach((item) => {
    const parts = (item.proposedFolder || 'Inventory/Uncategorized').split('/').filter(Boolean);
    let current = rootNode;

    parts.forEach((part, index) => {
      const currentPath = parts.slice(0, index + 1).join('/');
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          fullPath: `${driveConfig.activePath}/${currentPath}`,
          children: {},
          files: [],
        };
      }
      current = current.children[part];
    });

    current.files.push({
      id: item.id,
      name: item.proposedName,
      size: item.fileSize,
    });
  });

  const toggleFolder = (path: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const applyCustomPatternToAll = () => {
    updateFolderRule({ pattern: customPattern });
    items.forEach((item) => {
      if (!item.analysis) return;
      const cat = item.analysis.category || 'Collectibles';
      const sub = item.analysis.subcategory || 'General';
      const year = item.analysis.yearOrEra || 'Vintage';
      
      let newFolder = customPattern
        .replace('{Category}', cat)
        .replace('{Subcategory}', sub)
        .replace('{Year}', year)
        .replace(/\s+/g, ' ');

      updateItem(item.id, { proposedFolder: newFolder });
    });
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isCollapsed = collapsedFolders.has(node.fullPath);
    const childKeys = Object.keys(node.children);
    const hasChildren = childKeys.length > 0 || node.files.length > 0;

    return (
      <div key={node.fullPath} className="space-y-1">
        <div
          onClick={() => toggleFolder(node.fullPath)}
          className={`flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-xs cursor-pointer select-none transition-colors hover:bg-slate-800/80 ${
            depth === 0 ? 'font-bold text-slate-200 bg-slate-900' : 'text-slate-300'
          }`}
          style={{ paddingLeft: `${Math.max(depth * 18, 8)}px` }}
        >
          {hasChildren ? (
            isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            )
          ) : (
            <div className="w-3.5" />
          )}

          {isCollapsed ? (
            <Folder className="w-4 h-4 text-amber-400" />
          ) : (
            <FolderOpen className="w-4 h-4 text-amber-400" />
          )}

          <span className="truncate">{node.name}</span>
          <span className="text-[10px] text-slate-500 font-mono ml-auto">
            {node.files.length > 0 ? `${node.files.length} files` : ''}
          </span>
        </div>

        {!isCollapsed && (
          <div className="space-y-1">
            {childKeys.map((k) => renderTreeNode(node.children[k], depth + 1))}

            {node.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 py-1 px-2.5 text-[11px] text-slate-400 font-mono hover:text-amber-300 transition-colors"
                style={{ paddingLeft: `${(depth + 1) * 18 + 14}px` }}
              >
                <File className="w-3 h-3 text-slate-500" />
                <span className="truncate">{file.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="pb-6 border-b border-slate-800">
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <span>Intelligent Directory Builder</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 font-semibold border border-blue-500/20">
            Hierarchy Synthesizer
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Dynamically generate and reorganize multi-tiered folder directories for sports cards, Pokemon, comics, and electronics across your Google Drive Desktop sync tree.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Rule Configurator */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-amber-400" />
              <span>Directory Hierarchy Strategy</span>
            </h3>

            {/* Pattern Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Folder Pattern Template:
              </label>
              <input
                type="text"
                value={customPattern}
                onChange={(e) => setCustomPattern(e.target.value)}
                placeholder="Inventory/{Category}/{Subcategory}/{Year}"
                className="w-full bg-slate-950 border border-slate-700 text-amber-300 font-mono text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-amber-400"
              />
              <p className="text-[11px] text-slate-500">
                Placeholders: <code className="text-amber-400 font-mono">{`{Category}`}</code>, <code className="text-amber-400 font-mono">{`{Subcategory}`}</code>, <code className="text-amber-400 font-mono">{`{Year}`}</code>
              </p>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400">Quick Presets:</span>
              <div className="space-y-1.5">
                {[
                  { label: 'Category / Subcategory', pattern: 'Inventory/{Category}/{Subcategory}' },
                  { label: 'Category / Subcategory / Era', pattern: 'Inventory/{Category}/{Subcategory}/{Year}' },
                  { label: 'By Collectible Franchise', pattern: 'Vault/{Category}/{Subcategory}' },
                  { label: 'Flat Root by Category', pattern: 'eBay_Live/{Category}' },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCustomPattern(preset.pattern)}
                    className="w-full text-left p-2 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span>{preset.label}</span>
                    <span className="text-slate-500 font-mono">{preset.pattern}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Case convention */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Case Convention:
              </label>
              <select
                value={folderRule.caseStyle}
                onChange={(e) => updateFolderRule({ caseStyle: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs px-3 py-2 rounded-lg focus:outline-none"
              >
                <option value="UPPER_SNAKE">UPPER_SNAKE_CASE (Recommended)</option>
                <option value="Title Case">Title Case / Standard Folders</option>
                <option value="kebab-case">kebab-case (Web standard)</option>
                <option value="lower_snake">lower_snake_case</option>
              </select>
            </div>

            <button
              onClick={applyCustomPatternToAll}
              className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apply Pattern to All Items</span>
            </button>
          </div>
        </div>

        {/* Right 2 Cols: Live Folder Tree Visualizer */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-400" />
              <span>Simulated Directory Tree</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Root: {driveConfig.activePath}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 font-sans min-h-[420px] max-h-[600px] overflow-y-auto">
            {renderTreeNode(rootNode, 0)}
          </div>
        </div>
      </div>
    </div>
  );
};
