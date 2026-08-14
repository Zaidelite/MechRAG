'use client';

import React from 'react';
import { ChevronLeft, Sparkles, BookOpen, Plus, Trash2, Upload, FileText } from 'lucide-react';
import { DocumentRecord } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  documents: DocumentRecord[];
  activeBookFilter: string | null;
  onSelectBookFilter: (filename: string | null) => void;
  onDeleteDocument: (docId: string) => void;
  onOpenUploadModal: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  documents,
  activeBookFilter,
  onSelectBookFilter,
  onDeleteDocument,
  onOpenUploadModal,
  selectedModel,
  onModelChange,
}) => {
  return (
    <>
      {/* Overlay for mobile — click to close */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-full w-72
          bg-[#111118] border-r border-white/[0.06]
          flex flex-col
          sidebar-transition
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header — Brand + Close */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">MechRAG</span>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Close sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-5">

          {/* ── Model Selection ── */}
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider px-1 mb-2 block">
              Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all cursor-pointer appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
              <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
              <option value="gemini-flash-latest">Gemini Flash Latest</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-flash-lite-latest">Gemini Flash Lite</option>
            </select>
          </div>

          {/* ── Books ── */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Books
              </label>
              <span className="text-[10px] text-slate-600 font-mono">{documents.length}</span>
            </div>

            <div className="space-y-0.5">
              {/* All Books option */}
              <button
                onClick={() => onSelectBookFilter(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all ${
                  activeBookFilter === null
                    ? 'bg-white/[0.08] text-white font-medium'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                All Books
              </button>

              {/* Individual books */}
              {documents.map((doc) => (
                <div
                  key={doc.document_id}
                  className={`group flex items-center justify-between rounded-lg transition-all ${
                    activeBookFilter === doc.filename
                      ? 'bg-white/[0.08]'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <button
                    onClick={() => onSelectBookFilter(doc.filename)}
                    className={`flex-1 text-left px-3 py-2 text-[13px] truncate ${
                      activeBookFilter === doc.filename
                        ? 'text-white font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="block truncate">{doc.book_title || doc.filename}</span>
                    <span className="block text-[10px] text-slate-600 mt-0.5">
                      {doc.total_pages ? `${doc.total_pages} pages` : doc.status}
                    </span>
                  </button>
                  <button
                    onClick={() => onDeleteDocument(doc.document_id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 text-slate-600 hover:text-red-400 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {documents.length === 0 && (
                <p className="text-[12px] text-slate-600 px-3 py-3">
                  No books uploaded yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom — Upload Button */}
        <div className="p-3 border-t border-white/[0.06] flex-shrink-0">
          <button
            onClick={onOpenUploadModal}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white hover:border-white/[0.12] transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload PDF
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
