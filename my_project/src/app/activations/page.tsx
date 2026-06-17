'use client';

import { useState, useMemo } from 'react';

interface Activation {
  activation_id: string;
  creative_asset_id: string;
  campaign_id: string;
  destination_platform: string;
  trafficking_status: 'Draft' | 'Submitted' | 'Live' | 'Paused' | 'Ended';
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ab_test_id: string | null;
  last_sync_ts: string;
}

const ACTIVATIONS: Activation[] = [
  { activation_id: 'ACT-000', creative_asset_id: 'CAD-001', campaign_id: 'CAMP-0000', destination_platform: 'The Trade Desk', trafficking_status: 'Live', impressions: 125000, clicks: 3750, conversions: 375, cost: 625.50, ab_test_id: 'AB-000', last_sync_ts: '2024-11-20 14:22' },
  { activation_id: 'ACT-001', creative_asset_id: 'CAD-002', campaign_id: 'CAMP-0000', destination_platform: 'DV360', trafficking_status: 'Live', impressions: 250000, clicks: 6250, conversions: 625, cost: 1250.75, ab_test_id: 'AB-000', last_sync_ts: '2024-11-20 13:45' },
  { activation_id: 'ACT-002', creative_asset_id: 'CAD-003', campaign_id: 'CAMP-0001', destination_platform: 'Amazon DSP', trafficking_status: 'Live', impressions: 180000, clicks: 4320, conversions: 432, cost: 900.00, ab_test_id: null, last_sync_ts: '2024-11-20 12:30' },
  { activation_id: 'ACT-003', creative_asset_id: 'CAD-004', campaign_id: 'CAMP-0001', destination_platform: 'Meta', trafficking_status: 'Paused', impressions: 95000, clicks: 2850, conversions: 285, cost: 475.25, ab_test_id: 'AB-001', last_sync_ts: '2024-11-15 10:00' },
  { activation_id: 'ACT-004', creative_asset_id: 'CAD-005', campaign_id: 'CAMP-0002', destination_platform: 'Google Ads', trafficking_status: 'Live', impressions: 320000, clicks: 8960, conversions: 896, cost: 1600.00, ab_test_id: null, last_sync_ts: '2024-11-20 15:10' },
  { activation_id: 'ACT-005', creative_asset_id: 'CAD-006', campaign_id: 'CAMP-0002', destination_platform: 'TikTok', trafficking_status: 'Draft', impressions: 0, clicks: 0, conversions: 0, cost: 0, ab_test_id: 'AB-002', last_sync_ts: '2024-11-18 16:20' },
  { activation_id: 'ACT-006', creative_asset_id: 'CAD-007', campaign_id: 'CAMP-0003', destination_platform: 'Innovid', trafficking_status: 'Live', impressions: 210000, clicks: 5250, conversions: 525, cost: 1050.00, ab_test_id: null, last_sync_ts: '2024-11-20 11:45' },
  { activation_id: 'ACT-007', creative_asset_id: 'CAD-008', campaign_id: 'CAMP-0003', destination_platform: 'The Trade Desk', trafficking_status: 'Ended', impressions: 450000, clicks: 10800, conversions: 1080, cost: 2250.00, ab_test_id: 'AB-001', last_sync_ts: '2024-11-10 14:30' },
  { activation_id: 'ACT-008', creative_asset_id: 'CAD-001', campaign_id: 'CAMP-0004', destination_platform: 'DV360', trafficking_status: 'Live', impressions: 175000, clicks: 3500, conversions: 350, cost: 875.00, ab_test_id: null, last_sync_ts: '2024-11-20 16:00' },
  { activation_id: 'ACT-009', creative_asset_id: 'CAD-002', campaign_id: 'CAMP-0004', destination_platform: 'Meta', trafficking_status: 'Submitted', impressions: 0, clicks: 0, conversions: 0, cost: 0, ab_test_id: 'AB-003', last_sync_ts: '2024-11-19 10:30' },
];

