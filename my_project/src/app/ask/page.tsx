'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Send,
  Lightbulb,
  MessageCircle,
  ArrowLeft,
  Loader,
  Copy,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: QueryResult;
}

interface QueryResult {
  type: 'table' | 'metric' | 'text';
  title: string;
  data?: Record<string, unknown>[];
  metrics?: Record<string, string | number>;
}

const SUGGESTED_QUESTIONS = [
  'What is the average CTR and conversion rate by audience cohort?',
  'Which generated creatives have the highest approval rate?',
  'Which A/B test variants are winners with the highest metric values?',
  'What is the activation status of creatives across different platforms?',
  'What is the identity resolution confidence distribution?',
  'How many customers are in each audience cohort?',
  'Show me campaign activations by destination platform with performance metrics',
  'What is the total cost and ROI by campaign?',
];

// Mock Genie API responses
const MOCK_RESPONSES: Record<string, QueryResult> = {
  'average CTR': {
    type: 'table',
    title: 'Average CTR and Conversion Rate by Audience Cohort',
    data: [
      { cohort: 'High-Value Customers', ctr: '4.2%', conversion_rate: '3.8%', impressions: '125K' },
      { cohort: 'New Users', ctr: '2.1%', conversion_rate: '1.5%', impressions: '89K' },
      { cohort: 'Dormant Users', ctr: '1.8%', conversion_rate: '0.9%', impressions: '42K' },
      { cohort: 'Premium Members', ctr: '6.5%', conversion_rate: '5.2%', impressions: '203K' },
    ],
  },
  'approval rate': {
    type: 'table',
    title: 'Generated Creatives by Approval Rate',
    data: [
      { creative_type: 'Product Hero Image', approval_rate: '94%', total_generated: '156', approved: '147' },
      { creative_type: 'Social Media Ad', approval_rate: '87%', total_generated: '234', approved: '204' },
      { creative_type: 'Email Header', approval_rate: '91%', total_generated: '89', approved: '81' },
      { creative_type: 'Video Thumbnail', approval_rate: '78%', total_generated: '112', approved: '87' },
    ],
  },
  'A/B test': {
    type: 'table',
    title: 'A/B Test Variants Performance',
    data: [
      { test_name: 'Headline Variation', variant_a: 'Original', variant_b: 'New Headline', winner: 'Variant B', lift: '+23%' },
      { test_name: 'CTA Button Color', variant_a: 'Blue', variant_b: 'Purple', winner: 'Variant B', lift: '+18%' },
      { test_name: 'Image Placement', variant_a: 'Left', variant_b: 'Center', winner: 'Variant A', lift: '+12%' },
    ],
  },
  'activation status': {
    type: 'table',
    title: 'Creative Activation Status by Platform',
    data: [
      { platform: 'Instagram', active: '42', inactive: '8', pending: '3', total: '53' },
      { platform: 'Facebook', active: '38', inactive: '12', pending: '5', total: '55' },
      { platform: 'LinkedIn', active: '25', inactive: '4', pending: '2', total: '31' },
      { platform: 'TikTok', active: '31', inactive: '6', pending: '4', total: '41' },
    ],
  },
  'identity resolution': {
    type: 'table',
    title: 'Identity Resolution Confidence Distribution',
    data: [
      { confidence_level: 'Very High (90-100%)', count: '234K', percentage: '42%' },
      { confidence_level: 'High (70-89%)', count: '156K', percentage: '28%' },
      { confidence_level: 'Medium (50-69%)', count: '98K', percentage: '18%' },
      { confidence_level: 'Low (<50%)', count: '68K', percentage: '12%' },
    ],
  },
  'audience cohort': {
    type: 'table',
    title: 'Customer Count by Audience Cohort',
    data: [
      { cohort: 'Premium Members', count: '45K', percentage: '28%', trend: '↑ +12%' },
      { cohort: 'High-Value Customers', count: '38K', percentage: '24%', trend: '↑ +8%' },
      { cohort: 'Active Users', count: '52K', percentage: '32%', trend: '↑ +5%' },
      { cohort: 'Dormant Users', count: '25K', percentage: '16%', trend: '↓ -3%' },
    ],
  },
  'campaign activations': {
    type: 'table',
    title: 'Campaign Activations by Destination Platform',
    data: [
      { platform: 'Instagram', activations: '156', reach: '2.3M', engagement: '8.2%', roi: '3.4x' },
      { platform: 'Facebook', activations: '142', reach: '1.8M', engagement: '6.1%', roi: '2.9x' },
      { platform: 'Email', activations: '89', reach: '450K', engagement: '12.4%', roi: '4.2x' },
      { platform: 'LinkedIn', activations: '67', reach: '320K', engagement: '4.8%', roi: '2.1x' },
    ],
  },
  'cost and ROI': {
    type: 'table',
    title: 'Total Cost and ROI by Campaign',
    data: [
      { campaign: 'Summer Sale 2024', cost: '$45,000', revenue: '$156,000', roi: '247%' },
      { campaign: 'Q2 Product Launch', cost: '$32,000', revenue: '$98,000', roi: '206%' },
      { campaign: 'Holiday Special', cost: '$58,000', revenue: '$201,000', roi: '247%' },
      { campaign: 'Flash Deal', cost: '$12,000', revenue: '$52,000', roi: '333%' },
    ],
  },
};

