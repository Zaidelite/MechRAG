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
  Sparkles
} from 'lucide-react';
import MathMarkdown from '../components/MathMarkdown';
import Sidebar, { ChatSession } from '../components/Sidebar';
import UploadModal from '../components/UploadModal';
import {
  sendQuery,
  sendQueryStream,
  listDocuments,
  deleteDocument,
  fetchAvailableModels
} from '../services/api';
import { DocumentRecord, Citation, QueryResponse } from '../types';

const DiscordIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 14, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ flexShrink: 0, ...style }}
  >
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const MODELS = [
  { id: 'groq/compound', label: 'Compound (Groq)' },
  { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B (Groq)' },
  { id: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B (Groq)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Google)' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Google)' },
  { id: 'gemini-flash-latest', label: 'Gemini Flash Latest (Google)' },
];

interface MessageItem {
  id: string;
  role: string;
  text: string;
  citations?: Citation[];
}

const WELCOME: MessageItem = {
  id: 'welcome',
  role: 'agent',
  text: 'How can I assist you with your studies?',
};

let idCounter = 1;
const nextId = () => `m_${idCounter++}`;

export default function Home() {
  const [collapsed, setCollapsed] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(true);

  // Source PDFs from backend metadata.db
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedBookFilter, setSelectedBookFilter] = useState<string | null>(null);

  // In-memory chats (reset on refresh)
  const [chats, setChats] = useState<{ id: string; title: string; messages: MessageItem[] }[]>([
    { id: 'c1', title: 'New chat', messages: [WELCOME] },
  ]);
  const [activeChatId, setActiveChatId] = useState('c1');
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // Models from backend or default
  const [availableModels, setAvailableModels] = useState(MODELS);
  const [model, setModel] = useState(MODELS[0].id);

  // Upload Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? chats[0];

  // Fetch documents and models from FastAPI backend
  const loadDocuments = async () => {
    try {
      const res = await listDocuments();
      if (res && res.documents) {
        setDocuments(res.documents);
      }
    } catch (e) {
      console.error('Failed to load documents:', e);
    }
  };

  const loadModels = async () => {
    try {
      const res = await fetchAvailableModels();
      if (res && res.models && res.models.length > 0) {
        const formatted = res.models.map((m) => ({ id: m.id, label: m.name }));
        setAvailableModels(formatted);
        setModel((prev) => (formatted.some((f) => f.id === prev) ? prev : formatted[0].id));
      }
    } catch (e) {
      console.error('Failed to load models:', e);
    }
  };

  useEffect(() => {
    loadDocuments();
    loadModels();

    // Auto-retry polling once after 2.5s in case backend was warming up
    const timer = setTimeout(() => {
      loadDocuments();
      loadModels();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChat?.messages, isThinking]);

  const updateChatMessages = (chatId: string, updater: (msgs: MessageItem[]) => MessageItem[]) => {
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

    const userMsg: MessageItem = { id: nextId(), role: 'user', text };
    const agentMsgId = nextId();
    const agentMsg: MessageItem = { id: agentMsgId, role: 'agent', text: '', citations: [] };

    updateChatMessages(activeChat.id, (msgs) => [...msgs, userMsg, agentMsg]);

    // rename chat on first real user message
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChat.id && c.title === 'New chat'
          ? { ...c, title: text.slice(0, 42) + (text.length > 42 ? '…' : '') }
          : c
      )
    );

    // Construct multi-turn history from current chat session (exclude welcome prompt and empty messages)
    const historyPayload = activeChat.messages
      .filter((m) => m.id !== 'welcome' && m.text && m.text.trim())
      .map((m) => ({
        role: (m.role === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.text,
      }));

    setDraft('');
    setIsThinking(true);

    try {
      await sendQueryStream(
        text,
        historyPayload,
        selectedBookFilter || undefined,
        model,
        (token) => {
          setChats((prev) =>
            prev.map((c) =>
              c.id === activeChat.id
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === agentMsgId ? { ...m, text: m.text + token } : m
                    ),
                  }
                : c
            )
          );
        },
        (citations) => {
          setChats((prev) =>
            prev.map((c) =>
              c.id === activeChat.id
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === agentMsgId ? { ...m, citations } : m
                    ),
                  }
                : c
            )
          );
        }
      );
    } catch (err: any) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === agentMsgId
                    ? {
                        ...m,
                        text: m.text
                          ? m.text + `\n\n⚠️ Streaming error: ${err?.message || 'Error occurred.'}`
                          : `⚠️ Backend query error: ${err?.response?.data?.detail || err?.message || 'Could not connect to FastAPI API at port 8000.'}`,
                      }
                    : m
                ),
              }
            : c
        )
      );
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
              <span style={styles.sidebarBrandVersion}>v1.2.6</span>
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
                    const title = pdf.book_title || pdf.filename;
                    const isSelected = selectedBookFilter === title;
                    return (
                      <div
                        key={pdf.document_id}
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
            <span style={styles.headerVersion}>v1.2.6</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {selectedBookFilter && (
              <span style={styles.filterBadge}>
                <BookOpen size={11} /> {selectedBookFilter}
              </span>
            )}
            <a
              href="https://discord.gg/XGCr7afTY"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.discordBtn}
              title="Join our Discord community"
            >
              <DiscordIcon size={13} />
              <span>Join Discord</span>
            </a>
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
              />
            ))}
            {isThinking &&
              (!activeChat?.messages.length ||
                activeChat.messages[activeChat.messages.length - 1]?.role !== 'agent' ||
                !activeChat.messages[activeChat.messages.length - 1]?.text) && (
                <ThinkingBubble />
              )}
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

    </div>
  );
}

// ---------------- subcomponents ----------------

function Message({
  role,
  text,
  citations
}: {
  role: string;
  text: string;
  citations?: Citation[];
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

        {/* Clean expandable passages section directly inside agent message bubble */}
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
  discordBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 9px',
    background: 'rgba(88, 101, 242, 0.12)',
    border: '1px solid rgba(88, 101, 242, 0.35)',
    borderRadius: 5,
    color: '#9baaf4',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 500,
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
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
    maxWidth: 1150,
    width: '100%',
    margin: '0 auto',
    padding: '28px 36px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 26,
    boxSizing: 'border-box',
  },
  msgRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
    minWidth: 0,
  },
  agentTag: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    color: COLORS.greenDim,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '2px 6px',
    marginTop: 4,
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '96%',
    padding: '12px 18px',
    borderRadius: 8,
    fontSize: 15.5,
    lineHeight: 1.8,
    letterSpacing: '0.012em',
    boxSizing: 'border-box',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    minWidth: 0,
  },
  bubbleUser: {
    background: 'rgba(143,191,118,0.10)',
    border: `1px solid ${COLORS.greenDim}`,
    color: COLORS.greenBright,
    padding: '12px 18px',
  },
  bubbleAgent: {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    color: '#f3f4f6',
    padding: '18px 26px 14px',
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
