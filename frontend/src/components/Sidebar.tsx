'use client';

import React, { useState } from 'react';
import {
  Plus,
  PanelLeftClose,
  PanelLeft,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Trash2,
  Upload,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { DocumentRecord } from '../types';

export interface ChatSession {
  id: string;
  title: string;
  messages: any[];
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  documents: DocumentRecord[];
  activeBookFilter: string | null;
  onSelectBookFilter: (bookTitle: string | null) => void;
  onDeleteDocument?: (docId: string) => void;
  onOpenUploadModal?: () => void;
  chats: ChatSession[];
  activeChatId: string;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  documents,
  activeBookFilter,
  onSelectBookFilter,
  onDeleteDocument,
  onOpenUploadModal,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
}) => {
  const [pdfSectionOpen, setPdfSectionOpen] = useState(true);

  return (
    <aside
      className={`
        flex flex-col bg-[#070b08] border-r border-[#1c2620]
        transition-all duration-200 ease-in-out shrink-0 overflow-hidden select-none box-border
        ${isOpen ? 'w-[290px]' : 'w-[60px]'}
      `}
    >
      {/* Top Header & Collapse Toggle */}
      <div className={`p-3.5 flex items-center justify-between ${isOpen ? 'flex-row' : 'flex-col gap-2.5'}`}>
        {isOpen && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#8fbf76]/10 border border-[#5f8a4d] flex items-center justify-center">
              <Sparkles size={14} className="text-[#8fbf76]" />
            </div>
            <span className="font-mono font-bold text-base text-[#8fbf76] tracking-tight">MechRAG</span>
            <span className="font-mono text-[10.5px] text-[#6d7a70]">v1.2.4</span>
          </div>
        )}

        <button
          onClick={onToggle}
          title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="w-8.5 h-8.5 flex items-center justify-center shrink-0 bg-transparent border border-[#1c2620] rounded-md text-[#b8ae93] hover:text-white hover:border-[#5f8a4d] transition-all cursor-pointer p-0"
        >
          {isOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>
      </div>

      {/* New Chat Action Button */}
      {isOpen && (
        <div className="px-3 pb-2 w-full box-border">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-transparent border border-[#5f8a4d] rounded-md text-[#8fbf76] font-mono text-[12.5px] font-medium tracking-wide hover:bg-[#8fbf76]/10 transition-all cursor-pointer"
          >
            <Plus size={15} strokeWidth={2} />
            <span>new chat</span>
          </button>
        </div>
      )}

      {!isOpen && (
        <div className="flex justify-center pb-2">
          <button
            onClick={onNewChat}
            title="new chat"
            className="w-8.5 h-8.5 flex items-center justify-center shrink-0 bg-transparent border border-[#1c2620] rounded-md text-[#8fbf76] hover:bg-[#8fbf76]/10 transition-all cursor-pointer p-0"
          >
            <Plus size={16} />
          </button>
        </div>
      )}

      {isOpen && <div className="h-px bg-[#1c2620] mx-3.5 my-1" />}

      {/* Middle Section: Source PDFs */}
      {isOpen && (
        <div className="flex flex-col p-3 overflow-hidden w-full box-border">
          <div className="flex items-center justify-between w-full mb-1.5">
            <button
              onClick={() => setPdfSectionOpen((v) => !v)}
              className="flex-1 flex items-center gap-1.5 bg-transparent border-none text-[#6d7a70] font-mono text-[11px] font-semibold tracking-wider uppercase p-1 rounded hover:bg-[#101712] cursor-pointer"
            >
              {pdfSectionOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <FileText size={13} className="text-[#8fbf76]" />
              <span>source pdfs</span>
              <span className="ml-auto text-[10px] text-[#5f8a4d] border border-[#1c2620] rounded-full px-1.5 py-0.5 font-mono">
                {documents.length}
              </span>
            </button>
          </div>

          {pdfSectionOpen && (
            <div className="flex flex-col gap-1 mt-1 max-h-52 overflow-y-auto w-full box-border">
              <button
                onClick={() => onSelectBookFilter(null)}
                className={`
                  w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-md text-[12.5px] font-mono transition-all cursor-pointer truncate border
                  ${activeBookFilter === null ? 'bg-[#101712] text-[#8fbf76] border-[#5f8a4d] font-medium' : 'bg-transparent text-[#b8ae93] border-transparent hover:bg-[#101712]/60'}
                `}
              >
                <BookOpen size={13} className="shrink-0 text-[#8fbf76]" />
                <span className="truncate">All Textbooks</span>
              </button>

              {documents.length === 0 ? (
                <div className="text-[11px] font-mono text-[#6d7a70] px-2.5 py-2 italic">
                  no pdfs ingested yet
                </div>
              ) : (
                documents.map((doc) => {
                  const title = doc.book_title || doc.filename;
                  const isSelected = activeBookFilter === title;
                  return (
                    <div
                      key={doc.document_id}
                      onClick={() => onSelectBookFilter(isSelected ? null : title)}
                      className={`
                        group flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12.5px] transition-all cursor-pointer border box-border w-full
                        ${isSelected ? 'bg-[#101712] text-[#a9d98c] border-[#5f8a4d]' : 'bg-transparent text-[#b8ae93] border-transparent hover:bg-[#101712]/60'}
                      `}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <FileCode2 size={13} className="shrink-0 text-[#8fbf76] opacity-80" />
                        <span className="truncate">{title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                        <span className="text-[10px] text-[#6d7a70] font-mono bg-[#0a0f0c] border border-[#1c2620] rounded px-1 py-0.5">
                          {doc.total_pages ? `${doc.total_pages}p` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {isOpen && <div className="h-px bg-[#1c2620] mx-3.5 my-1" />}

      {/* Bottom Section: Recent Chats (Session Only) */}
      {isOpen && (
        <div className="flex-1 flex flex-col p-3 min-h-0 overflow-hidden w-full box-border">
          <div className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[#6d7a70] px-1 py-1">
            recent (session only)
          </div>
          <div className="flex-1 flex flex-col gap-1 overflow-y-auto mt-1 w-full">
            {chats.map((c) => {
              const isActive = c.id === activeChatId;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectChat(c.id)}
                  className={`
                    w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-md text-[12.5px] transition-all cursor-pointer box-border
                    ${isActive ? 'bg-[#101712] text-[#e9dfc4] border-l-3 border-l-[#8fbf76] border-y border-r border-[#1c2620]' : 'bg-transparent text-[#b8ae93] border border-transparent hover:bg-[#101712]/50'}
                  `}
                >
                  <MessageSquare size={13} className={`shrink-0 ${isActive ? 'text-[#a9d98c]' : 'text-[#6d7a70]'}`} />
                  <span className="truncate flex-1 min-w-0">{c.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
