import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  DollarSign, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck, 
  ExternalLink, 
  Info, 
  Zap, 
  Award, 
  Eye, 
  HelpCircle,
  Calendar,
  Layers,
  BarChart3,
  Check
} from 'lucide-react';
import { ImageItem, EbayListingDraft, MarketInsightsData, HistoricalSoldComp } from '../../types/index.ts';
import { getMarketInsights } from '../../services/api.ts';

interface MarketInsightsProps {
  item: ImageItem;
  draft: EbayListingDraft;
  onApplyPricing: (suggestedBin: number, suggestedBid: number) => void;
}

export const MarketInsights: React.FC<MarketInsightsProps> = ({
  item,
  draft,
  onApplyPricing,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<MarketInsightsData | null>(null);
  const [selectedFormatFilter, setSelectedFormatFilter] = useState<'all' | 'Buy It Now' | 'Auction'>('all');
  const [appliedRecently, setAppliedRecently] = useState(false);
  const [lastItemId, setLastItemId] = useState<string | null>(null);

  // Automatically fetch market insights when selected item changes, or use item's cached analysis
  useEffect(() => {
    if (item.id !== lastItemId) {
      setLastItemId(item.id);
      fetchInsightsForItem(item);
    }
  }, [item.id]);

  const fetchInsightsForItem = async (targetItem: ImageItem) => {
    setLoading(true);
    setError(null);

    try {
      let base64 = targetItem.previewUrl || '';
      
      // If previewUrl is a blob URL, read it as base64
      if (base64.startsWith('blob:')) {
        try {
          const blobRes = await fetch(base64);
          const blobData = await blobRes.blob();
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blobData);
          });
        } catch (e) {
          console.warn('Could not convert blob to base64 for market insights:', e);
        }
      }

      const assetId = targetItem.id.replace(/^(drive|photos)-/, '');

      const result = await getMarketInsights({
        imageBase64: base64,
        assetId,
        mimeType: targetItem.mimeType || 'image/jpeg',
        originalFilename: targetItem.originalName,
        model: 'gemini-3.8-flash',
        collectibleDetails: {
          title: draft?.title || targetItem.proposedName || targetItem.originalName,
          category: targetItem.analysis?.category || draft?.primaryCategoryName || 'Collectibles',
          subcategory: targetItem.analysis?.subcategory || '',
          brand: targetItem.analysis?.brandOrManufacturer || draft?.itemSpecifics?.['Brand'] || '',
          condition: targetItem.analysis?.estimatedCondition || draft?.conditionDescriptor || 'Inspected',
          grader: targetItem.analysis?.gradingDetails?.grader || '',
          currentSuggestedPrice: draft?.suggestedPriceBin || targetItem.analysis?.estimatedMarketValueUsd?.median || 49.99,
          tags: targetItem.analysis?.tags || draft?.searchKeywords || [],
        },
      });

      setInsights(result);
    } catch (err: any) {
      console.error('Failed to get Market Insights:', err);
      setError(err.message || 'Failed to fetch market insights with Gemini Vision');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPricing = () => {
    if (!insights) return;
    onApplyPricing(insights.recommendedPriceBin, insights.recommendedStartingBid);
    setAppliedRecently(true);
    setTimeout(() => setAppliedRecently(false), 2500);
  };

  const filteredComps = useMemo(() => {
    if (!insights?.soldComps) return [];
    if (selectedFormatFilter === 'all') return insights.soldComps;
    return insights.soldComps.filter(c => c.format.includes(selectedFormatFilter));
  }, [insights, selectedFormatFilter]);

  // Price delta calculations vs current draft
  const currentBin = draft.suggestedPriceBin || 0;
  const suggestedBin = insights?.recommendedPriceBin || 0;
  const priceDelta = suggestedBin - currentBin;
  const isHigher = priceDelta > 0.5;
  const isLower = priceDelta < -0.5;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl transition-all">
      {/* Header Bar */}
      <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Market Insights & Pricing Intelligence
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Zap className="w-2.5 h-2.5 fill-current" />
                Gemini Vision
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Historical eBay completed sales comps & real-time liquidity valuation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {insights?.analyzedAt && (
            <span className="text-[10px] text-slate-500 hidden sm:inline-block">
              Updated {new Date(insights.analyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => fetchInsightsForItem(item)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-xs font-medium text-slate-200 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh pricing and comps with Gemini Vision"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analyzing...' : 'Refresh Comps'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 space-y-5">
        {loading && !insights ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
              <Sparkles className="w-5 h-5 text-amber-400 absolute inset-0 m-auto" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Scanning Collectible with Gemini Vision...
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Evaluating centering, corners, condition markers, and matching against historical eBay completed sales.
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-rose-950/30 border border-rose-800/50 text-xs text-rose-300 flex items-start gap-3">
            <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-200">Could not generate live market comps</p>
              <p>{error}</p>
              <button
                onClick={() => fetchInsightsForItem(item)}
                className="mt-2 text-xs font-semibold underline text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : insights ? (
          <>
            {/* Primary Pricing Recommendation Hero Card */}
            <div className="bg-slate-950/80 rounded-xl border border-slate-800/90 p-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      AI Suggested Pricing Strategy
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {insights.confidenceScore}% Confidence
                    </span>
                  </div>
                  <div className="flex items-baseline gap-4 flex-wrap">
                    <div>
                      <span className="text-xs text-slate-400 mr-1.5">Buy It Now:</span>
                      <span className="text-2xl font-bold font-mono text-emerald-400">
                        ${insights.recommendedPriceBin.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 mr-1.5">Starting Bid:</span>
                      <span className="text-lg font-bold font-mono text-slate-200">
                        ${insights.recommendedStartingBid.toFixed(2)}
                      </span>
                    </div>

                    {/* Price Difference Indicator */}
                    {Math.abs(priceDelta) > 0.01 && (
                      <div className="flex items-center gap-1 text-[11px]">
                        {isHigher ? (
                          <span className="text-emerald-400 flex items-center font-medium">
                            <TrendingUp className="w-3 h-3 mr-0.5" />
                            +${Math.abs(priceDelta).toFixed(2)} vs current draft (${currentBin.toFixed(2)})
                          </span>
                        ) : isLower ? (
                          <span className="text-amber-400 flex items-center font-medium">
                            <TrendingDown className="w-3 h-3 mr-0.5" />
                            -${Math.abs(priceDelta).toFixed(2)} vs current draft (${currentBin.toFixed(2)})
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* Apply Button */}
                <button
                  onClick={handleApplyPricing}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-xs transition-all shadow-md cursor-pointer ${
                    appliedRecently
                      ? 'bg-emerald-600 text-white border border-emerald-500 ring-2 ring-emerald-500/40'
                      : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 border border-amber-400 hover:shadow-amber-500/20'
                  }`}
                >
                  {appliedRecently ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Applied to Draft!</span>
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4" />
                      <span>Apply Suggested Pricing</span>
                    </>
                  )}
                </button>
              </div>

              {/* 4-Tier Valuation Distribution Bar */}
              <div className="mt-4 pt-4 border-t border-slate-800/70 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>Valuation Spectrum</span>
                  <span>Based on {insights.compsCountAnalyzed} historical eBay sold comps</span>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/90 text-center">
                    <span className="block text-[10px] text-slate-400">Quick Liquidation</span>
                    <span className="text-sm font-bold font-mono text-slate-300">
                      ${insights.estimatedRange.low.toFixed(0)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-amber-500/30 text-center ring-1 ring-amber-500/20">
                    <span className="block text-[10px] text-amber-400 font-semibold">Fair Market (Median)</span>
                    <span className="text-sm font-bold font-mono text-amber-300">
                      ${insights.estimatedRange.median.toFixed(0)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/90 text-center">
                    <span className="block text-[10px] text-slate-400">Top Retail</span>
                    <span className="text-sm font-bold font-mono text-slate-300">
                      ${insights.estimatedRange.high.toFixed(0)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-emerald-500/30 text-center">
                    <span className="block text-[10px] text-emerald-400">PSA 10 / Peak</span>
                    <span className="text-sm font-bold font-mono text-emerald-300">
                      ${insights.estimatedRange.peak.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Velocity & Market Health Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                  <BarChart3 className="w-3 h-3 text-blue-400" />
                  30-Day Price Trend
                </span>
                <div className="flex items-center gap-1.5 font-bold">
                  {insights.trend.direction === 'up' ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : insights.trend.direction === 'down' ? (
                    <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span className={insights.trend.direction === 'up' ? 'text-emerald-400' : 'text-slate-200'}>
                    {insights.trend.percentage}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 truncate block">
                  {insights.trend.label}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3 text-emerald-400" />
                  Sell-Through Rate
                </span>
                <div className="font-bold text-slate-200 font-mono text-sm">
                  {insights.sellThroughRate}%
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, insights.sellThroughRate)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  Avg. Days to Sell
                </span>
                <div className="font-bold text-slate-200 font-mono text-sm">
                  {insights.averageDaysToSell} Days
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Listing Velocity
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-purple-400" />
                  Liquidity Score
                </span>
                <div className="font-bold text-purple-300 text-sm">
                  {insights.liquidityScore}
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Active Buyer Base
                </span>
              </div>
            </div>

            {/* Historical Sold Comps Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>Recent Historical eBay Sold Comps</span>
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    {filteredComps.length} matches
                  </span>
                </div>

                {/* Filter pills */}
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    onClick={() => setSelectedFormatFilter('all')}
                    className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                      selectedFormatFilter === 'all'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedFormatFilter('Buy It Now')}
                    className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                      selectedFormatFilter === 'Buy It Now'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Fixed Price
                  </button>
                  <button
                    onClick={() => setSelectedFormatFilter('Auction')}
                    className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                      selectedFormatFilter === 'Auction'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Auctions
                  </button>
                </div>
              </div>

              {/* Comps List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredComps.map((comp, idx) => (
                  <div
                    key={`${comp.title}-${comp.soldDate}-${idx}`}
                    className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {comp.condition}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-slate-400 border border-slate-800">
                          {comp.format} {comp.bidsCount ? `(${comp.bidsCount} bids)` : ''}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Sold {comp.soldDate}
                        </span>
                      </div>
                      <p className="font-medium text-slate-200 truncate text-[11px]" title={comp.title}>
                        {comp.title}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold font-mono text-emerald-400">
                        ${comp.price.toFixed(2)}
                      </span>
                      <span className="block text-[9px] text-slate-500 font-mono">
                        {comp.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grading ROI Matrix (PSA 10 vs 9 vs Raw Arbitrage) */}
            {insights.gradeMultipliers && insights.gradeMultipliers.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-purple-400" />
                    <span>Grading Arbitrage & Value Multipliers</span>
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    Est. Submission Fee: ~$25
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {insights.gradeMultipliers.map((gm, idx) => (
                    <div
                      key={gm.grade}
                      className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                        idx === insights.gradeMultipliers.length - 1
                          ? 'bg-purple-950/20 border-purple-500/40 text-purple-200'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span>{gm.grade}</span>
                        <span className="text-amber-400 font-mono">{gm.multiplier}</span>
                      </div>
                      <div className="text-base font-bold font-mono text-white">
                        ${gm.price.toFixed(0)}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate" title={gm.roiVsGradingCost}>
                        {gm.roiVsGradingCost}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gemini Vision Visual Inspection Clues */}
            {insights.visualPricingClues && insights.visualPricingClues.length > 0 && (
              <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800/80 space-y-2">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Gemini Vision Physical Condition Observations</span>
                </span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-400">
                  {insights.visualPricingClues.map((clue, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <span>{clue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Selling Strategy & Optimal Timing Tips */}
            <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5 text-blue-400" />
                  <span>Optimal Listing Timing & Powerseller Advice</span>
                </span>
                {insights.optimalListingTime && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                    {insights.optimalListingTime}
                  </span>
                )}
              </div>

              <div className="space-y-1 text-[11px] text-slate-400">
                <p className="text-slate-300 leading-relaxed italic">
                  "{insights.marketSummary}"
                </p>
                {insights.sellingStrategyTips && (
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 not-italic">
                    {insights.sellingStrategyTips.map((tip, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-slate-400">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
