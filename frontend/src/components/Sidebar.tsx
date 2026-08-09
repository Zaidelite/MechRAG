'use client';

import React from 'react';
import { BookOpen, Plus, Trash2, Cpu, FileText, Sparkles, HelpCircle } from 'lucide-react';
import { DocumentRecord } from '../types';

interface SidebarProps {
  documents: DocumentRecord[];
  activeBookFilter: string | null;
  onSelectBookFilter: (filename: string | null) => void;
  onDeleteDocument: (docId: string) => void;
  onOpenUploadModal: () => void;
  onSelectSamplePrompt: (prompt: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  activeBookFilter,
  onSelectBookFilter,
  onDeleteDocument,
  onOpenUploadModal,
  onSelectSamplePrompt,
}) => {
  const samplePrompts = [
    'What are the Navier-Stokes equations for incompressible fluid flow?',
    'Explain hydrostatic pressure distribution and buoyant force.',
    'What is Reynolds number and pipe head loss in viscous flow?',
    'Derive Bernoulli equation for unsteady irrotational flow.',
  ];

  return (
    <aside className="w-80 bg-slate-900/90 border-r border-slate-800/80 flex flex-col h-full overflow-hidden backdrop-blur-xl">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-tight">MechRAG</h1>
            <p className="text-[11px] text-slate-400 font-mono">Formula & Citation Engine</p>
          </div>
        </div>
      </div>

      {/* Library Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              Textbook Library
            </span>
            <button
              onClick={onOpenUploadModal}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium bg-cyan-950/40 border border-cyan-800/50 px-2 py-0.5 rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add PDF
            </button>
          </div>

          <div className="space-y-1.5">
            <button
              onClick={() => onSelectBookFilter(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                activeBookFilter === null
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                All Indexed Books
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{documents.length}</span>
            </button>

            {documents.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
                <p className="text-xs text-slate-500 mb-2">No textbooks uploaded yet.</p>
                <button
                  onClick={onOpenUploadModal}
                  className="text-xs text-cyan-400 hover:underline font-medium"
                >
                  Upload your first PDF
                </button>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.document_id}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all border ${
                    activeBookFilter === doc.filename
                      ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40'
                      : 'text-slate-300 border-slate-800/50 hover:bg-slate-800/40'
                  }`}
                >
                  <button
                    onClick={() => onSelectBookFilter(doc.filename)}
                    className="flex-1 text-left truncate mr-2"
                  >
                    <span className="font-medium block truncate">{doc.book_title || doc.filename}</span>
                    <span className="text-[10px] text-slate-500 block">
                      {doc.total_pages ? `${doc.total_pages} Pages` : doc.status}
                    </span>
                  </button>

                  <button
                    onClick={() => onDeleteDocument(doc.document_id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-opacity"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Engineering Prompts Section */}
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3 px-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Quick Prompts
          </span>
          <div className="space-y-1.5">
            {samplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onSelectSamplePrompt(prompt)}
                className="w-full text-left p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60 hover:border-indigo-500/40 hover:bg-indigo-950/20 text-slate-300 hover:text-indigo-200 text-xs transition-all flex items-start gap-2"
              >
                <HelpCircle className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2 leading-relaxed">{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
