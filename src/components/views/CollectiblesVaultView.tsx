import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { 
  Trophy, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle, 
  Search, 
  TrendingUp, 
  Award, 
  Coins, 
  Gamepad2, 
  BookOpen, 
  Layers,
  SlidersHorizontal,
  Flame
} from 'lucide-react';

export const CollectiblesVaultView: React.FC = () => {
  const { items, setSelectedItemId, setActiveTab } = useApp();
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const genres = [
    { id: 'all', label: 'All Vault Items', icon: Layers },
    { id: 'Pokemon', label: 'Pokemon TCG', icon: Flame },
    { id: 'Sports Cards', label: 'Sports Cards (Baseball, NFL, NBA)', icon: Award },
    { id: 'Comics', label: 'Comics & CGC', icon: BookOpen },
    { id: 'Coins', label: 'Coins & Numismatics', icon: Coins },
    { id: 'Video Games', label: 'Retro Video Games', icon: Gamepad2 },
  ];

  const filteredItems = items.filter((item) => {
    const cat = item.analysis?.category || '';
    const sub = item.analysis?.subcategory || '';
    const matchesGenre = 
      selectedGenre === 'all' || 
      cat.toLowerCase().includes(selectedGenre.toLowerCase()) ||
      sub.toLowerCase().includes(selectedGenre.toLowerCase());

    const matchesSearch = 
      !searchQuery || 
      item.proposedName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.analysis?.productName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesGenre && matchesSearch;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Collectibles Vault & Slab Inspector</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
              CardOps & Grader AI
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Specialized deep recognition for PSA, BGS, CGC, and SGC slabs, raw card condition clues (centering, corners, foil), and vintage collectibles.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by player, set, cert #..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Genre Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {genres.map((g) => {
          const Icon = g.icon;
          const isSelected = selectedGenre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setSelectedGenre(g.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{g.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grid of Collectibles with Slab / Condition Badges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const analysis = item.analysis;
          const grading = analysis?.gradingDetails;

          return (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all flex flex-col group shadow-lg"
            >
              {/* Photo & Slab Visual Header */}
              <div className="h-64 bg-slate-950 relative overflow-hidden flex items-center justify-center p-3">
                <img
                  src={item.previewUrl}
                  alt={item.originalName}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />

                {/* Grader / Slab Pill */}
                {grading && grading.grader && grading.grader !== 'RAW' ? (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-rose-600 text-white font-extrabold text-[11px] shadow-lg flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{grading.grader} {grading.gradeNumber}</span>
                  </div>
                ) : (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold text-[10px] border border-slate-700">
                    RAW UNGRADED
                  </div>
                )}

                {/* Market Comp */}
                {analysis?.estimatedMarketValueUsd && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-950/90 backdrop-blur-sm border border-slate-700 text-amber-300 font-mono font-bold text-xs">
                    ${analysis.estimatedMarketValueUsd.median} USD
                  </div>
                )}
              </div>

              {/* Collectible Breakdown Details */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">{analysis?.brandOrManufacturer || 'Collectibles'}</span>
                    <span>•</span>
                    <span>{analysis?.yearOrEra || 'Vintage'}</span>
                  </div>

                  <h3 className="font-bold text-base text-white mt-1 group-hover:text-amber-300 transition-colors">
                    {analysis?.productName || item.proposedName}
                  </h3>

                  {/* Condition rating */}
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{analysis?.estimatedCondition || 'Near Mint'}</span>
                  </div>
                </div>

                {/* Subgrades / Condition Clues */}
                {analysis?.conditionClues && analysis.conditionClues.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Gemini Vision Inspection Clues:
                    </span>
                    <ul className="text-xs text-slate-400 space-y-1">
                      {analysis.conditionClues.slice(0, 2).map((clue, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-snug">
                          <span className="text-amber-400 text-[10px] mt-0.5">•</span>
                          <span className="line-clamp-1">{clue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-[11px] font-mono text-slate-500 truncate max-w-[150px]">
                    Cert #{grading?.certNumber || 'N/A'}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedItemId(item.id);
                      setActiveTab('ebay-studio');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/10"
                  >
                    <span>Create eBay Listing</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
