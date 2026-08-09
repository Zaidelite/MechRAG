'use client';

import React from 'react';
import { Citation } from '../types';
import { X, BookOpen, FileText, Award } from 'lucide-react';
import MathMarkdown from './MathMarkdown';

interface CitationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citations: Citation[];
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({ isOpen, onClose, citations }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm transition-opacity">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Traceable Citations</h2>
                <p className="text-xs text-slate-400">{citations.length} Verified Textbook Sources</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Citation List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {citations.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-600 stroke-1" />
                <p className="text-sm">No specific context citations attached to this response.</p>
              </div>
            ) : (
              citations.map((citation, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      {citation.book_title}
                    </span>
                    <span className="font-medium text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                      Page {citation.page_number}
                    </span>
                  </div>

                  <div className="text-sm text-slate-300 bg-slate-900/80 p-3 rounded-lg border border-slate-850 font-mono">
                    <MathMarkdown content={citation.text_snippet} />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-indigo-400" />
                      RRF Metric: {citation.similarity_score.toFixed(4)}
                    </span>
                    <span>Chapter: {citation.chapter}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitationDrawer;
