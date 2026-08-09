'use client';

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import MathMarkdown from '../components/MathMarkdown';
import CitationDrawer from '../components/CitationDrawer';
import UploadModal from '../components/UploadModal';
import { sendQuery, listDocuments, deleteDocument } from '../services/api';
import { ChatMessage, Citation, DocumentRecord } from '../types';
import { Send, Sparkles, BookOpen, AlertCircle, Loader2, Bot, User } from 'lucide-react';

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Document Library State
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [activeBookFilter, setActiveBookFilter] = useState<string | null>(null);

  // Modals & Drawers
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [selectedCitations, setSelectedCitations] = useState<Citation[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchDocumentList = async () => {
    try {
      const res = await listDocuments();
      setDocuments(res.documents || []);
    } catch (err) {
      console.error('Error fetching document list:', err);
    }
  };

  useEffect(() => {
    fetchDocumentList();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputValue;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputValue('');
    setIsLoading(true);

    try {
      const res = await sendQuery(textToSend, activeBookFilter || undefined);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: res.answer,
        citations: res.citations,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: '⚠️ An error occurred while processing your request. Please ensure the backend service is running.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await deleteDocument(docId);
      fetchDocumentList();
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const openCitations = (citations?: Citation[]) => {
    if (citations && citations.length > 0) {
      setSelectedCitations(citations);
      setIsDrawerOpen(true);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        documents={documents}
        activeBookFilter={activeBookFilter}
        onSelectBookFilter={setActiveBookFilter}
        onDeleteDocument={handleDeleteDoc}
        onOpenUploadModal={() => setIsUploadOpen(true)}
        onSelectSamplePrompt={(prompt) => handleSend(prompt)}
      />

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-200">
              {activeBookFilter ? (
                <span className="flex items-center gap-2">
                  <span className="text-slate-400">Filter:</span>
                  <span className="text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-2 py-0.5 rounded font-mono text-xs">
                    {activeBookFilter}
                  </span>
                </span>
              ) : (
                'Mechanical Engineering Knowledge Engine'
              )}
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Local Embeddings (BGE) + Gemini RAG
          </div>
        </header>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl text-cyan-400">
                <Sparkles className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-100">Mechanical Engineering RAG Assistant</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Ask questions about fluid mechanics, Navier-Stokes derivations, thermodynamics, or pipe flow.
                Responses feature preserved LaTeX equations ($\sigma = F/A$) and traceable citations.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 max-w-4xl ${msg.sender === 'user' ? 'ml-auto justify-end' : ''}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-cyan-500/20">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`rounded-2xl p-5 border text-sm max-w-3xl space-y-3 ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white border-cyan-500/30'
                      : msg.isError
                      ? 'bg-red-950/40 border-red-800/50 text-red-200'
                      : 'bg-slate-900/80 border-slate-800/80 text-slate-200 backdrop-blur-md shadow-xl'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <p className="leading-relaxed font-medium">{msg.text}</p>
                  ) : (
                    <MathMarkdown content={msg.text} />
                  )}

                  {/* Citations Pill Button */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                      <button
                        onClick={() => openCitations(msg.citations)}
                        className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-md transition-colors font-medium"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>View {msg.citations.length} Verified Sources</span>
                      </button>
                      <span className="text-[10px] text-slate-500 font-mono">{msg.timestamp}</span>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-3 text-slate-400 text-xs font-mono p-4 bg-slate-900/50 rounded-xl border border-slate-800/50 max-w-sm">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Searching ChromaDB & RRF Reranking...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="max-w-4xl mx-auto relative flex items-center"
          >
            <input
              type="text"
              placeholder="Ask an engineering question or formula (e.g. Navier-Stokes, Reynolds number)..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-3.5 pr-12 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors shadow-inner"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-2 p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white disabled:opacity-40 transition-all shadow-md shadow-cyan-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* Modals & Drawers */}
      <CitationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        citations={selectedCitations}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={() => {
          fetchDocumentList();
          setIsUploadOpen(false);
        }}
      />
    </div>
  );
}
