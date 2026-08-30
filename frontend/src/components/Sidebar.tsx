'use client';

import React, { useState } from 'react';
import {
  Plus,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers
} from 'lucide-react';
import { DomainCategory } from '../types';

export interface ChatSession {
  id: string;
  title: string;
  messages: any[];
}

export const DOMAIN_OPTIONS: Array<{
  id: string;
  filterValue: string | null;
  name: string;
  icon: string;
  description: string;
}> = [
  {
    id: 'all',
    filterValue: null,
    name: 'All Domains',
    icon: '🌐',
    description: 'Cross-domain engineering search',
  },
  {
    id: 'fluid_n_thermal',
    filterValue: 'fluid_n_thermal',
    name: 'Fluid & Thermal',
    icon: '🌊',
    description: 'Fluids, Heat Transfer, Thermo',
  },
  {
    id: 'Solids_n_machines',
    filterValue: 'Solids_n_machines',
    name: 'Solids & Machines',
    icon: '⚙️',
    description: 'Dynamics, Statics, Shigley',
  },
  {
    id: 'Manufacturing_processes',
    filterValue: 'Manufacturing_processes',
    name: 'Manufacturing',
    icon: '🏭',
    description: 'Welding, Casting, NTM, MTM',
  },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  domains?: DomainCategory[];
  activeDomainFilter: string | null;
  onSelectDomainFilter: (domainId: string | null) => void;
  chats: ChatSession[];
  activeChatId: string;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  activeDomainFilter,
  onSelectDomainFilter,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
}) => {
  const [domainSectionOpen, setDomainSectionOpen] = useState(true);

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
            <span className="font-mono text-[10.5px] text-[#6d7a70]">v1.4.0</span>
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

      {/* Middle Section: Mechanical Domains */}
      {isOpen && (
        <div className="flex flex-col p-3 overflow-hidden w-full box-border">
          <div className="flex items-center justify-between w-full mb-1.5">
            <button
              onClick={() => setDomainSectionOpen((v) => !v)}
              className="flex-1 flex items-center gap-1.5 bg-transparent border-none text-[#6d7a70] font-mono text-[11px] font-semibold tracking-wider uppercase p-1 rounded hover:bg-[#101712] cursor-pointer"
            >
              {domainSectionOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Layers size={13} className="text-[#8fbf76]" />
              <span>domains</span>
              <span className="ml-auto text-[10px] text-[#5f8a4d] border border-[#1c2620] rounded-full px-1.5 py-0.5 font-mono">
                3
              </span>
            </button>
          </div>

          {domainSectionOpen && (
            <div className="flex flex-col gap-1.5 mt-1 w-full box-border">
              {DOMAIN_OPTIONS.map((opt) => {
                const isSelected = activeDomainFilter === opt.filterValue;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onSelectDomainFilter(opt.filterValue)}
                    className={`
                      w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg transition-all cursor-pointer border box-border
                      ${
                        isSelected
                          ? 'bg-[#101712] text-[#8fbf76] border-[#5f8a4d] shadow-[0_0_10px_rgba(143,191,118,0.12)]'
                          : 'bg-transparent text-[#b8ae93] border-transparent hover:bg-[#101712]/60 hover:border-[#1c2620]'
                      }
                    `}
                  >
                    <span className="text-[15px] shrink-0">{opt.icon}</span>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className={`text-[12.5px] truncate font-medium ${isSelected ? 'text-[#a9d98c]' : 'text-[#d8d0ba]'}`}>
                        {opt.name}
                      </span>
                      <span className="text-[10px] text-[#6d7a70] truncate">
                        {opt.description}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8fbf76] shrink-0 ml-auto shadow-[0_0_6px_#8fbf76]" />
                    )}
                  </button>
                );
              })}
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
                    ${
                      isActive
                        ? 'bg-[#101712] text-[#e9dfc4] border-l-3 border-l-[#8fbf76] border-y border-r border-[#1c2620]'
                        : 'bg-transparent text-[#b8ae93] border border-transparent hover:bg-[#101712]/50'
                    }
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
