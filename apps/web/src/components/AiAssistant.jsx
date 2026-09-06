import { Bot, Loader2, MessageCircle, RotateCcw, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { aiApi } from '../lib/aiApi.js';
import { canManageMasterData, useAuth } from '../lib/AuthContext.jsx';

// Floating AI assistant — bottom-right launcher that opens a chatbot-style
// popup. Read-only: it can explain data and the app, never perform actions.
// Reuses the app's existing navy/lavender/white-card theme; no separate
// visual system. Hidden entirely for CONTACT (defense in depth — the backend
// independently enforces the same ADMIN/ACCOUNTANT-only rule).
export function AiAssistant() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const loadedSuggestions = useRef(false);

  const allowed = user && canManageMasterData(user.role);

  useEffect(() => {
    if (!open || !allowed || loadedSuggestions.current) return;
    loadedSuggestions.current = true;
    aiApi.suggestions()
      .then((data) => { setSuggestions(data.suggestions || []); setAiAvailable(data.aiAvailable !== false); })
      .catch(() => {});
  }, [open, allowed]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  if (!allowed) return null;

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError('');
    setInput('');
    const userMsg = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    try {
      const res = await aiApi.chat(trimmed, conversationId, { currentPage: location.pathname });
      setConversationId(res.conversationId);
      if (res.status === 'not_configured') setAiAvailable(false);
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.answer,
        sources: res.sources,
        failed: res.status === 'provider_error',
      }]);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'Sorry, I could not process that just now.', failed: true }]);
    } finally {
      setSending(false);
    }
  }

  async function clearChat() {
    if (conversationId) await aiApi.clearConversation(conversationId).catch(() => {});
    setMessages([]);
    setConversationId(null);
    setError('');
  }

  return (
    <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div className="flex h-[32rem] w-[22rem] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-borderSoft bg-white shadow-soft sm:w-96">
          <div className="flex items-center justify-between gap-2 bg-navy px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <p className="text-sm font-bold leading-tight">AI Assistant</p>
                <p className="text-[11px] leading-tight text-white/70">Business &amp; accounting Q&amp;A</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={clearChat} aria-label="Clear conversation" className="rounded-lg p-1.5 hover:bg-white/10">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-lg p-1.5 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-page px-3 py-4">
            {!aiAvailable && (
              <div className="rounded-xl border border-borderSoft bg-white p-3 text-xs text-muted">
                The AI assistant is not configured yet. Ask an administrator to set up the AI provider on the server.
              </div>
            )}
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Try asking</p>
                {suggestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="block w-full rounded-xl border border-borderSoft bg-white px-3 py-2 text-left text-sm text-ink shadow-card hover:bg-lavender/20"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-card ${
                    m.role === 'user'
                      ? 'bg-navy text-white'
                      : m.failed
                        ? 'border border-danger/30 bg-danger/10 text-ink'
                        : 'border border-borderSoft bg-white text-ink'
                  }`}
                >
                  {m.content}
                  {m.sources?.length > 0 && (
                    <p className="mt-2 border-t border-borderSoft/70 pt-1 text-[11px] text-muted">
                      Based on: {m.sources.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-borderSoft bg-white px-3 py-2 text-sm text-muted shadow-card">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t border-borderSoft bg-white p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="Ask about sales, receivables, inventory…"
              className="h-10 flex-1 rounded-xl border border-borderSoft bg-page px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-indigo"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white transition hover:bg-indigo disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          {error && <p className="border-t border-borderSoft bg-white px-3 py-1 text-xs text-danger">{error}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white shadow-soft transition hover:bg-indigo focus:outline-none focus:ring-2 focus:ring-indigo focus:ring-offset-2"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