const STATUS_STYLES: Record<string, string> = {
  Live: 'bg-[var(--success-subtle)] text-[var(--success)]',
  Paused: 'bg-[var(--warning-subtle)] text-[var(--warning)]',
  Draft: 'bg-[var(--bg)] text-[var(--text-secondary)]',
  Submitted: 'bg-[var(--info-subtle)] text-[var(--info)]',
  Ended: 'bg-[var(--danger-subtle)] text-[var(--danger)]',
};

function fmt(n: number) { return n.toLocaleString(); }
function pct(a: number, b: number) { return b > 0 ? ((a / b) * 100).toFixed(2) : '—'; }

export default function ActivationsPage() {
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const platforms = Array.from(new Set(ACTIVATIONS.map(a => a.destination_platform))).sort();
  const statuses = Array.from(new Set(ACTIVATIONS.map(a => a.trafficking_status)));

  const filtered = useMemo(() => {
    return ACTIVATIONS.filter(a => {
      return (!platformFilter || a.destination_platform === platformFilter) &&
             (!statusFilter || a.trafficking_status === statusFilter);
    });
  }, [platformFilter, statusFilter]);

  const totals = useMemo(() => {
    const t = filtered.reduce((acc, a) => ({
      impressions: acc.impressions + a.impressions,
      clicks: acc.clicks + a.clicks,
      conversions: acc.conversions + a.conversions,
      cost: acc.cost + a.cost,
    }), { impressions: 0, clicks: 0, conversions: 0, cost: 0 });
    return { ...t, ctr: pct(t.clicks, t.impressions), cvr: pct(t.conversions, t.clicks) };
  }, [filtered]);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Activations</h1>
        <p className="text-sm text-[var(--text-secondary)]">Campaign trafficking and performance across platforms.</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden mb-6">
        {[
          { label: 'Impressions', value: fmt(totals.impressions) },
          { label: 'Clicks', value: fmt(totals.clicks) },
          { label: 'CTR', value: `${totals.ctr}%` },
          { label: 'Conversions', value: fmt(totals.conversions) },
          { label: 'Conv. Rate', value: `${totals.cvr}%` },
          { label: 'Spend', value: `$${totals.cost.toFixed(0)}` },
        ].map((m) => (
          <div key={m.label} className="bg-[var(--surface)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium mb-1">{m.label}</p>
            <p className="text-[15px] font-semibold font-mono">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="text-[12px] px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] focus:border-[var(--accent)] focus:outline-none"
        >
          <option value="">All Platforms</option>
          {platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-[12px] px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] focus:border-[var(--accent)] focus:outline-none"
        >
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                {['ID', 'Platform', 'Status', 'Impressions', 'Clicks', 'CTR', 'Conv.', 'CVR', 'Spend', 'A/B Test', 'Synced'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((a, i) => (
                <tr
                  key={a.activation_id}
                  className="hover:bg-[var(--bg)] transition-colors animate-slide-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <td className="px-3 py-2.5 text-[12px] font-mono font-medium">{a.activation_id}</td>
                  <td className="px-3 py-2.5 text-[12px] text-[var(--text-secondary)]">{a.destination_platform}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_STYLES[a.trafficking_status]}`}>
                      {a.trafficking_status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right">{fmt(a.impressions)}</td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right">{fmt(a.clicks)}</td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right font-medium">{pct(a.clicks, a.impressions)}%</td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right">{fmt(a.conversions)}</td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right font-medium">{pct(a.conversions, a.clicks)}%</td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right">${a.cost.toFixed(0)}</td>
                  <td className="px-3 py-2.5 text-[11px] font-mono text-[var(--text-tertiary)]">{a.ab_test_id || '—'}</td>
                  <td className="px-3 py-2.5 text-[10px] font-mono text-[var(--text-tertiary)]">{a.last_sync_ts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">{filtered.length} of {ACTIVATIONS.length} activations</p>
    </div>
  );
}