// Helper to find matching response
function findMockResponse(query: string): QueryResult {
  const lowerQuery = query.toLowerCase();
  
  for (const [key, response] of Object.entries(MOCK_RESPONSES)) {
    if (lowerQuery.includes(key)) {
      return response;
    }
  }

  // Default response
  return {
    type: 'text',
    title: 'Query Result',
    data: [{ response: `I found information related to your query: "${query}". This is a mock response for the MVP.` }],
  };
}

// Table display component
function ResultsTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            {columns.map((col) => (
              <th key={col} className="text-left py-3 px-4 font-semibold text-slate-300">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
              {columns.map((col) => (
                <td key={`${idx}-${col}`} className="py-3 px-4 text-slate-300">
                  {String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Message component
function ChatMessage({ message, onCopy }: { message: Message; onCopy: (text: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 animate-fade-in ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      {message.role === 'assistant' && (
        <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-4 h-4 text-purple-400" />
        </div>
      )}
      
      <div className={`max-w-2xl ${message.role === 'user' ? 'bg-purple-600/20 text-purple-100' : 'bg-slate-700/50 text-slate-100'} rounded-lg p-4`}>
        <p className="mb-3">{message.content}</p>
        
        {message.data && (
          <div className="mt-4 bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
            <h4 className="font-semibold text-slate-200 mb-3">{message.data.title}</h4>
            {message.data.type === 'table' && message.data.data && (
              <ResultsTable data={message.data.data} />
            )}
            {message.data.type === 'metric' && message.data.metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(message.data.metrics).map(([key, value]) => (
                  <div key={key} className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
                    <p className="text-xs text-slate-400 mb-1">{key}</p>
                    <p className="text-lg font-semibold text-slate-100">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {message.role === 'assistant' && (
          <button
            onClick={handleCopy}
            className="mt-2 text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Get mock response
    const queryResult = findMockResponse(input);
    const assistantMessage: Message = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: `Here's what I found for your query: "${input}"`,
      timestamp: new Date(),
      data: queryResult,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-700/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-slate-400 hover:text-slate-300 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-6 h-6 text-purple-400" />
                <h1 className="text-xl font-bold text-white">Ask AI</h1>
              </div>
            </div>
            <p className="text-sm text-slate-400">Powered by Databricks Genie</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Chat Area */}
        <div className="flex flex-col h-[calc(100vh-200px)] bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mb-4">
                  <Lightbulb className="w-8 h-8 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Ask me anything</h2>
                <p className="text-slate-400 mb-8 max-w-md">
                  Ask questions about your campaign data, audience insights, creative performance, and more.
                </p>

                {/* Suggested Questions */}
                <div className="w-full">
                  <p className="text-sm text-slate-400 mb-4">Try asking:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {SUGGESTED_QUESTIONS.slice(0, 4).map((question, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestedQuestion(question)}
                        className="text-left p-3 rounded-lg bg-slate-700/30 border border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600 transition-all text-sm group"
                      >
                        <div className="flex items-start gap-2">
                          <Lightbulb className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span className="group-hover:text-slate-100 transition-colors">{question}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} onCopy={handleCopy} />
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                      <Loader className="w-4 h-4 text-purple-400 animate-spin" />
                    </div>
                    <div className="bg-slate-700/50 text-slate-100 rounded-lg p-4 flex items-center gap-2">
                      <span>Analyzing your query</span>
                      <span className="flex gap-1">
                        <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                        <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-700/50 bg-slate-900/50 p-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about your data..."
                disabled={isLoading}
                className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50 transition-all"
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>

            {/* More suggestions below input */}
            {messages.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <p className="text-xs text-slate-500 mb-3">Other questions you can ask:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.slice(4).map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestedQuestion(question)}
                      className="text-xs px-3 py-1.5 rounded-full bg-slate-700/30 border border-slate-700/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 hover:border-slate-600 transition-all"
                    >
                      {question.substring(0, 40)}...
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
