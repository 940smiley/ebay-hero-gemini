import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  ShieldCheck, 
  RefreshCw, 
  Sliders, 
  Info, 
  Tag, 
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Stamp,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import { getPlugins, togglePlugin, getPluginDiagnostics } from '../../services/api.ts';
import { PluginManifest, CustomFieldDefinition, PluginDiagnosticItem } from '../../types/index.ts';

export const PluginsView: React.FC = () => {
  const [plugins, setPlugins] = useState<Array<{
    manifest: PluginManifest;
    enabled: boolean;
    customFieldsCount: number;
    customFields?: CustomFieldDefinition[];
  }>>([]);
  const [activeFields, setActiveFields] = useState<CustomFieldDefinition[]>([]);
  const [diagnostics, setDiagnostics] = useState<PluginDiagnosticItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>('stamplicity');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getPlugins();
      setPlugins(data.plugins);
      setActiveFields(data.activeCustomFields);
    } catch (e) {
      console.error('Failed to load plugins:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    setTogglingId(id);
    try {
      const res = await togglePlugin(id, !currentEnabled);
      setPlugins(res.plugins);
      setActiveFields(res.activeCustomFields);
    } catch (e) {
      console.error(`Failed to toggle plugin ${id}:`, e);
    } finally {
      setTogglingId(null);
    }
  };

  const runDiagnosticsCheck = async () => {
    try {
      const res = await getPluginDiagnostics();
      setDiagnostics(res.diagnostics);
      setShowDiagnostics(true);
    } catch (e) {
      console.error('Failed to run diagnostics:', e);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-amber-400" />
            <span>Modular Collectibles Plugins</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 font-semibold border border-indigo-500/20">
              v1.0 Plugin Architecture
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Extend eBay Hero with category-specific appraisal rules, custom metadata fields, AI prompt extensions, and eBay item specifics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={runDiagnosticsCheck}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Plugin Diagnostics</span>
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs cursor-pointer"
            title="Refresh plugins"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Diagnostics Modal / Alert if visible */}
      {showDiagnostics && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Plugin System Diagnostic Results</span>
            </h3>
            <button
              onClick={() => setShowDiagnostics(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {diagnostics.map((diag) => (
              <div
                key={diag.id}
                className={`p-4 rounded-xl border text-xs ${
                  diag.healthy
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-slate-200'
                    : 'border-rose-500/30 bg-rose-500/5 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>{diag.name} ({diag.version})</span>
                  {diag.healthy ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Issues Found
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-[11px]">
                  Status: <strong>{diag.enabled ? 'Enabled' : 'Disabled'}</strong> • Custom Fields: {diag.fieldsCount}
                </p>
                {diag.issues.length > 0 && (
                  <ul className="mt-2 space-y-1 text-rose-300 text-[11px]">
                    {diag.issues.map((iss, i) => (
                      <li key={i}>• {iss}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notice regarding Card Scanner integration reality */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-start gap-4 text-xs text-slate-300">
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-shrink-0">
          <Info className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-white text-sm">eBay Card Scanner Technical Reality</h4>
          <p className="text-slate-400 leading-relaxed">
            The native eBay card scanner is a proprietary client-side feature built exclusively into the official eBay iOS/Android mobile apps. eBay does not provide a public developer API or web SDK for this scanner.
          </p>
          <p className="text-slate-400 leading-relaxed">
            <strong>CardOps</strong> bridges this gap by leveraging Gemini Multimodal Vision with high-resolution OCR, certification number lookup, and grading slab parsing to identify trading cards, PSA/BGS/CGC labels, parallels, and print runs.
          </p>
        </div>
      </div>

      {/* Plugins List */}
      <div className="space-y-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>Installed Specialty Plugins</span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            {plugins.length} Available
          </span>
        </h3>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading plugin manifests...</div>
        ) : (
          <div className="space-y-4">
            {plugins.map((plugin) => {
              const isExpanded = expandedPlugin === plugin.manifest.id;
              const isToggling = togglingId === plugin.manifest.id;

              return (
                <div
                  key={plugin.manifest.id}
                  className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all ${
                    plugin.enabled ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/60 opacity-75'
                  }`}
                >
                  {/* Plugin Header */}
                  <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 flex-shrink-0">
                        {plugin.manifest.id === 'stamplicity' ? (
                          <Stamp className="w-6 h-6 text-amber-400" />
                        ) : (
                          <CreditCard className="w-6 h-6 text-indigo-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h4 className="text-base font-bold text-white">{plugin.manifest.name}</h4>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            v{plugin.manifest.version}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-amber-300 font-medium capitalize">
                            {plugin.manifest.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                          {plugin.manifest.description}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Author: <strong className="text-slate-400">{plugin.manifest.author}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Enable Toggle Button */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggle(plugin.manifest.id, plugin.enabled)}
                        disabled={isToggling}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                          plugin.enabled
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {isToggling ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : plugin.enabled ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        <span>{plugin.enabled ? 'Active & Injected' : 'Disabled'}</span>
                      </button>

                      <button
                        onClick={() => setExpandedPlugin(isExpanded ? null : plugin.manifest.id)}
                        className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                        title={isExpanded ? 'Collapse Details' : 'Expand Details'}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Plugin Details */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 border-t border-slate-800/80 bg-slate-950/40 space-y-4">
                      {/* Custom Metadata Fields */}
                      <div>
                        <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-amber-400" />
                          <span>Specialty Metadata Fields ({plugin.manifest.id === 'stamplicity' ? 7 : 7} attributes)</span>
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                          {plugin.manifest.id === 'stamplicity' ? (
                            <>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="font-semibold text-slate-200">Scott Catalogue Number</div>
                                <div className="text-[11px] text-slate-500 font-mono">scottNumber (text)</div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="font-semibold text-slate-200">Perforation Measurement</div>
                                <div className="text-[11px] text-slate-500 font-mono">perforation (text) e.g. "11x11"</div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="font-semibold text-slate-200">Gum Condition</div>
                                <div className="text-[11px] text-slate-500 font-mono">gumCondition (select: MNH, MLH, Used)</div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="font-semibold text-slate-200">Watermark Type</div>
                                <div className="text-[11px] text-slate-500 font-mono">watermark (text)</div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="font-semibold text-slate-200">Centring Grade</div>
                                <div className="text-[11px] text-slate-500 font-mono">centringGrade (select: Superb, VF, F)</div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="font-semibold text-slate-200">Color / Shade Variant</div>
                                <div className="text-[11px] text-slate-500 font-mono">colorShade (text)</div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="font-semibold text-slate-200">Grading Company</div>
                                <div className="text-[11px] text-slate-500 font-mono">gradingCompany (PSA, BGS, CGC, SGC, RAW)</div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="font-semibold text-slate-200">Numerical Grade</div>
                                <div className="text-[11px] text-slate-500 font-mono">gradeNumber (text) e.g. "10", "9.5"</div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="font-semibold text-slate-200">Certification Number</div>
                                <div className="text-[11px] text-slate-500 font-mono">certNumber (text)</div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="font-semibold text-slate-200">Parallel / Refractor</div>
                                <div className="text-[11px] text-slate-500 font-mono">parallelOrInsert (text)</div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="font-semibold text-slate-200">Print Serial Number</div>
                                <div className="text-[11px] text-slate-500 font-mono">serialNumbering (text) e.g. "/99"</div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="font-semibold text-slate-200">Autograph / Patch</div>
                                <div className="text-[11px] text-slate-500 font-mono">isAutographed (boolean)</div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* AI Vision Domain Knowledge */}
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                        <div className="font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Active Vision Prompt Extension</span>
                        </div>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          {plugin.manifest.id === 'stamplicity'
                            ? 'Injected prompt directs Gemini to analyze perforation per 2cm, Scott catalog identification numbers, centering margins, gum hinge marks, and cancel marks.'
                            : 'Injected prompt directs Gemini to detect grading slabs (PSA red border, BGS gold label, CGC blue/white banner), extract cert numbers from barcodes/labels, and identify card parallels (Prizm, Refractor, Holo).'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
