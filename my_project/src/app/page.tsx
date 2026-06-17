'use client';

import Link from 'next/link';

const metrics = [
  { label: 'Impressions', value: '123,456,789', change: '+0.4%', up: true, period: 'May 5 – May 11' },
  { label: 'Reach', value: '45,678,123', change: '+2.1%', up: true, period: 'May 5 – May 11' },
  { label: 'Frequency', value: '2.70', change: '-0.1', up: false, period: 'avg' },
  { label: 'CTR (All)', value: '0.78%', change: '+0.04pp', up: true, period: 'May 5 – May 11' },
  { label: 'Conversions', value: '12,345', change: '+8%', up: true, period: 'May 5 – May 11' },
  { label: 'Spend', value: '$1,234,567', change: '-3%', up: false, period: 'May 5 – May 11' },
];

const activity = [
  { label: 'Campaign "Summer Launch 2025" was activated', detail: 'Multi-Channel — US, CA', time: '2m ago', color: 'bg-[var(--success)]' },
  { label: 'Audience "High Intent Shoppers" updated', detail: 'Segment size changed +12.5%', time: '14m ago', color: 'bg-[var(--accent)]' },
  { label: 'Creative "SL_15s_Story_A" approved', detail: 'Version 3', time: '1h ago', color: 'bg-[var(--success)]' },
  { label: 'Budget reallocation completed', detail: '$200,000 moved from Display to Paid Social', time: '2h ago', color: 'bg-[var(--danger)]' },
  { label: 'Performance alert: CTR below benchmark', detail: 'Campaign "Spring Promo" — Display — US', time: '4h ago', color: 'bg-[var(--warning)]' },
];

const platforms = [
  { name: 'Meta (Facebook/Instagram)', spend: '$456,789', pct: 37 },
  { name: 'Google Ads (Search/YouTube)', spend: '$345,678', pct: 28 },
  { name: 'The Trade Desk', spend: '$198,765', pct: 16 },
  { name: 'TikTok', spend: '$135,432', pct: 11 },
  { name: 'Display (Programmatic)', spend: '$97,903', pct: 8 },
];

const quickActions = [
  { href: '/briefs', label: 'Campaign', icon: '◎' },
  { href: '/audiences', label: 'Audience', icon: '◉' },
  { href: '/creatives', label: 'Creative', icon: '◈' },
  { href: '/activations', label: 'Activation', icon: '▸' },
];

export default function HomePage() {
  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Overview</h1>
          <p className="text-[12px] text-[var(--text-tertiary)] font-mono">
            May 12 – May 19, 2025 &nbsp;·&nbsp; All Campaigns &nbsp;·&nbsp; All Channels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-[11px] px-2.5 py-1.5 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
            Filters
          </button>
        </div>
      </div>

      {/* Metrics grid — large numbers like mockup */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden mb-10">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className="bg-[var(--surface)] p-5 animate-slide-up"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-3">
              {m.label}
            </p>
            <p className="text-[22px] font-bold font-mono tracking-tight mb-1.5 leading-none">{m.value}</p>
            <p className={`text-[11px] font-medium font-mono ${m.up ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {m.change} <span className="text-[var(--text-tertiary)]">{m.period}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity feed */}
        <div className="lg:col-span-2">
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Recent Activity
              </h2>
              <button className="text-[11px] text-[var(--accent)] font-medium hover:underline">View all activity →</button>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {activity.map((item, i) => (
                <div
                  key={i}
                  className="px-5 py-3.5 flex items-start gap-3 hover:bg-[var(--bg)] transition-colors animate-slide-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${item.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[var(--text)] font-medium">{item.label}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{item.detail}</p>
                  </div>
                  <span className="text-[11px] text-[var(--text-tertiary)] font-mono flex-shrink-0">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--bg)]">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Quick Actions
              </h2>
            </div>
            <div className="grid grid-cols-4 divide-x divide-[var(--border)]">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex flex-col items-center justify-center py-5 hover:bg-[var(--bg)] transition-colors group"
                >
                  <span className="text-lg mb-1.5 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors">
                    {action.icon}
                  </span>
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Spend by Platform */}
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Spend by Platform
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
                <span>Total Spend</span>
                <span className="font-mono font-semibold text-[var(--text)]">$1,234,567</span>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {platforms.map((p) => (
                <div key={p.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--text)]">{p.name}</span>
                    <span className="text-[11px] font-mono font-medium text-[var(--text)]">{p.spend}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[var(--bg)] rounded-sm overflow-hidden">
                      <div
                        className="h-full rounded-sm"
                        style={{ width: `${p.pct}%`, backgroundColor: 'var(--accent)' }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)] w-6 text-right">{p.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-2 border-t border-[var(--border)] bg-[var(--bg)] text-right">
              <button className="text-[11px] text-[var(--accent)] font-medium hover:underline">View full report →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
