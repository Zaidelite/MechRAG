'use client';

import React, { useState, useEffect, useRef } from 'react';
import MathMarkdown from '../components/MathMarkdown';
import { sendQuery, fetchAvailableModels } from '../services/api';
import { ChatMessage } from '../types';
import { ArrowUp, Loader2, Sparkles, ChevronDown } from 'lucide-react';

interface ModelOption {
  id: string;
  name: string;
  badge?: string;
}

const FALLBACK_MODELS: ModelOption[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', badge: 'Flash' },
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Model Selection State
  const [models, setModels] = useState<ModelOption[]>(FALLBACK_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState<boolean>(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch dynamic verified model list from backend on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await fetchAvailableModels();
        if (res.models && res.models.length > 0) {
          const apiModels: ModelOption[] = res.models.map((m) => {
            let badge: string | undefined = undefined;
            const lower = m.id.toLowerCase();
            if (lower.includes('gemma')) badge = 'Gemma';
            else if (lower.includes('pro')) badge = 'Pro';
            else if (lower.includes('flash')) badge = 'Flash';

            return {
              id: m.id,
              name: m.name || m.id,
              badge,
            };
          });
          setModels(apiModels);
          if (!apiModels.some((m) => m.id === selectedModel)) {
            setSelectedModel(apiModels[0].id);
          }
        }
      } catch (err) {
        console.warn('Could not fetch dynamic model list from backend:', err);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = async () => {
    const textToSend = inputValue.trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await sendQuery(textToSend, undefined, selectedModel);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: res.answer,
        citations: res.citations,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;
  const currentModelObj = models.find((m) => m.id === selectedModel);

  return (
    <div className="mech-root">
      {/* Header */}
      <header className="mech-header">
        <h1 className="mech-title">
          MechRAG
          <span className="mech-version">v1.0.0</span>
        </h1>
      </header>

      {/* Chat area */}
      <main className={`mech-main ${isEmpty ? 'mech-main--empty' : ''}`}>
        {isEmpty ? (
          <div className="mech-empty">
            <p className="mech-empty-hint">Ask anything about your engineering textbooks…</p>
          </div>
        ) : (
          <div className="mech-feed custom-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`mech-msg mech-msg--${msg.sender}`}>
                {msg.sender === 'user' ? (
                  <p className="mech-user-text">{msg.text}</p>
                ) : (
                  <div className={`mech-ai-text ${msg.isError ? 'mech-ai-text--error' : ''}`}>
                    <MathMarkdown content={msg.text} />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="mech-msg mech-msg--assistant">
                <div className="mech-thinking">
                  <Loader2 className="mech-spinner" />
                  <span>Thinking…</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}

        {/* Input Box */}
        <div className={`mech-input-wrap ${isEmpty ? 'mech-input-wrap--centered' : ''}`}>
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="mech-input-form"
          >
            {/* Dynamic Model Picker on Left Side */}
            <div className="mech-model-picker-wrap" ref={dropdownRef}>
              <button
                type="button"
                className="mech-model-picker-btn"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                title="Select Model"
              >
                <Sparkles className="mech-model-icon" />
                <span className="mech-model-name">{currentModelObj?.name || selectedModel}</span>
                <ChevronDown className={`mech-model-chevron ${isModelDropdownOpen ? 'mech-model-chevron--open' : ''}`} />
              </button>

              {isModelDropdownOpen && (
                <div className="mech-model-dropdown">
                  {models.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      className={`mech-model-item ${selectedModel === model.id ? 'mech-model-item--active' : ''}`}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setIsModelDropdownOpen(false);
                      }}
                    >
                      <span className="mech-model-item-title">{model.name}</span>
                      {model.badge && (
                        <span className="mech-model-item-badge">{model.badge}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <textarea
              ref={inputRef}
              id="mech-query-input"
              placeholder="Ask an engineering question…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
              className="mech-textarea"
            />

            <button
              type="submit"
              id="mech-send-btn"
              disabled={!inputValue.trim() || isLoading}
              className="mech-send-btn"
              aria-label="Send message"
            >
              <ArrowUp className="mech-send-icon" />
            </button>
          </form>
          <p className="mech-disclaimer">
            MechRAG · local embeddings · traceable citations
          </p>
        </div>
      </main>
    </div>
  );
}
