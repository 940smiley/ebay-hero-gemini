import React, { useState } from 'react';
import { POSTGRESQL_SCHEMA_SQL } from '../../../server/databaseSchema.ts';
import { 
  Database, 
  Copy, 
  Check, 
  Download, 
  Table, 
  Layers, 
  ShieldCheck,
  Server
} from 'lucide-react';

export const DatabaseSchemaView: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(POSTGRESQL_SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([POSTGRESQL_SCHEMA_SQL], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ebay_hero_schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const tables = [
    { name: 'users', desc: 'Accounts, role-based access, Google Drive paths, AI model preference' },
    { name: 'projects', desc: 'Photo libraries, target folders, naming conventions' },
    { name: 'images', desc: 'Original paths, hashes (SHA-256), dimensions, status' },
    { name: 'image_analyses', desc: 'Gemini Vision outputs, OCR text, condition ratings, grader certs' },
    { name: 'inventory_items', desc: 'Catalog SKUs, cost basis, list prices, floor prices, storage bins' },
    { name: 'ebay_listings', desc: '80-char titles, item specifics JSONB, keywords, drafts' },
    { name: 'folder_plans', desc: 'Customizable folder rules & tokens' },
    { name: 'rename_history', desc: 'Atomic audit trail and rollback coordinates' },
    { name: 'processing_jobs', desc: 'Large batch checkpoints, resume cursors for 10k+ files' },
    { name: 'audit_logs', desc: 'Immutable forensic event log for compliance' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Enterprise PostgreSQL Database Schema</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 font-semibold border border-blue-500/20">
              1,000,000+ Record Architecture
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Production-ready relational DDL with JSONB item specifics, indexing, foreign keys, and checkpoint recovery for high-volume inventory.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied SQL' : 'Copy DDL'}</span>
          </button>
          <button
            onClick={handleDownloadSql}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-amber-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download schema.sql</span>
          </button>
        </div>
      </div>

      {/* Tables summary grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {tables.map((t) => (
          <div key={t.name} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-amber-300 font-mono font-bold">
              <Table className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="truncate">{t.name}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">{t.desc}</p>
          </div>
        ))}
      </div>

      {/* SQL Code Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono">
            <Server className="w-4 h-4 text-blue-400" />
            <span>schema.sql</span>
          </div>
          <span className="text-[11px] text-emerald-400">PostgreSQL 15 / 16 Compatible</span>
        </div>
        <div className="p-6 bg-slate-950 overflow-x-auto max-h-[600px]">
          <pre className="text-xs font-mono text-emerald-300/90 leading-relaxed">
            {POSTGRESQL_SCHEMA_SQL}
          </pre>
        </div>
      </div>
    </div>
  );
};
