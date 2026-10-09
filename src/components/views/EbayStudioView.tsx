import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { 
  ShoppingBag, 
  Sparkles, 
  Copy, 
  Check, 
  Code, 
  Eye, 
  Tag, 
  DollarSign, 
  Truck, 
  Layers, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Settings,
  KeyRound,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  Share2,
  Star,
  Sliders
} from 'lucide-react';
import { 
  getEbayStatus, 
  saveEbayCredentials, 
  testEbayConnection, 
  getEbayTemplates, 
  validateEbayRows, 
  downloadEbayCsv 
} from '../../services/api.ts';
import { EbayListingTemplate, CsvValidationResult } from '../../types/index.ts';
import { MarketInsights } from '../ebay/MarketInsights.tsx';

export const EbayStudioView: React.FC = () => {
  const { 
    items, 
    selectedItemId, 
    setSelectedItemId, 
    updateItem, 
    exportCatalogToGoogleSheets,
    itemGroups,
    updateItemGroup,
    setEditingImage,
    setMarketingModalItem
  } = useApp();

  const selectedItem = items.find(i => i.id === selectedItemId) || items[0];
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'visual' | 'code'>('visual');

  // eBay Integration state
  const [ebayStatus, setEbayStatus] = useState<{
    connected: boolean;
    environment: 'sandbox' | 'production';
    hasCredentials: boolean;
    tokenValid: boolean;
    lastConnectedAt?: string;
  } | null>(null);
  const [templates, setTemplates] = useState<EbayListingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tpl-cards');
  const [validationResult, setValidationResult] = useState<CsvValidationResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showCredsModal, setShowCredsModal] = useState(false);

  // Credentials form state
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [devId, setDevId] = useState('');
  const [ruName, setRuName] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  // New item specific field entry
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecVal, setNewSpecVal] = useState('');

  useEffect(() => {
    loadEbayMetadata();
  }, []);

  const loadEbayMetadata = async () => {
    try {
      const [status, tpls] = await Promise.all([
        getEbayStatus().catch(() => null),
        getEbayTemplates().catch(() => ({ templates: [] }))
      ]);
      if (status) setEbayStatus(status);
      if (tpls?.templates) setTemplates(tpls.templates);
    } catch (e) {
      console.warn('Could not load eBay metadata:', e);
    }
  };

  if (!selectedItem) {
    return (
      <div className="p-12 text-center text-slate-400">
        <ShoppingBag className="w-12 h-12 mx-auto text-slate-600 mb-3" />
        <p className="text-base font-semibold">No items available for eBay listing drafting.</p>
        <p className="text-xs text-slate-500 mt-1">Upload photos or load sample collectibles in the Batch Analyzer.</p>
      </div>
    );
  }

  const draft = selectedItem.ebayDraft || {
    title: selectedItem.proposedName.replace(/\.[^.]+$/, '').slice(0, 80),
    titleCharCount: Math.min(80, selectedItem.proposedName.length),
    subtitle: 'Authentic inspected collectible - Fast secure shipping',
    primaryCategoryId: '213',
    primaryCategoryName: 'Collectibles',
    conditionId: '3000',
    conditionDescriptor: 'Near Mint or Better',
    itemSpecifics: { 'Brand': 'Authentic', 'Condition': 'Near Mint' },
    searchKeywords: ['Collectible', 'Rare', 'Vintage'],
    suggestedPriceBin: 49.99,
    suggestedStartingBid: 29.99,
    format: 'FixedPrice' as const,
    shippingPreset: 'USPS Ground Advantage with Top Loader ($4.95)',
    descriptionHtml: `<div><h2>${selectedItem.proposedName}</h2><p>Authentic item in great condition.</p></div>`,
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const updateDraft = (updates: Partial<typeof draft>) => {
    const updatedDraft = { ...draft, ...updates };
    if (updates.title !== undefined) {
      updatedDraft.titleCharCount = updates.title.length;
    }
    updateItem(selectedItem.id, { ebayDraft: updatedDraft });
  };

  const handleApplyTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return;

    updateDraft({
      primaryCategoryId: tpl.defaultCategoryId,
      primaryCategoryName: tpl.name,
      conditionId: tpl.defaultConditionId,
      shippingPreset: tpl.shippingPreset,
      itemSpecifics: {
        ...draft.itemSpecifics,
        ...tpl.itemSpecificRules,
      },
    });
  };

  const handleAddSpecific = () => {
    if (!newSpecKey.trim() || !newSpecVal.trim()) return;
    updateDraft({
      itemSpecifics: {
        ...draft.itemSpecifics,
        [newSpecKey.trim()]: newSpecVal.trim(),
      },
    });
    setNewSpecKey('');
    setNewSpecVal('');
  };

  const handleRemoveSpecific = (key: string) => {
    const next = { ...draft.itemSpecifics };
    delete next[key];
    updateDraft({ itemSpecifics: next });
  };

  // Convert application items to eBay CSV rows
  const generateEbayRows = () => {
    return items.map((it, idx) => {
      const d = it.ebayDraft || {
        title: it.proposedName.slice(0, 80),
        format: 'FixedPrice',
        primaryCategoryId: '213',
        conditionId: '3000',
        suggestedPriceBin: 49.99,
        suggestedStartingBid: 29.99,
        shippingPreset: 'USPS Ground Advantage ($4.95)',
        itemSpecifics: {},
        descriptionHtml: `<p>${it.proposedName}</p>`,
      };

      return {
        action: 'Add' as const,
        category: d.primaryCategoryId || '213',
        title: d.title.slice(0, 80),
        description: d.descriptionHtml || `<p>${d.title}</p>`,
        conditionId: d.conditionId || '3000',
        format: (d.format || 'FixedPrice') as 'FixedPrice' | 'Auction',
        buyItNowPrice: d.suggestedPriceBin || 49.99,
        startPrice: d.format === 'Auction' ? (d.suggestedStartingBid || 29.99) : undefined,
        quantity: 1,
        duration: 'GTC',
        location: 'United States',
        shippingService: 'USPSGroundAdvantage',
        shippingCost: 4.95,
        dispatchTimeMax: 1,
        returnsAcceptedOption: 'ReturnsAccepted' as const,
        customLabelSku: it.id || `SKU-${idx + 1}`,
        picUrl: it.previewUrl.startsWith('http') ? it.previewUrl : undefined,
        itemSpecifics: d.itemSpecifics || {},
      };
    });
  };

  const handleValidateRows = async () => {
    try {
      const rows = generateEbayRows();
      const res = await validateEbayRows(rows);
      setValidationResult(res);
    } catch (e) {
      console.error('Validation error:', e);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const rows = generateEbayRows();
      const filename = `ebay_file_exchange_${new Date().toISOString().slice(0, 10)}.csv`;
      await downloadEbayCsv(rows, filename);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveCredentials = async () => {
    try {
      await saveEbayCredentials({
        clientId,
        clientSecret,
        environment,
        devId,
        ruName,
      });
      await loadEbayMetadata();
      alert('eBay Developer credentials encrypted and stored securely.');
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testEbayConnection();
      setTestResult(res);
      await loadEbayMetadata();
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Connection test failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const charCount = draft.title.length;
  const isOverCharLimit = charCount > 80;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Bar with eBay Status & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">eBay Listing Studio</h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/20">
              Powerseller Engine
            </span>
            {ebayStatus?.hasCredentials ? (
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                ebayStatus.connected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${ebayStatus.connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{ebayStatus.environment.toUpperCase()} {ebayStatus.connected ? 'ONLINE' : 'CONFIGURED'}</span>
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400 border border-slate-700">
                OFFLINE / NO KEYS
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Produce compliant eBay drafts with 80-char keyword titles, category mappings, item specifics, and official File Exchange CSV bulk export.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowCredsModal(true)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Developer Keys</span>
          </button>

          <button
            onClick={handleValidateRows}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Validate Drafts</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export File Exchange CSV'}</span>
          </button>

          <button
            onClick={exportCatalogToGoogleSheets}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <span>Google Sheets</span>
          </button>
        </div>
      </div>

      {/* Validation Banner if validated */}
      {validationResult && (
        <div className={`p-4 rounded-xl border text-xs flex items-start justify-between gap-4 ${
          validationResult.valid
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
        }`}>
          <div className="flex items-start gap-3">
            {validationResult.valid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-sm">
                {validationResult.valid
                  ? `All ${validationResult.totalRows} Listings Validated for File Exchange / MIP!`
                  : `Validation Found ${validationResult.missingRequiredFields.length} Errors & ${validationResult.warnings.length} Warnings`}
              </div>
              {validationResult.missingRequiredFields.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[11px] text-rose-300">
                  {validationResult.missingRequiredFields.map((err, i) => (
                    <li key={i}>• Item #{err.rowIndex + 1} ({err.sku}): {err.message}</li>
                  ))}
                </ul>
              )}
              {validationResult.warnings.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[11px] text-amber-300">
                  {validationResult.warnings.map((w, i) => (
                    <li key={i}>• Warning (#{w.rowIndex + 1}): {w.message}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <button
            onClick={() => setValidationResult(null)}
            className="text-xs text-slate-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Item Carousel strip & Template selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap">Listing Template:</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleApplyTemplate(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none"
          >
            {templates.map(tpl => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} ({tpl.category})
              </option>
            ))}
          </select>
        </div>

        {/* Thumbnail carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full md:max-w-xl">
          {items.map((it, itIdx) => (
            <button
              key={`${it.id}-${itIdx}`}
              onClick={() => setSelectedItemId(it.id)}
              className={`w-12 h-14 rounded-lg overflow-hidden border flex-shrink-0 relative transition-all cursor-pointer ${
                it.id === selectedItem.id
                  ? 'border-amber-400 ring-2 ring-amber-400/30 scale-105'
                  : 'border-slate-800 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={it.previewUrl} alt={it.originalName} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Photo & Item Specifics (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Photo Card & Multi-View Listing Photos */}
          {(() => {
            const currentGroup = itemGroups.find(g => g.id === selectedItem.groupId) || 
              itemGroups.find(g => g.imageAssignments.some(a => a.imageId === selectedItem.id));
            const attachedPhotos = currentGroup 
              ? currentGroup.imageAssignments.map(a => ({ ...a, item: items.find(i => i.id === a.imageId) })).filter(p => Boolean(p.item))
              : [{ imageId: selectedItem.id, role: selectedItem.role || ('front' as const), order: 0, includedInEbayDraft: true, item: selectedItem }];

            const isPrimary = currentGroup ? currentGroup.primaryImageId === selectedItem.id : true;
            const includedCount = attachedPhotos.filter(p => p.includedInEbayDraft !== false).length;

            const togglePhotoInclusion = (imageId: string) => {
              if (!currentGroup) return;
              const updated = currentGroup.imageAssignments.map(a => 
                a.imageId === imageId ? { ...a, includedInEbayDraft: a.includedInEbayDraft === false ? true : false } : a
              );
              updateItemGroup(currentGroup.id, { imageAssignments: updated });
            };

            const setAsGalleryPrimary = (imageId: string) => {
              if (currentGroup) {
                updateItemGroup(currentGroup.id, { primaryImageId: imageId });
              }
              setSelectedItemId(imageId);
            };

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                {/* Main Photo Preview */}
                <div className="h-80 rounded-lg bg-slate-950 overflow-hidden border border-slate-800 relative flex items-center justify-center">
                  <img
                    src={selectedItem.previewUrl}
                    alt={selectedItem.originalName}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    {isPrimary ? (
                      <span className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-black text-xs shadow-md flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>GALLERY #1 (MAIN)</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => setAsGalleryPrimary(selectedItem.id)}
                        className="px-2.5 py-1 rounded bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-slate-300 font-bold text-xs border border-slate-700 shadow-md flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>Make Primary</span>
                      </button>
                    )}
                  </div>
                  <div className="absolute top-3 right-3 px-2 py-1 rounded bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-emerald-400 font-bold text-xs font-mono">
                    {selectedItem.confidence}% Vision Match
                  </div>
                </div>

                {/* Quick Editor & Social Media Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingImage(selectedItem)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-all"
                      title="Nondestructive crop, rotate, and enhance"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Photo</span>
                    </button>

                    <button
                      onClick={() => setMarketingModalItem(selectedItem)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-bold flex items-center gap-1.5 border border-indigo-500/30 cursor-pointer transition-all"
                      title="Generate social media promotional posts"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Social Generator</span>
                    </button>
                  </div>

                  <span className="text-amber-400 font-bold font-mono text-xs">
                    ${selectedItem.analysis?.estimatedMarketValueUsd?.median || draft.suggestedPriceBin || 0} USD
                  </span>
                </div>

                {/* Multi-View Attached Listing Photos Strip */}
                {attachedPhotos.length > 1 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">
                        Listing Photos ({includedCount} of {attachedPhotos.length} included in draft)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Click star to set primary gallery image
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {attachedPhotos.map((p, pIdx) => {
                        const item = p.item!;
                        const isMain = currentGroup?.primaryImageId === item.id;
                        const isSelected = item.id === selectedItem.id;
                        const isIncluded = p.includedInEbayDraft !== false;

                        return (
                          <div 
                            key={`${item.id}-${pIdx}`}
                            className={`rounded-lg border p-1.5 bg-slate-950 flex flex-col justify-between space-y-1.5 transition-all relative ${
                              isSelected ? 'border-amber-500 ring-1 ring-amber-500/40' : 'border-slate-800'
                            }`}
                          >
                            <div 
                              onClick={() => setSelectedItemId(item.id)}
                              className="h-16 bg-slate-900 rounded overflow-hidden flex items-center justify-center cursor-pointer relative"
                            >
                              <img src={item.previewUrl} alt={item.originalName} className="w-full h-full object-cover" />
                              {isMain && (
                                <div className="absolute top-1 left-1 bg-amber-500 text-slate-950 p-0.5 rounded shadow">
                                  <Star className="w-2.5 h-2.5 fill-current" />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px]">
                              <label className="flex items-center gap-1 cursor-pointer text-slate-400">
                                <input
                                  type="checkbox"
                                  checked={isIncluded}
                                  onChange={() => togglePhotoInclusion(item.id)}
                                  className="accent-amber-500 rounded"
                                />
                                <span className="capitalize">{p.role}</span>
                              </label>

                              <button
                                onClick={() => setEditingImage(item)}
                                className="text-slate-500 hover:text-amber-400 cursor-pointer p-0.5"
                                title="Edit this view"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Item Specifics Key-Value Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <span>eBay Item Specifics (C: Columns)</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                {Object.keys(draft.itemSpecifics).length} Attributes
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {Object.entries(draft.itemSpecifics).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-slate-950/60 border border-slate-800/80 group">
                  <span className="font-semibold text-slate-400 text-[11px]">{key}:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200 text-[11px] truncate max-w-[180px]">{val}</span>
                    <button
                      onClick={() => handleRemoveSpecific(key)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity p-0.5"
                      title="Remove attribute"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Custom Attribute */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
              <input
                type="text"
                placeholder="Attribute (e.g. Graded)"
                value={newSpecKey}
                onChange={(e) => setNewSpecKey(e.target.value)}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Value (e.g. Yes)"
                value={newSpecVal}
                onChange={(e) => setNewSpecVal(e.target.value)}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
              />
              <button
                onClick={handleAddSpecific}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 cursor-pointer"
                title="Add attribute"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Gemini Vision Market Insights Component */}
          <MarketInsights
            item={selectedItem}
            draft={draft}
            onApplyPricing={(suggestedBin, suggestedBid) => {
              updateDraft({
                suggestedPriceBin: suggestedBin,
                suggestedStartingBid: suggestedBid,
              });
            }}
          />

          {/* Pricing & Shipping Calculator */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Pricing & Logistics</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 text-[11px]">Buy It Now Price:</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.suggestedPriceBin}
                    onChange={(e) => updateDraft({ suggestedPriceBin: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-[11px]">Starting Auction Bid:</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.suggestedStartingBid}
                    onChange={(e) => updateDraft({ suggestedStartingBid: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <label className="text-slate-400 text-[11px] flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-400" />
                <span>Shipping Strategy:</span>
              </label>
              <input
                type="text"
                value={draft.shippingPreset}
                onChange={(e) => updateDraft({ shippingPreset: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Listing Details & HTML Template (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Title Editor (Strict 80 char limit) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                eBay Title (Strict 80 Character Max)
              </label>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-bold ${
                  charCount > 80 ? 'text-rose-400' : charCount >= 70 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {charCount} / 80
                </span>
                <button
                  onClick={() => copyToClipboard(draft.title, 'title')}
                  className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                  title="Copy Title"
                >
                  {copiedField === 'title' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <input
              type="text"
              maxLength={80}
              value={draft.title}
              onChange={(e) => updateDraft({ title: e.target.value })}
              className={`w-full bg-slate-950 border text-sm font-semibold px-3.5 py-2.5 rounded-lg focus:outline-none ${
                isOverCharLimit ? 'border-rose-500 text-rose-300' : 'border-slate-700 text-white focus:border-amber-400'
              }`}
            />

            <p className="text-[11px] text-slate-400">
              Keywords: {draft.searchKeywords?.join(', ')}
            </p>
          </div>

          {/* Subtitle & Condition */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200">
                Subtitle (Optional Promotional Line):
              </label>
              <input
                type="text"
                value={draft.subtitle}
                onChange={(e) => updateDraft({ subtitle: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-slate-400 text-[11px]">Primary Category ID & Name:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draft.primaryCategoryId}
                    onChange={(e) => updateDraft({ primaryCategoryId: e.target.value })}
                    placeholder="213"
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={draft.primaryCategoryName}
                    onChange={(e) => updateDraft({ primaryCategoryName: e.target.value })}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400 text-[11px]">Condition Descriptor:</label>
                <input
                  type="text"
                  value={draft.conditionDescriptor}
                  onChange={(e) => updateDraft({ conditionDescriptor: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Draft HTML Listing Template (Preview vs Code) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Code className="w-4 h-4 text-blue-400" />
                <span>Responsive eBay Description Template</span>
              </h3>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-xs">
                  <button
                    onClick={() => setPreviewTab('visual')}
                    className={`px-3 py-1 rounded-md font-medium cursor-pointer ${
                      previewTab === 'visual' ? 'bg-slate-800 text-white' : 'text-slate-400'
                    }`}
                  >
                    Visual Preview
                  </button>
                  <button
                    onClick={() => setPreviewTab('code')}
                    className={`px-3 py-1 rounded-md font-medium cursor-pointer ${
                      previewTab === 'code' ? 'bg-slate-800 text-white' : 'text-slate-400'
                    }`}
                  >
                    HTML Code
                  </button>
                </div>

                <button
                  onClick={() => copyToClipboard(draft.descriptionHtml, 'html')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedField === 'html' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy HTML</span>
                </button>
              </div>
            </div>

            {previewTab === 'visual' ? (
              <div className="bg-white rounded-lg p-6 min-h-[300px] max-h-[420px] overflow-y-auto text-slate-900 shadow-inner">
                <div dangerouslySetInnerHTML={{ __html: draft.descriptionHtml }} />
              </div>
            ) : (
              <textarea
                rows={12}
                value={draft.descriptionHtml}
                onChange={(e) => updateDraft({ descriptionHtml: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 p-4 rounded-lg focus:outline-none"
              />
            )}
          </div>
        </div>
      </div>

      {/* eBay Developer Credentials Modal */}
      {showCredsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <span>eBay Developer Program Keys</span>
              </h3>
              <button
                onClick={() => setShowCredsModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Connect your eBay Developer App ID (Client ID) and Cert ID (Client Secret). Keys are encrypted at rest using AES-256-GCM on the backend and never exposed in browser storage.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Environment:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="env"
                      checked={environment === 'sandbox'}
                      onChange={() => setEnvironment('sandbox')}
                      className="text-amber-500"
                    />
                    <span>Sandbox (Testing)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="env"
                      checked={environment === 'production'}
                      onChange={() => setEnvironment('production')}
                      className="text-amber-500"
                    />
                    <span>Production (Live Marketplace)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">App ID (Client ID):</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Your-eBay-AppID-..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Cert ID (Client Secret):</label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Your-eBay-CertID-..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">RuName (eBay Redirect URL Name - Optional):</label>
                <input
                  type="text"
                  value={ruName}
                  onChange={(e) => setRuName(e.target.value)}
                  placeholder="Your-RuName"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs"
                />
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg border text-xs ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}>
                  {testResult.message}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {testingConnection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>Test Connection</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCredsModal(false)}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCredentials}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  Save & Encrypt Keys
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
