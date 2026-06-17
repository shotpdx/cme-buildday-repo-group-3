'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: { title: string; rows: Record<string, string>[] };
}

const MOCK_RESPONSES: Record<string, { title: string; rows: Record<string, string>[] }> = {
  'average CTR': {
    title: 'CTR by Audience Cohort',
    rows: [
      { Cohort: 'Premium Members', CTR: '6.5%', 'Conv. Rate': '5.2%' },
      { Cohort: 'High-Value', CTR: '4.2%', 'Conv. Rate': '3.8%' },
      { Cohort: 'New Users', CTR: '2.1%', 'Conv. Rate': '1.5%' },
    ],
  },
  'approval rate': {
    title: 'Creatives by Approval Rate',
    rows: [
      { Type: 'Product Hero', Rate: '94%', Generated: '156' },
      { Type: 'Email Header', Rate: '91%', Generated: '89' },
      { Type: 'Social Ad', Rate: '87%', Generated: '234' },
    ],
  },
  'A/B test': {
    title: 'A/B Test Winners',
    rows: [
      { Test: 'Headline Variation', Winner: 'Variant B', Lift: '+23%' },
      { Test: 'CTA Color', Winner: 'Variant B', Lift: '+18%' },
      { Test: 'Image Placement', Winner: 'Variant A', Lift: '+12%' },
    ],
  },
  'activation status': {
    title: 'Activations by Platform',
    rows: [
      { Platform: 'Instagram', Active: '42', Pending: '3' },
      { Platform: 'Facebook', Active: '38', Pending: '5' },
      { Platform: 'TikTok', Active: '31', Pending: '4' },
    ],
  },
  'identity': {
    title: 'ID Resolution Confidence',
    rows: [
      { Level: 'Very High (90-100%)', Count: '234K', Share: '42%' },
      { Level: 'High (70-89%)', Count: '156K', Share: '28%' },
      { Level: 'Medium (50-69%)', Count: '98K', Share: '18%' },
    ],
  },
  'cohort': {
    title: 'Customers by Cohort',
    rows: [
      { Cohort: 'Active Users', Count: '52K', Trend: '+5%' },
      { Cohort: 'Premium', Count: '45K', Trend: '+12%' },
      { Cohort: 'High-Value', Count: '38K', Trend: '+8%' },
    ],
  },
  'cost': {
    title: 'Campaign ROI',
    rows: [
      { Campaign: 'Flash Deal', Cost: '$12K', ROI: '333%' },
      { Campaign: 'Summer Sale', Cost: '$45K', ROI: '247%' },
      { Campaign: 'Q2 Launch', Cost: '$32K', ROI: '206%' },
    ],
  },
};

function findResponse(query: string) {
  const lower = query.toLowerCase();
  for (const [key, response] of Object.entries(MOCK_RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  return null;
}

const SUGGESTIONS = [
  'Average CTR by audience cohort?',
  'Which A/B test variants are winning?',
  'Activation status across platforms?',
  'Total cost and ROI by campaign?',
];

export function AskAIPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToEnd(); }, [messages, scrollToEnd]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === '/' && !open && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        // Can't call onClose inverse here, but the parent handles it
      }
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const submit = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 600));

    const data = findResponse(text);
    const assistantMsg: Message = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: data ? `Here's what I found:` : `I don't have specific data for that query yet, but in production this would query your Genie Space tables.`,
      data: data || undefined,
    };
    setMessages(prev => [...prev, assistantMsg]);
    setLoading(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-50 animate-fade" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-[420px] bg-[var(--surface)] border-l border-[var(--border)] z-50 flex flex-col animate-slide-in shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                <circle cx="7" cy="7" r="5.5"/>
                <path d="M5.5 5.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1-1.5 2"/>
                <circle cx="7" cy="10" r="0.5" fill="var(--accent)"/>
              </svg>
            </div>
            <span className="text-sm font-semibold">Ask AI</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent)] font-medium">
              Genie
            </span>
          </div>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text)] transition-colors p-1">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="pt-8 text-center">
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                Ask questions about your campaigns, audiences, creatives, and performance data.
              </p>
              <div className="space-y-2">
                {SUGGESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => submit(q)}
                    className="w-full text-left text-[13px] px-3 py-2.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all text-[var(--text-secondary)] hover:text-[var(--accent)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-[10px] font-medium text-[var(--text-tertiary)]">Today</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
              {msg.role === 'user' ? (
                <div className="bg-[var(--text)] text-white text-[13px] px-3.5 py-2.5 rounded-2xl rounded-br-sm max-w-[85%]">
                  {msg.content}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[13px] text-[var(--text-secondary)]">{msg.content}</p>
                  {msg.data && (
                    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-[var(--bg)] border-b border-[var(--border)]">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                          {msg.data.title}
                        </span>
                      </div>
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            {Object.keys(msg.data.rows[0]).map(col => (
                              <th key={col} className="text-left px-3 py-2 font-medium text-[var(--text-secondary)]">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.data.rows.map((row, i) => (
                            <tr key={i} className="border-b border-[var(--border)] last:border-0">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="px-3 py-2 text-[var(--text)] font-mono text-[11px]">
                                  {val}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-[13px] text-[var(--text-tertiary)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              Querying...
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--border)] p-4">
          <form onSubmit={(e) => { e.preventDefault(); submit(input); }} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your data..."
              disabled={loading}
              className="flex-1 text-[13px] px-3 py-2 rounded-lg border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 disabled:opacity-50 transition-all bg-[var(--bg)]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-lg bg-[var(--text)] text-white text-[13px] font-medium disabled:opacity-30 hover:bg-[var(--accent)] transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
