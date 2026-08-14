'use client';

import React from 'react';
import { Citation } from '../types';
import { X, BookOpen, Award, Copy, Check } from 'lucide-react';
import MathMarkdown from './MathMarkdown';

interface CitationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citations: Citation[];
}

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

export const CitationDrawer: React.FC<CitationDrawerProps> = ({ isOpen, onClose, citations }) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div style={styles.overlay}>
      {/* Clickable Backdrop */}
      <div style={styles.backdrop} onClick={onClose} />

      {/* Slide-over Side View Container (600px Wide) */}
      <div style={styles.drawerPanel}>
        {/* Header */}
        <div style={styles.drawerHeader}>
          <div style={styles.headerLeft}>
            <div style={styles.iconBox}>
              <BookOpen size={18} style={{ color: COLORS.green }} />
            </div>
            <div>
              <h2 style={styles.headerTitle}>Verified Textbook Citations</h2>
              <p style={styles.headerSubtitle}>
                {citations.length} Grounded Source {citations.length === 1 ? 'Passage' : 'Passages'} Retrieved from ChromaDB
              </p>
            </div>
          </div>

          <button style={styles.closeBtn} onClick={onClose} title="Close Side View">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Passage Cards List */}
        <div style={styles.drawerBody}>
          {citations.length === 0 ? (
            <div style={styles.emptyState}>
              <BookOpen size={36} style={{ color: COLORS.greenDim, opacity: 0.5, marginBottom: 12 }} />
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                No citation context available for this response.
              </p>
            </div>
          ) : (
            citations.map((citation, index) => (
              <div key={index} style={styles.passageCard}>
                {/* Card Header: Passage Number + Book Title + Page + Chapter */}
                <div style={styles.cardHeaderRow}>
                  <div style={styles.cardTitleWrap}>
                    <span style={styles.passageBadge}>Passage #{index + 1}</span>
                    <span style={styles.bookTitleText} title={citation.book_title}>
                      {citation.book_title}
                    </span>
                  </div>

                  <div style={styles.badgeWrap}>
                    <span style={styles.pageBadge}>Page {citation.page_number}</span>
                    {citation.chapter && (
                      <span style={styles.chapterBadge}>Ch. {citation.chapter}</span>
                    )}
                  </div>
                </div>

                {/* Text Snippet Content Box */}
                <div style={styles.snippetBox}>
                  <MathMarkdown content={citation.text_snippet} />
                </div>

                {/* Card Footer: Metadata RRF Score + Copy Button */}
                <div style={styles.cardFooterRow}>
                  <span style={styles.rrfScoreText}>
                    <Award size={13} style={{ color: COLORS.greenDim }} />
                    <span>RRF Relevance Score: </span>
                    <strong style={{ color: COLORS.green, marginLeft: 4 }}>
                      {citation.similarity_score.toFixed(4)}
                    </strong>
                  </span>

                  <button
                    style={styles.copyBtn}
                    onClick={() => handleCopy(citation.text_snippet, index)}
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check size={13} style={{ color: COLORS.green }} />
                        <span style={{ color: COLORS.green }}>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy Snippet</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        <div style={styles.drawerFooter}>
          MechRAG Citation Verification Engine
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
  },
  drawerPanel: {
    position: 'relative',
    zIndex: 10000,
    width: '100%',
    maxWidth: 600,
    height: '100%',
    background: COLORS.sidebarBg,
    borderLeft: `1px solid ${COLORS.border}`,
    boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.8)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxSizing: 'border-box',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    background: COLORS.panel,
    borderBottom: `1px solid ${COLORS.border}`,
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    background: 'rgba(143,191,118,0.1)',
    border: `1px solid ${COLORS.greenDim}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: 15,
    color: COLORS.green,
    letterSpacing: '0.3px',
    margin: 0,
  },
  headerSubtitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    margin: 0,
  },
  closeBtn: {
    background: 'transparent',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    color: COLORS.textMuted,
    padding: 6,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  drawerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    boxSizing: 'border-box',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  passageCard: {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    width: '100%',
  },
  cardHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: COLORS.bg,
    borderBottom: `1px solid ${COLORS.border}`,
    flexWrap: 'wrap',
    gap: 8,
  },
  cardTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: 1,
  },
  passageBadge: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: 11,
    color: COLORS.green,
    background: 'rgba(143,191,118,0.12)',
    border: `1px solid ${COLORS.greenDim}`,
    borderRadius: 4,
    padding: '2px 6px',
    flexShrink: 0,
  },
  bookTitleText: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 600,
    fontSize: 12,
    color: COLORS.greenBright,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
  badgeWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  pageBadge: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: COLORS.wheat,
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '2px 6px',
  },
  chapterBadge: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: COLORS.textMuted,
    background: COLORS.panel,
    borderRadius: 4,
    padding: '2px 6px',
  },
  snippetBox: {
    background: COLORS.sidebarBg,
    padding: '12px 14px',
    borderBottom: `1px solid ${COLORS.border}`,
    fontSize: 12.5,
    color: COLORS.wheat,
    fontFamily: "'Inter', system-ui, sans-serif",
    overflowX: 'auto',
    boxSizing: 'border-box',
    width: '100%',
  },
  cardFooterRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    background: COLORS.panel,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: COLORS.textMuted,
  },
  rrfScoreText: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    border: 'none',
    color: COLORS.wheatDim,
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
  },
  drawerFooter: {
    padding: '10px 20px',
    background: COLORS.panel,
    borderTop: `1px solid ${COLORS.border}`,
    textAlign: 'right',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: COLORS.textMuted,
    flexShrink: 0,
  },
};

export default CitationDrawer;
