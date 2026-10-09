import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Terminal, 
  Play, 
  Pause, 
  Trash2, 
  Download, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Server, 
  Laptop, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Clock, 
  ChevronRight, 
  ChevronDown,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { logger, LogEntry, LogLevel, LogSubsystem } from '../../services/logger.ts';
import { apiRequest } from '../../services/api.ts';

interface ServerLogEntry {
  id: string;
  timestamp: string;
  level: string;
  subsystem: string;
  event: string;
  operationId?: string;
  durationMs?: number;
  message: string;
  details?: Record<string, any>;
}

export const DiagnosticConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'client' | 'server'>('client');
  const [clientEntries, setClientEntries] = useState<LogEntry[]>([]);
  const [serverEntries, setServerEntries] = useState<ServerLogEntry[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [subsystemFilter, setSubsystemFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingServer, setLoadingServer] = useState(false);

  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Subscribe to frontend logger changes
  useEffect(() => {
    const unsubscribe = logger.subscribe((entries) => {
      if (isLive) {
        setClientEntries(entries);
      }
    });
    return unsubscribe;
  }, [isLive]);

  // Fetch server logs
  const fetchServerLogs = async () => {
    setLoadingServer(true);
    try {
      const res = await apiRequest<{ logs: ServerLogEntry[] }>('/api/diagnostics/logs?limit=500');
      setServerEntries(res.logs || []);
    } catch (e) {
      console.warn('Could not fetch server logs:', e);
    } finally {
      setLoadingServer(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'server') {
      fetchServerLogs();
    }
  }, [activeTab]);

  // Auto-scroll to bottom when live and new entries arrive
  useEffect(() => {
    if (isLive) {
      consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [clientEntries, serverEntries, isLive]);

  const displayedEntries = useMemo(() => {
    const list = activeTab === 'client' ? clientEntries : serverEntries;
    return list.filter((item) => {
      // Filter level
      if (levelFilter !== 'ALL' && item.level !== levelFilter) return false;
      // Filter subsystem
      if (subsystemFilter !== 'ALL' && item.subsystem !== subsystemFilter) return false;
      // Filter search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const msg = item.message.toLowerCase();
        const evt = item.event.toLowerCase();
        const op = (item.operationId || '').toLowerCase();
        const det = item.details ? JSON.stringify(item.details).toLowerCase() : '';
        if (!msg.includes(q) && !evt.includes(q) && !op.includes(q) && !det.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [activeTab, clientEntries, serverEntries, levelFilter, subsystemFilter, searchQuery]);

  const handleCopyLogs = () => {
    const text = displayedEntries
      .map(
        (e) =>
          `[${e.timestamp}] [${e.level.padEnd(5)}] [${e.subsystem}] ${e.event}: ${e.message} ${
            e.details ? JSON.stringify(e.details) : ''
          }`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(displayedEntries, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ebay-hero-diagnostics-${activeTab}-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportTxt = () => {
    const text = displayedEntries
      .map(
        (e) =>
          `[${e.timestamp}] [${e.level.padEnd(5)}] [${e.subsystem}] ${e.event}: ${e.message}\n  Details: ${
            e.details ? JSON.stringify(e.details, null, 2) : 'none'
          }\n`
      )
      .join('\n');
    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ebay-hero-diagnostics-${activeTab}-${Date.now()}.txt`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getLevelBadge = (lvl: string) => {
    switch (lvl) {
      case 'ERROR':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'WARN':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'INFO':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'DEBUG':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[650px] shadow-2xl">
      {/* Top Header & Tab Selector */}
      <div className="p-3 px-5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-white font-bold">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span>Diagnostic & Developer Console</span>
          </div>

          {/* Client vs Server Tabs */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setActiveTab('client')}
              className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'client'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Browser UI ({clientEntries.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('server')}
              className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'server'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Backend Server ({serverEntries.length})</span>
            </button>
          </div>
        </div>

        {/* Live Status & Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'client' && (
            <button
              onClick={() => setIsLive(!isLive)}
              className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 cursor-pointer ${
                isLive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {isLive ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
              <span>{isLive ? 'Live Stream' : 'Paused'}</span>
            </button>
          )}

          {activeTab === 'server' && (
            <button
              onClick={fetchServerLogs}
              disabled={loadingServer}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loadingServer ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>
          )}

          <button
            onClick={handleCopyLogs}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Copy logs to clipboard"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <div className="flex items-center rounded-lg bg-slate-800 border border-slate-700 p-0.5">
            <button
              onClick={handleExportJson}
              className="px-2 py-1 text-slate-300 hover:text-white font-semibold cursor-pointer"
              title="Export as JSON"
            >
              JSON
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={handleExportTxt}
              className="px-2 py-1 text-slate-300 hover:text-white font-semibold cursor-pointer"
              title="Export as Text"
            >
              TXT
            </button>
          </div>

          {activeTab === 'client' && (
            <button
              onClick={() => logger.clear()}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Clear log buffer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-2.5 px-5 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Level Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold">Level:</span>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
            >
              <option value="ALL">All Levels</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
              <option value="TRACE">TRACE</option>
            </select>
          </div>

          {/* Subsystem Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold">Subsystem:</span>
            <select
              value={subsystemFilter}
              onChange={(e) => setSubsystemFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
            >
              <option value="ALL">All Subsystems</option>
              <option value="Google Photos">Google Photos</option>
              <option value="Google Drive">Google Drive</option>
              <option value="Gemini Vision">Gemini Vision</option>
              <option value="OAuth Auth">OAuth Auth</option>
              <option value="Managed Library">Managed Library</option>
              <option value="eBay Studio">eBay Studio</option>
              <option value="System">System</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder="Search events, messages, IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-slate-500 hover:text-white"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Main Log Window */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px] leading-relaxed select-text">
        {displayedEntries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
            <Terminal className="w-8 h-8 opacity-40" />
            <p>No diagnostic events recorded matching current filters.</p>
          </div>
        ) : (
          displayedEntries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                className={`p-2.5 rounded-xl border transition-all ${
                  entry.level === 'ERROR'
                    ? 'bg-rose-950/20 border-rose-900/40'
                    : entry.level === 'WARN'
                    ? 'bg-amber-950/20 border-amber-900/40'
                    : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="text-slate-500 hover:text-slate-300 mt-0.5 cursor-pointer"
                  >
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>

                  <span className="text-slate-500 text-[10px] whitespace-nowrap mt-0.5">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${getLevelBadge(
                      entry.level
                    )}`}
                  >
                    {entry.level}
                  </span>

                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
                    {entry.subsystem}
                  </span>

                  <span className="text-amber-300 font-semibold whitespace-nowrap">
                    {entry.event}
                  </span>

                  <span className="text-slate-200 flex-1 break-words">
                    {entry.message}
                  </span>

                  {entry.durationMs !== undefined && (
                    <span className="text-[10px] text-slate-500 whitespace-nowrap flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {entry.durationMs}ms
                    </span>
                  )}
                </div>

                {/* Expanded Details View */}
                {isExpanded && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 pl-6 space-y-1.5 text-[10px] text-slate-400">
                    {entry.operationId && (
                      <div>
                        <strong className="text-slate-300">Operation ID:</strong>{' '}
                        <span className="text-cyan-400">{entry.operationId}</span>
                      </div>
                    )}
                    {entry.details && (
                      <div>
                        <strong className="text-slate-300">Payload / Details:</strong>
                        <pre className="mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 overflow-x-auto text-[10px]">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={consoleBottomRef} />
      </div>

      {/* Footer */}
      <div className="p-2.5 px-5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span>Showing {displayedEntries.length} events</span>
        <span className="text-[10px] text-slate-500">
          Strict security scrub active: OAuth tokens and client secrets are stripped automatically.
        </span>
      </div>
    </div>
  );
};
