'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  PanelLeftClose,
  PanelLeft,
  FileText,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileCode2,
  Cpu,
  Upload,
  BookOpen,
  Trash2,
  Maximize2,
  Sparkles
} from 'lucide-react';
import MathMarkdown from '../components/MathMarkdown';
import CitationDrawer from '../components/CitationDrawer';
import UploadModal from '../components/UploadModal';
import {
  sendQuery,
  listDocuments,
  deleteDocument,
  fetchAvailableModels
} from '../services/api';
import { DocumentRecord, Citation, QueryResponse } from '../types';

const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

const WELCOME = {
  id: 'welcome',
  role: 'agent',
  text: 'How can I assist you with your studies?',
};

let idCounter = 1;
const nextId = () => `m_${idCounter++}`;

export default function MechRAGChatNoKey() {
  const [collapsed, setCollapsed] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(true);

  // Source PDFs from backend metadata.db
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedBookFilter, setSelectedBookFilter] = useState<string | null>(null);

  // In-memory chats (reset on refresh)
  const [chats, setChats] = useState([
    { id: 'c1', title: 'New chat', messages: [WELCOME] },
  ]);
  const [activeChatId, setActiveChatId] = useState('c1');
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // Models from backend or default
  const [availableModels, setAvailableModels] = useState(MODELS);
  const [model, setModel] = useState(MODELS[0].id);

  // Modals & Drawers
  const [activeCitations, setActiveCitations] = useState<Citation[] | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? chats[0];

  // Fetch documents and models from FastAPI backend
  const loadDocuments = async () => {
    try {
      const res = await listDocuments();
      setDocuments(res.documents || []);
    } catch (e) {
      console.error('Failed to load documents:', e);
    }
  };

  const loadModels = async () => {
    try {
      const res = await fetchAvailableModels();
      if (res.models && res.models.length > 0) {
        const formatted = res.models.map((m) => ({ id: m.id, label: m.name }));
        setAvailableModels(formatted);
        setModel(formatted[0].id);
      }
    } catch (e) {
      console.error('Failed to load models:', e);
    }
  };

  useEffect(() => {
    loadDocuments();
    loadModels();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChat?.messages, isThinking]);

  const updateChatMessages = (chatId: string, updater: (msgs: any[]) => any[]) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages: updater(c.messages) } : c))
    );
  };

  const handleNewChat = () => {
    const id = `c_${nextId()}`;
    setChats((prev) => [{ id, title: 'New chat', messages: [WELCOME] }, ...prev]);
    setActiveChatId(id);
    setDraft('');
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Remove textbook from vector store?')) return;
    try {
      await deleteDocument(docId);
      await loadDocuments();
    } catch (e) {
      console.error('Failed to delete document:', e);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeChat || isThinking) return;

    const userMsg = { id: nextId(), role: 'user', text };
    updateChatMessages(activeChat.id, (msgs) => [...msgs, userMsg]);

    // rename chat on first real user message
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChat.id && c.title === 'New chat'
          ? { ...c, title: text.slice(0, 42) + (text.length > 42 ? '…' : '') }
          : c
      )
    );

    setDraft('');
    setIsThinking(true);

    try {
      const response: QueryResponse = await sendQuery(
        text,
        selectedBookFilter || undefined,
        model
      );

      const reply = {
        id: nextId(),
        role: 'agent',
        text: response.answer,
        citations: response.citations || [],
      };
      updateChatMessages(activeChat.id, (msgs) => [...msgs, reply]);
    } catch (err: any) {
      const errReply = {
        id: nextId(),
        role: 'agent',
        text: `⚠️ Backend query error: ${err?.response?.data?.detail || err?.message || 'Could not connect to FastAPI API at port 8000.'}`,
      };
      updateChatMessages(activeChat.id, (msgs) => [...msgs, errReply]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.app}>

      {/* ---------------- sidebar (side view) ---------------- */}
      <aside style={{ ...styles.sidebar, width: collapsed ? 60 : 290 }}>
        {/* Top Header & Collapse Toggle */}
        <div style={collapsed ? styles.sidebarTopCollapsed : styles.sidebarTop}>
          {!collapsed && (
            <div style={styles.sidebarBrandRow}>
              <div style={styles.brandBadgeIcon}>
                <Sparkles size={14} style={{ color: COLORS.green }} />
              </div>
              <span style={styles.sidebarBrandTitle}>MechRAG</span>
              <span style={styles.sidebarBrandVersion}>v1.0.0</span>
            </div>
          )}

          <button
            style={styles.squareIconBtn}
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* New Chat Action Button */}
        {!collapsed && (
          <div style={styles.newChatWrap}>
            <button style={styles.newChatBtn} onClick={handleNewChat}>
              <Plus size={15} strokeWidth={2} />
              <span>new chat</span>
            </button>
          </div>
        )}

        {collapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 10 }}>
            <button style={styles.squareIconBtn} onClick={handleNewChat} title="new chat">
              <Plus size={16} />
            </button>
          </div>
        )}

        {!collapsed && <div style={styles.sidebarDivider} />}

        {/* Middle Section: Source PDFs */}
        {!collapsed && (
          <div style={styles.sidebarSection}>
            <div style={styles.sectionHeaderRow}>
              <button style={styles.sectionHeader} onClick={() => setPdfOpen((v) => !v)}>
                {pdfOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <FileText size={13} style={{ color: COLORS.green }} />
                <span>source pdfs</span>
                <span style={styles.countBadge}>{documents.length}</span>
              </button>

              <button
                style={styles.smallUploadBtn}
                onClick={() => setIsUploadModalOpen(true)}
                title="Upload PDF Textbook"
              >
                <Upload size={12} />
                <span style={{ marginLeft: 3 }}>Upload</span>
              </button>
            </div>

            {pdfOpen && (
              <div style={styles.pdfList}>
                <div
                  style={{
                    ...styles.pdfItem,
                    ...(selectedBookFilter === null ? styles.pdfItemSelected : {}),
                  }}
                  onClick={() => setSelectedBookFilter(null)}
                >
                  <BookOpen size={13} style={{ flexShrink: 0, color: COLORS.green }} />
                  <span style={styles.pdfName}>All Textbooks</span>
                </div>

                {documents.length === 0 ? (
                  <div style={styles.emptyPdfHint}>no pdfs ingested yet</div>
                ) : (
                  documents.map((pdf) => {
                    const title = pdf.book_title || pdf.file_name;
                    const isSelected = selectedBookFilter === title;
                    return (
                      <div
                        key={pdf.id}
                        style={{
                          ...styles.pdfItem,
                          ...(isSelected ? styles.pdfItemSelected : {}),
                        }}
                        onClick={() => setSelectedBookFilter(isSelected ? null : title)}
                        title={title}
                      >
                        <FileCode2 size={13} style={{ flexShrink: 0, opacity: 0.8, color: COLORS.green }} />
                        <span style={styles.pdfName}>{title}</span>
                        <span style={styles.pdfPages}>{pdf.total_pages ? `${pdf.total_pages}p` : ''}</span>
                        <button
                          style={styles.pdfDeleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDoc(pdf.id);
                          }}
                          title="Delete document"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {!collapsed && <div style={styles.sidebarDivider} />}

        {/* Bottom Section: Recent Chats */}
        {!collapsed && (
          <div style={{ ...styles.sidebarSection, flex: 1, minHeight: 0 }}>
            <div style={styles.sectionLabel}>recent (session only)</div>
            <div style={styles.chatList}>
              {chats.map((c) => {
                const isActive = c.id === activeChatId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveChatId(c.id)}
                    style={{
                      ...styles.chatItem,
                      ...(isActive ? styles.chatItemActive : {}),
                    }}
                  >
                    <MessageSquare size={13} style={{ flexShrink: 0, opacity: 0.7, color: isActive ? COLORS.greenBright : COLORS.wheatDim }} />
                    <span style={styles.chatItemText}>{c.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      {/* ---------------- main chat ---------------- */}
      <main style={styles.main}>
        <div style={styles.header}>
          <div style={styles.headerTitleRow}>
            <span style={styles.headerTitle}>MechRAG</span>
            <span style={styles.headerVersion}>v1.0.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {selectedBookFilter && (
              <span style={styles.filterBadge}>
                <BookOpen size={11} /> {selectedBookFilter}
              </span>
            )}
            <span style={styles.headerDim}>session active</span>
          </div>
        </div>

        <div ref={scrollRef} style={styles.messages}>
          <div style={styles.messagesInner}>
            {activeChat?.messages.map((m) => (
              <Message
                key={m.id}
                role={m.role}
                text={m.text}
                citations={m.citations}
                onOpenCitationsDrawer={(cits) => setActiveCitations(cits)}
              />
            ))}
            {isThinking && <ThinkingBubble />}
          </div>
        </div>

        <div style={styles.inputBar}>
          <div style={styles.inputWrap}>
            <div style={styles.toolbar}>
              <div style={styles.modelSelectWrap}>
                <Cpu size={13} style={{ color: COLORS.greenDim, flexShrink: 0 }} />
                <select
                  style={styles.modelSelect}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id} style={{ background: COLORS.panel }}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.inputInner}>
              <span style={styles.prompt}>{'>'}</span>
              <textarea
                style={styles.textarea}
                rows={1}
                value={draft}
                placeholder="ask about your mechanical engineering textbooks..."
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                style={{ ...styles.sendBtn, opacity: draft.trim() ? 1 : 0.4 }}
                onClick={handleSend}
                disabled={!draft.trim() || isThinking}
                title="send"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Citations Drawer */}
      {activeCitations && (
        <CitationDrawer
          isOpen={!!activeCitations}
          onClose={() => setActiveCitations(null)}
          citations={activeCitations}
        />
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false);
            loadDocuments();
          }}
        />
      )}
    </div>
  );
}

// ---------------- subcomponents ----------------

function Message({
  role,
  text,
  citations,
  onOpenCitationsDrawer
}: {
  role: string;
  text: string;
  citations?: Citation[];
  onOpenCitationsDrawer?: (c: Citation[]) => void;
}) {
  const isUser = role === 'user';
  const [expandedPassages, setExpandedPassages] = useState(false);

  return (
    <div style={{ ...styles.msgRow, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && <div style={styles.agentTag}>agent</div>}
      <div
        style={{
          ...styles.bubble,
          ...(isUser ? styles.bubbleUser : styles.bubbleAgent),
        }}
      >
        <MathMarkdown content={text} />

        {/* Clean expandable passages section for Agent replies */}
        {!isUser && citations && citations.length > 0 && (
          <div style={styles.citationContainer}>
            <div style={styles.citationHeaderRow}>
              <button
                style={styles.citationToggleBtn}
                onClick={() => setExpandedPassages((v) => !v)}
              >
                <BookOpen size={12} style={{ color: COLORS.green }} />
                <span>
                  {expandedPassages ? 'Hide' : 'View'} {citations.length} Verified {citations.length === 1 ? 'Passage' : 'Passages'}
                </span>
                {expandedPassages ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              <button
                style={styles.drawerExpandBtn}
                onClick={() => onOpenCitationsDrawer && onOpenCitationsDrawer(citations)}
                title="Open Side View Drawer"
              >
                <Maximize2 size={11} />
                <span>Full Passages Side View</span>
              </button>
            </div>

            {/* Inline Passages Accordion */}
            {expandedPassages && (
              <div style={styles.passagesList}>
                {citations.map((cit, idx) => (
                  <div key={idx} style={styles.passageCard}>
                    <div style={styles.passageMetaRow}>
                      <span style={styles.passageBookTag}>
                        <BookOpen size={11} /> {cit.book_title}
                      </span>
                      <span style={styles.passagePageTag}>
                        Page {cit.page_number}
                      </span>
                      {cit.chapter && (
                        <span style={styles.passageChapterTag}>
                          Ch. {cit.chapter}
                        </span>
                      )}
                    </div>
                    <div style={styles.passageTextSnippet}>
                      <MathMarkdown content={cit.text_snippet} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div style={{ ...styles.msgRow, justifyContent: 'flex-start' }}>
      <div style={styles.agentTag}>agent</div>
      <div style={{ ...styles.bubble, ...styles.bubbleAgent, ...styles.thinking }}>
        <span style={styles.dot}>●</span>
        <span style={{ ...styles.dot, animationDelay: '0.15s' }}>●</span>
        <span style={{ ...styles.dot, animationDelay: '0.3s' }}>●</span>
        <span style={{ marginLeft: 8 }}>retrieving context…</span>
      </div>
    </div>
  );
}

// ---------------- styles ----------------

const COLORS = {
  bg: '#0a0f0c',
  sidebarBg: '#070b08',
  panel: '#101712',
  border: '#1c2620',
  green: '#8fbf76',
  greenDim: '#5f8a4d',
  greenBright: '#a9d98c',
  wheat: '#e9dfc4',
  wheatDim: '#b8ae93',
  textMuted: '#6d7a70',
};

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    height: '100vh',
    width: '100%',
    background: COLORS.bg,
    fontFamily: "'Inter', system-ui, sans-serif",
    color: COLORS.wheat,
    backgroundImage:
      'linear-gradient(rgba(143,191,118,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(143,191,118,0.025) 1px, transparent 1px)',
    backgroundSize: '28px 28px',
  },

  // sidebar (side view)
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    background: COLORS.sidebarBg,
    borderRight: `1px solid ${COLORS.border}`,
    transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden',
    flexShrink: 0,
    boxSizing: 'border-box',
  },
  sidebarTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 14px 10px',
    width: '100%',
    boxSizing: 'border-box',
  },
  sidebarTopCollapsed: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '14px 10px',
    width: '100%',
  },
  sidebarBrandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  brandBadgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    background: 'rgba(143,191,118,0.1)',
    border: `1px solid ${COLORS.greenDim}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarBrandTitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: 0.3,
    color: COLORS.green,
  },
  sidebarBrandVersion: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10.5,
    color: COLORS.textMuted,
  },
  newChatWrap: {
    padding: '0 12px 8px',
    width: '100%',
    boxSizing: 'border-box',
  },
  newChatBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '9px 12px',
    background: 'transparent',
    border: `1px solid ${COLORS.greenDim}`,
    borderRadius: 6,
    color: COLORS.green,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5,
    fontWeight: 500,
    letterSpacing: 0.3,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  squareIconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    flexShrink: 0,
    background: 'transparent',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    color: COLORS.wheatDim,
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.15s ease',
  },
  sidebarDivider: {
    height: 1,
    background: COLORS.border,
    margin: '4px 14px',
  },
  sidebarSection: {
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 10px',
    overflow: 'hidden',
    width: '100%',
    boxSizing: 'border-box',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  sectionHeader: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    border: 'none',
    color: COLORS.textMuted,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    padding: '4px 4px',
    cursor: 'pointer',
    borderRadius: 4,
  },
  smallUploadBtn: {
    background: 'rgba(143,191,118,0.08)',
    border: `1px solid ${COLORS.greenDim}`,
    borderRadius: 4,
    color: COLORS.greenBright,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10.5,
    padding: '3px 8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    marginLeft: 'auto',
    fontSize: 10,
    color: COLORS.greenDim,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: '1px 6px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  pdfList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    marginTop: 4,
    maxHeight: 200,
    overflowY: 'auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  emptyPdfHint: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: COLORS.textMuted,
    padding: '8px 10px',
    fontStyle: 'italic',
  },
  pdfItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    borderRadius: 6,
    fontSize: 12.5,
    color: COLORS.wheatDim,
    cursor: 'pointer',
    background: 'transparent',
    transition: 'all 0.15s ease',
    border: '1px solid transparent',
    boxSizing: 'border-box',
    width: '100%',
  },
  pdfItemSelected: {
    background: COLORS.panel,
    color: COLORS.greenBright,
    border: `1px solid ${COLORS.greenDim}`,
  },
  pdfName: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
  pdfPages: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontFamily: "'JetBrains Mono', monospace",
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '1px 5px',
    flexShrink: 0,
  },
  pdfDeleteBtn: {
    background: 'transparent',
    border: 'none',
    color: COLORS.textMuted,
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  sectionLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.5,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    padding: '4px 4px 8px',
  },
  chatList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    overflowY: 'auto',
    width: '100%',
  },
  chatItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 6,
    color: COLORS.wheatDim,
    fontSize: 12.5,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxSizing: 'border-box',
  },
  chatItemActive: {
    background: COLORS.panel,
    color: COLORS.wheat,
    borderLeft: `3px solid ${COLORS.green}`,
    borderTop: `1px solid ${COLORS.border}`,
    borderRight: `1px solid ${COLORS.border}`,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  chatItemText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
    flex: 1,
  },

  // main
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 22px',
    borderBottom: `1px solid ${COLORS.border}`,
    flexShrink: 0,
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  headerTitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: 0.3,
    color: COLORS.green,
  },
  headerVersion: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: COLORS.textMuted,
  },
  headerDim: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: COLORS.textMuted,
  },
  filterBadge: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: COLORS.greenBright,
    background: 'rgba(143,191,118,0.1)',
    border: `1px solid ${COLORS.greenDim}`,
    borderRadius: 4,
    padding: '2px 6px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
  },
  messagesInner: {
    maxWidth: 960,
    width: '100%',
    margin: '0 auto',
    padding: '24px 24px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    boxSizing: 'border-box',
  },
  msgRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    minWidth: 0,
  },
  agentTag: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    color: COLORS.greenDim,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '2px 5px',
    marginTop: 3,
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '88%',
    padding: '12px 16px',
    borderRadius: 8,
    fontSize: 14.5,
    lineHeight: 1.55,
    boxSizing: 'border-box',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    minWidth: 0,
  },
  bubbleUser: {
    background: 'rgba(143,191,118,0.10)',
    border: `1px solid ${COLORS.greenDim}`,
    color: COLORS.greenBright,
  },
  bubbleAgent: {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    color: COLORS.wheat,
  },

  citationContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: `1px solid ${COLORS.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
  },
  citationHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  citationToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(143,191,118,0.08)',
    border: `1px solid ${COLORS.greenDim}`,
    borderRadius: 5,
    color: COLORS.greenBright,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11.5,
    padding: '4px 9px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  drawerExpandBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    color: COLORS.wheatDim,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10.5,
    padding: '3px 7px',
    cursor: 'pointer',
  },
  passagesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 6,
    width: '100%',
  },
  passageCard: {
    background: COLORS.sidebarBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
    boxSizing: 'border-box',
  },
  passageMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  },
  passageBookTag: {
    color: COLORS.greenBright,
    background: 'rgba(143,191,118,0.1)',
    border: `1px solid ${COLORS.greenDim}`,
    borderRadius: 4,
    padding: '2px 6px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontWeight: 500,
  },
  passagePageTag: {
    color: COLORS.wheat,
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '2px 6px',
  },
  passageChapterTag: {
    color: COLORS.textMuted,
  },
  passageTextSnippet: {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 12.5,
    color: COLORS.wheat,
    overflowX: 'auto',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },

  thinking: {
    display: 'flex',
    alignItems: 'center',
    color: COLORS.wheatDim,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5,
  },
  dot: {
    color: COLORS.green,
    animation: 'pulseDot 1.2s infinite',
    marginRight: 2,
  },

  // input
  inputBar: {
    borderTop: `1px solid ${COLORS.border}`,
    padding: '12px 20px 20px',
    flexShrink: 0,
  },
  inputWrap: {
    maxWidth: 960,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '0 2px 8px',
  },
  modelSelectWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    padding: '4px 8px',
    background: COLORS.panel,
  },
  modelSelect: {
    background: 'transparent',
    border: 'none',
    color: COLORS.wheatDim,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11.5,
    cursor: 'pointer',
  },
  inputInner: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 10,
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: '10px 12px',
    width: '100%',
    boxSizing: 'border-box',
  },
  prompt: {
    fontFamily: "'JetBrains Mono', monospace",
    color: COLORS.green,
    fontSize: 15,
    paddingBottom: 2,
  },
  textarea: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    resize: 'none',
    color: COLORS.wheat,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 14,
    lineHeight: 1.5,
    maxHeight: 160,
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: `1px solid ${COLORS.greenDim}`,
    borderRadius: 6,
    color: COLORS.green,
    padding: 7,
    cursor: 'pointer',
    flexShrink: 0,
  },
};
