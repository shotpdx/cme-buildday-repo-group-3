'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: { title: string; rows: Record<string, string>[] };
}

const MOCK_RESPONSES: Record<string, { title: string; rows: Record<string, string>[] }> = {
  'average CTR': { title: 'CTR by Audience Cohort', rows: [{ Cohort: 'Premium Members', CTR: '6.5%', 'Conv Rate': '5.2%' }, { Cohort: 'High-Value', CTR: '4.2%', 'Conv Rate': '3.8%' }, { Cohort: 'New Users', CTR: '2.1%', 'Conv Rate': '1.5%' }, { Cohort: 'Dormant', CTR: '1.8%', 'Conv Rate': '0.9%' }] },
  'approval rate': { title: 'Creatives by Approval Rate', rows: [{ Type: 'Product Hero', Rate: '94%', Total: '156' }, { Type: 'Email Header', Rate: '91%', Total: '89' }, { Type: 'Social Ad', Rate: '87%', Total: '234' }, { Type: 'Video Thumb', Rate: '78%', Total: '112' }] },
  'A/B test': { title: 'A/B Test Winners', rows: [{ Test: 'Headline Variation', Winner: 'Variant B', Lift: '+23%' }, { Test: 'CTA Color', Winner: 'Variant B', Lift: '+18%' }, { Test: 'Image Position', Winner: 'Variant A', Lift: '+12%' }] },
  'activation status': { title: 'Activations by Platform', rows: [{ Platform: 'Instagram', Active: '42', Pending: '3', Total: '53' }, { Platform: 'Facebook', Active: '38', Pending: '5', Total: '55' }, { Platform: 'TikTok', Active: '31', Pending: '4', Total: '41' }] },
  'identity': { title: 'ID Resolution Confidence', rows: [{ Level: 'Very High (90-100%)', Count: '234K', Share: '42%' }, { Level: 'High (70-89%)', Count: '156K', Share: '28%' }, { Level: 'Medium (50-69%)', Count: '98K', Share: '18%' }, { Level: 'Low (<50%)', Count: '68K', Share: '12%' }] },
  'cohort': { title: 'Customers by Cohort', rows: [{ Cohort: 'Active Users', Count: '52K', Trend: '+5%' }, { Cohort: 'Premium', Count: '45K', Trend: '+12%' }, { Cohort: 'High-Value', Count: '38K', Trend: '+8%' }, { Cohort: 'Dormant', Count: '25K', Trend: '-3%' }] },
  'cost': { title: 'Campaign ROI', rows: [{ Campaign: 'Flash Deal', Cost: '$12K', Revenue: '$52K', ROI: '333%' }, { Campaign: 'Summer Sale', Cost: '$45K', Revenue: '$156K', ROI: '247%' }, { Campaign: 'Q2 Launch', Cost: '$32K', Revenue: '$98K', ROI: '206%' }] },
  'platform': { title: 'Performance by Platform', rows: [{ Platform: 'Email', Activations: '89', Engagement: '12.4%', ROI: '4.2x' }, { Platform: 'Instagram', Activations: '156', Engagement: '8.2%', ROI: '3.4x' }, { Platform: 'Facebook', Activations: '142', Engagement: '6.1%', ROI: '2.9x' }] },
};

function findResponse(query: string) {
  const lower = query.toLowerCase();
  for (const [key, response] of Object.entries(MOCK_RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  return null;
}

const SUGGESTIONS = [
  'What is the average CTR by audience cohort?',
  'Which A/B test variants are winners?',
  'Show activation status across platforms',
  'What is the total cost and ROI by campaign?',
  'Identity resolution confidence distribution?',
  'How many customers in each cohort?',
  'Creative approval rate by type?',
  'Performance by platform with engagement metrics?',
];

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(() => { scrollToEnd(); }, [messages, scrollToEnd]);

  const submit = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    const data = findResponse(text);
    setMessages(prev => [...prev, {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: data ? 'Here are the results:' : 'I don\'t have specific data for that query yet. In production, this queries your Genie Space tables.',
      data: data || undefined,
    }]);
    setLoading(false);
  };

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8 h-[calc(100vh-56px)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Ask AI</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Query your campaign data with natural language. Powered by Databricks Genie.
        </p>
      </div>

      {/* Chat area */}
      <div className="flex-1 border border-[var(--border)] rounded-lg overflow-hidden flex flex-col bg-[var(--surface)]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center">
              <p className="text-[13px] text-[var(--text-tertiary)] mb-6">Try one of these questions:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-[600px]">
                {SUGGESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => submit(q)}
                    className="text-left text-[12px] px-3 py-2.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all text-[var(--text-secondary)] hover:text-[var(--accent)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              {msg.role === 'user' ? (
                <div className="bg-[var(--text)] text-white text-[13px] px-3 py-2 rounded-lg rounded-br-sm max-w-[75%]">
                  {msg.content}
                </div>
              ) : (
                <div className="space-y-2 max-w-[85%]">
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
                              <th key={col} className="text-left px-3 py-2 font-medium text-[var(--text-secondary)]">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.data.rows.map((row, i) => (
                            <tr key={i} className="border-b border-[var(--border)] last:border-0">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="px-3 py-2 font-mono text-[11px]">{val}</td>
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
              Querying Genie Space...
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--border)] p-4 bg-[var(--bg)]">
          <form onSubmit={(e) => { e.preventDefault(); submit(input); }} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your campaigns, audiences, creatives..."
              disabled={loading}
              className="flex-1 text-[13px] px-3 py-2.5 rounded-lg border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 disabled:opacity-50 bg-[var(--surface)]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 rounded-lg bg-[var(--text)] text-white text-[13px] font-medium disabled:opacity-30 hover:bg-[var(--accent)] transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
