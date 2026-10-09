import React, { useState } from 'react';
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
  ShieldCheck
} from 'lucide-react';

export const EbayStudioView: React.FC = () => {
  const { items, selectedItemId, setSelectedItemId, updateItem, exportCatalogToGoogleSheets } = useApp();

  const selectedItem = items.find(i => i.id === selectedItemId) || items[0];
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'visual' | 'code'>('visual');

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

  const charCount = draft.title.length;
  const isOverCharLimit = charCount > 80;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Bar with Item Carousel */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>eBay Listing Studio</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/20">
              Powerseller Engine
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Produce high-converting, compliant eBay drafts with 80-char keyword titles, category mappings, item specifics, and HTML templates.
          </p>
        </div>

        {/* Item selector strip & Sheets Export */}
        <div className="flex items-center gap-3">
          <button
            onClick={exportCatalogToGoogleSheets}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <span>Sync to Google Sheets</span>
          </button>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full lg:max-w-md">
            {items.map((it) => (
              <button
                key={it.id}
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Photo & Item Specifics (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Photo Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="h-80 rounded-lg bg-slate-950 overflow-hidden border border-slate-800 relative flex items-center justify-center">
              <img
                src={selectedItem.previewUrl}
                alt={selectedItem.originalName}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 right-3 px-2 py-1 rounded bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-emerald-400 font-bold text-xs font-mono">
                {selectedItem.confidence}% Vision Match
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400 font-mono truncate max-w-[200px]">
                {selectedItem.originalName}
              </span>
              <span className="text-amber-400 font-bold font-mono">
                ${selectedItem.analysis?.estimatedMarketValueUsd?.median || 0} USD
              </span>
            </div>
          </div>

          {/* Item Specifics Key-Value Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <span>eBay Item Specifics (Required)</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                {Object.keys(draft.itemSpecifics).length} Attributes
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {Object.entries(draft.itemSpecifics).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="font-semibold text-slate-400 text-[11px]">{key}:</span>
                  <span className="font-medium text-slate-200 text-[11px] truncate max-w-[200px]">{val}</span>
                </div>
              ))}
            </div>
          </div>

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
              Keywords used: {draft.searchKeywords?.join(', ')}
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
                <label className="text-slate-400 text-[11px]">Primary Category:</label>
                <input
                  type="text"
                  value={draft.primaryCategoryName}
                  onChange={(e) => updateDraft({ primaryCategoryName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300"
                />
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
    </div>
  );
};
