import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  Download, 
  Sparkles, 
  ExternalLink,
  Smartphone,
  Hash,
  ShoppingBag
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { SocialPlatform, SocialMediaPost } from '../../types/index.ts';
import { extractContextFromItem, generateAllSocialPosts } from '../../lib/socialMedia.ts';

const PLATFORM_CONFIG: Array<{ id: SocialPlatform; label: string; iconColor: string; limit: number }> = [
  { id: 'instagram', label: 'Instagram', iconColor: 'from-purple-500 to-pink-500', limit: 2200 },
  { id: 'facebook', label: 'Facebook', iconColor: 'from-blue-600 to-blue-700', limit: 2000 },
  { id: 'twitter', label: 'X (Twitter)', iconColor: 'from-slate-700 to-slate-900', limit: 280 },
  { id: 'tiktok', label: 'TikTok', iconColor: 'from-rose-500 to-slate-900', limit: 2200 },
  { id: 'pinterest', label: 'Pinterest', iconColor: 'from-rose-600 to-red-700', limit: 500 },
  { id: 'youtube_shorts', label: 'YouTube Shorts', iconColor: 'from-red-600 to-red-700', limit: 500 },
];

export const SocialMediaModal: React.FC = () => {
  const { marketingModalItem, setMarketingModalItem, itemGroups } = useApp();
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>('instagram');
  const [copied, setCopied] = useState(false);

  if (!marketingModalItem) return null;

  const group = itemGroups.find(g => g.id === marketingModalItem.groupId);
  const context = extractContextFromItem(marketingModalItem, group);
  const posts = generateAllSocialPosts(context);
  const currentPost = posts[activePlatform];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentPost.caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportAll = () => {
    const textOutput = Object.entries(posts)
      .map(([plat, p]) => `==============================\nPLATFORM: ${plat.toUpperCase()}\nRECOMMENDED ASPECT RATIO: ${p.recommendedAspectRatio}\n==============================\n\n${p.caption}\n\n`)
      .join('\n');

    const blob = new Blob([textOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `social-marketing-${marketingModalItem.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const charPercentage = Math.min(100, Math.round((currentPost.characterCount / currentPost.characterLimit) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-amber-500 flex items-center justify-center text-slate-950 shadow-md">
              <Share2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <span>Social Media Marketing Automation</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold uppercase">
                  AI Tailored
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-md">
                Campaign for: <span className="text-slate-200 font-semibold">{context.title}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setMarketingModalItem(null)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Tabs */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center gap-2 overflow-x-auto">
          {PLATFORM_CONFIG.map(plat => {
            const isActive = activePlatform === plat.id;
            return (
              <button
                key={plat.id}
                onClick={() => setActivePlatform(plat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 flex-shrink-0 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>{plat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Post Preview & Editor (Left) */}
          <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>Publication Post Preview</span>
                </span>

                <span className="text-[11px] text-slate-400 font-mono">
                  Aspect Ratio: <strong className="text-amber-400">{currentPost.recommendedAspectRatio}</strong>
                </span>
              </div>

              {/* Caption Text Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
                {currentPost.caption}
              </div>

              {/* Character Limit Meter */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Character Usage: {currentPost.characterCount} / {currentPost.characterLimit}</span>
                  <span className={charPercentage > 90 ? 'text-rose-400' : 'text-emerald-400'}>{charPercentage}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      charPercentage > 95 ? 'bg-rose-500' : charPercentage > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${charPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={handleExportAll}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 cursor-pointer border border-slate-700 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Export All 6 Platforms (.txt)</span>
              </button>

              <button
                onClick={handleCopy}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Ready-to-Publish Caption</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Info Sidebar */}
          <div className="w-72 border-l border-slate-800 bg-slate-950/60 p-5 space-y-5 overflow-y-auto text-xs">
            {/* Item Thumbnail */}
            <div className="space-y-2">
              <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">Item Featured</span>
              <div className="h-40 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                <img 
                  src={marketingModalItem.previewUrl} 
                  alt={context.title} 
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>

            {/* Campaign Specs */}
            <div className="space-y-2">
              <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">Listing Specifics</span>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-[11px] text-slate-300">
                <div><strong>Category:</strong> {context.category}</div>
                <div><strong>Condition:</strong> {context.grade ? `PSA ${context.grade}` : context.condition}</div>
                <div><strong>Price:</strong> ${context.price?.toFixed(2)}</div>
                <div className="text-emerald-400 font-semibold pt-1">✓ eBay Verified Link Attached</div>
              </div>
            </div>

            {/* Platform Strategy Tips */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 leading-relaxed space-y-1">
              <strong>Strategy for {activePlatform.toUpperCase()}:</strong>
              <p className="text-slate-400">
                {activePlatform === 'instagram' && 'Optimal with 4:5 vertical carousel showing centering, foil luster, and grade slab.'}
                {activePlatform === 'facebook' && 'Ideal for collector groups, Marketplace crossposting, and vintage sports forums.'}
                {activePlatform === 'twitter' && 'Fast-paced collector buzz with high-intent auction links and direct checkout.'}
                {activePlatform === 'tiktok' && 'Use trending music behind a 15-second reveal of the card slab or pack pull.'}
                {activePlatform === 'pinterest' && 'Long-term search traffic for collectible gifts, sports cards, and numismatics.'}
                {activePlatform === 'youtube_shorts' && 'Unboxing video format with pinned eBay purchase link.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
