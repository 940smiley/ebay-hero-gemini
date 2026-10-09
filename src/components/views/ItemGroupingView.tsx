import React, { useState } from 'react';
import { 
  Layers, 
  Sparkles, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Star, 
  MoveRight, 
  Image as ImageIcon, 
  Split, 
  Edit3, 
  Share2, 
  ShoppingBag,
  HelpCircle,
  Tag,
  ArrowUpDown,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { InventoryItemGroup, ImageRole, ImageItem } from '../../types/index.ts';

const ROLE_OPTIONS: Array<{ value: ImageRole; label: string; color: string }> = [
  { value: 'front', label: 'Front (Primary)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { value: 'rear', label: 'Rear / Back', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'corner', label: 'Corner Detail', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { value: 'surface_detail', label: 'Surface / Centering', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { value: 'serial_number', label: 'Cert / Serial #', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { value: 'packaging', label: 'Slab / Box / Packaging', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { value: 'defect', label: 'Flaw / Defect', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { value: 'left_side', label: 'Left Side', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'right_side', label: 'Right Side', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'top', label: 'Top Edge', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'bottom', label: 'Bottom Edge', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'text_label', label: 'Label / Text', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'other', label: 'Other View', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'unclassified', label: 'Unclassified', color: 'bg-slate-800 text-slate-400 border-slate-700' },
];

export const ItemGroupingView: React.FC = () => {
  const { 
    items, 
    itemGroups, 
    updateItemGroup, 
    deleteItemGroup, 
    createItemGroup, 
    autoGroupAllItems, 
    setEditingImage, 
    setMarketingModalItem, 
    setSelectedItemId, 
    setActiveTab 
  } = useApp();

  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState<Set<string>>(new Set());
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState('Trading Cards');
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [targetGroupIdForMove, setTargetGroupIdForMove] = useState<string>('');

  // Collect assigned item IDs
  const assignedItemIds = new Set<string>();
  itemGroups.forEach(g => g.imageAssignments.forEach(a => assignedItemIds.add(a.imageId)));

  const unassignedItems = items.filter(it => !assignedItemIds.has(it.id));

  const toggleSelectUnassigned = (id: string) => {
    setSelectedUnassignedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllUnassigned = () => {
    setSelectedUnassignedIds(new Set(unassignedItems.map(i => i.id)));
  };

  const clearSelectedUnassigned = () => {
    setSelectedUnassignedIds(new Set());
  };

  const handleCreateGroupFromSelected = () => {
    if (selectedUnassignedIds.size === 0) return;
    const firstItem = items.find(i => selectedUnassignedIds.has(i.id));
    const title = firstItem?.analysis?.productName || firstItem?.proposedName.replace(/\.[^/.]+$/, '') || 'New Collectible Item';
    const category = firstItem?.analysis?.category || 'Trading Cards';
    createItemGroup(title, category, Array.from(selectedUnassignedIds));
    setSelectedUnassignedIds(new Set());
  };

  const handleMoveSelectedToGroup = () => {
    if (!targetGroupIdForMove || selectedUnassignedIds.size === 0) return;
    const group = itemGroups.find(g => g.id === targetGroupIdForMove);
    if (!group) return;

    const newAssignments = [
      ...group.imageAssignments,
      ...Array.from(selectedUnassignedIds).map((id, idx) => ({
        imageId: id,
        role: 'other' as ImageRole,
        order: group.imageAssignments.length + idx,
        includedInEbayDraft: true,
      }))
    ];
    updateItemGroup(targetGroupIdForMove, { imageAssignments: newAssignments });
    setSelectedUnassignedIds(new Set());
    setTargetGroupIdForMove('');
  };

  const handleChangeRole = (groupId: string, imageId: string, newRole: ImageRole) => {
    const group = itemGroups.find(g => g.id === groupId);
    if (!group) return;

    const updatedAssignments = group.imageAssignments.map(a => 
      a.imageId === imageId ? { ...a, role: newRole } : a
    );

    // If made front, set as primary image
    const updates: Partial<InventoryItemGroup> = { imageAssignments: updatedAssignments };
    if (newRole === 'front') {
      updates.primaryImageId = imageId;
    }
    updateItemGroup(groupId, updates);
  };

  const handleSetPrimary = (groupId: string, imageId: string) => {
    updateItemGroup(groupId, { primaryImageId: imageId });
  };

  const handleRemoveFromGroup = (groupId: string, imageId: string) => {
    const group = itemGroups.find(g => g.id === groupId);
    if (!group) return;

    const updatedAssignments = group.imageAssignments.filter(a => a.imageId !== imageId);
    if (updatedAssignments.length === 0) {
      deleteItemGroup(groupId);
    } else {
      const primaryImageId = group.primaryImageId === imageId ? updatedAssignments[0].imageId : group.primaryImageId;
      updateItemGroup(groupId, { imageAssignments: updatedAssignments, primaryImageId });
    }
  };

  const handleLaunchInEbayStudio = (group: InventoryItemGroup) => {
    setSelectedItemId(group.primaryImageId);
    setActiveTab('ebay-studio');
  };

  const handleLaunchMarketing = (group: InventoryItemGroup) => {
    const primaryItem = items.find(i => i.id === group.primaryImageId);
    if (primaryItem) {
      setMarketingModalItem(primaryItem);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <span>Intelligent Item Grouping & Multi-View Pairing</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                  {itemGroups.length} Groups
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Pair multi-angle photos (front, rear, corners, surface, slab) of the same physical item into coherent listings.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewGroupModal(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer border border-slate-700 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Custom Group</span>
          </button>

          <button
            onClick={autoGroupAllItems}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>Auto-Group & Pair All Photos</span>
          </button>
        </div>
      </div>

      {/* Item Groups Section */}
      <div className="space-y-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span>Active Inventory Item Groups ({itemGroups.length})</span>
        </h3>

        {itemGroups.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
            <Layers className="w-12 h-12 text-slate-600 mx-auto" />
            <h4 className="font-bold text-slate-300 text-sm">No Item Groups Formed Yet</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click "Auto-Group & Pair All Photos" above to run the intelligent matching engine on your imported photos, or create a group manually from unassigned images below.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {itemGroups.map(group => {
              const primaryItem = items.find(i => i.id === group.primaryImageId);

              return (
                <div 
                  key={group.id}
                  className="rounded-2xl bg-slate-950/80 border border-slate-800 overflow-hidden shadow-lg hover:border-slate-700 transition-all"
                >
                  {/* Group Header */}
                  <div className="p-4 px-6 bg-slate-900/60 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="font-extrabold text-sm text-white">{group.title}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                          {group.category}
                        </span>
                        {group.estimatedCondition && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                            {group.estimatedCondition}
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                          {group.confidenceScore}% Match Confidence
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {group.imageAssignments.length} Multi-view Photos Attached • Primary: {primaryItem?.originalName || 'Selected'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLaunchInEbayStudio(group)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                        title="Open this item and its photos in eBay Listing Studio"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>eBay Draft</span>
                      </button>

                      <button
                        onClick={() => handleLaunchMarketing(group)}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                        title="Generate social media promotional posts for this item"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Social Marketing</span>
                      </button>

                      <button
                        onClick={() => deleteItemGroup(group.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Split group back into unassigned photos"
                      >
                        <Split className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Group Photos Carousel / Grid */}
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {group.imageAssignments.map(assignment => {
                      const image = items.find(i => i.id === assignment.imageId);
                      if (!image) return null;
                      const isPrimary = group.primaryImageId === image.id;
                      const roleConfig = ROLE_OPTIONS.find(r => r.value === assignment.role) || ROLE_OPTIONS[0];

                      return (
                        <div 
                          key={assignment.imageId}
                          className={`rounded-xl border p-3 bg-slate-900/80 transition-all flex flex-col justify-between space-y-3 ${
                            isPrimary ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Image Thumbnail */}
                          <div className="h-40 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center relative group">
                            <img 
                              src={image.previewUrl} 
                              alt={image.originalName} 
                              className="w-full h-full object-cover" 
                            />

                            {/* Badges on Thumbnail */}
                            <div className="absolute top-2 left-2 flex flex-col gap-1">
                              {isPrimary && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black shadow-md flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-current" />
                                  <span>GALLERY #1</span>
                                </span>
                              )}
                            </div>

                            {/* Quick Action Overlay */}
                            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                onClick={() => setEditingImage(image)}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer shadow-md transition-all"
                                title="Edit & Enhance Photo (Nondestructive)"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {!isPrimary && (
                                <button
                                  onClick={() => handleSetPrimary(group.id, image.id)}
                                  className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-md transition-all"
                                  title="Set as Gallery Primary Photo"
                                >
                                  <Star className="w-4 h-4 fill-current" />
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveFromGroup(group.id, image.id)}
                                className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white cursor-pointer shadow-md transition-all"
                                title="Remove from this item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Role Selector & Info */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-300 truncate max-w-[140px]" title={image.originalName}>
                                {image.originalName}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {(image.fileSize / 1024 / 1024).toFixed(1)} MB
                              </span>
                            </div>

                            {/* Role Dropdown */}
                            <div className="flex items-center gap-2">
                              <Tag className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <select
                                value={assignment.role}
                                onChange={(e) => handleChangeRole(group.id, image.id, e.target.value as ImageRole)}
                                className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 px-2.5 py-1.5 focus:border-amber-500 focus:outline-none cursor-pointer"
                              >
                                {ROLE_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unassigned Images Tray */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="space-y-1">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <span>Unassigned Photos Tray ({unassignedItems.length})</span>
            </h4>
            <p className="text-xs text-slate-400">
              Photos that have not been paired into an item group yet. Select multiple photos to create a new group or attach to an existing one.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {unassignedItems.length > 0 && (
              <>
                <button
                  onClick={selectAllUnassigned}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
                >
                  Select All
                </button>
                <button
                  onClick={clearSelectedUnassigned}
                  className="px-2 py-1.5 text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Clear
                </button>
              </>
            )}

            {selectedUnassignedIds.size > 0 && (
              <>
                <button
                  onClick={handleCreateGroupFromSelected}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/10"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Group {selectedUnassignedIds.size} Selected</span>
                </button>

                {itemGroups.length > 0 && (
                  <div className="flex items-center gap-1">
                    <select
                      value={targetGroupIdForMove}
                      onChange={(e) => setTargetGroupIdForMove(e.target.value)}
                      className="text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 px-2.5 py-1.5 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Move to existing group...</option>
                      {itemGroups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.title.slice(0, 30)}
                        </option>
                      ))}
                    </select>
                    {targetGroupIdForMove && (
                      <button
                        onClick={handleMoveSelectedToGroup}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                      >
                        Add
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {unassignedItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            All imported photos are currently paired into item groups.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {unassignedItems.map(item => {
              const selected = selectedUnassignedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelectUnassigned(item.id)}
                  className={`rounded-xl border p-2 bg-slate-950 cursor-pointer transition-all flex flex-col justify-between ${
                    selected
                      ? 'border-amber-500 ring-2 ring-amber-500/40 bg-amber-500/5'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="h-28 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center relative">
                    <img 
                      src={item.previewUrl} 
                      alt={item.originalName} 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute top-2 left-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${
                        selected ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-950/80 border border-slate-700 text-transparent'
                      }`}>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 space-y-0.5 text-[11px]">
                    <p className="font-semibold text-slate-200 truncate" title={item.originalName}>
                      {item.originalName}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {item.analysis?.productName || item.proposedFolder}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Custom Group Modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <h4 className="text-base font-bold text-white">Create New Collectible Group</h4>
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Item Title</label>
                <input
                  type="text"
                  value={newGroupTitle}
                  onChange={(e) => setNewGroupTitle(e.target.value)}
                  placeholder="e.g. 1999 Base Set Blastoise Holo Rare"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Category</label>
                <input
                  type="text"
                  value={newGroupCategory}
                  onChange={(e) => setNewGroupCategory(e.target.value)}
                  placeholder="e.g. Trading Cards, Coins, Comics"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowNewGroupModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newGroupTitle.trim()) {
                    createItemGroup(newGroupTitle, newGroupCategory, []);
                    setNewGroupTitle('');
                    setShowNewGroupModal(false);
                  }
                }}
                disabled={!newGroupTitle.trim()}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
