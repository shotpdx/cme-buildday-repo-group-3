'use client';

import { useState, useMemo } from 'react';

interface Brief {
  brief_id: string;
  brief_name: string;
  brand_name: string;
  campaign_objective: string;
  target_audience_description: string;
  status: 'Draft' | 'In Review' | 'Approved' | 'Active';
  created_ts: string;
  concepts_count: number;
  creatives_count: number;
}

const BRIEFS: Brief[] = [
  { brief_id: 'BRIEF-001', brief_name: 'Summer Campaign 2024', brand_name: 'TechCorp', campaign_objective: 'Increase brand awareness among Gen Z', target_audience_description: 'Ages 18-24, tech enthusiasts, urban', status: 'Active', created_ts: '2024-01-15', concepts_count: 5, creatives_count: 23 },
  { brief_id: 'BRIEF-002', brief_name: 'Product Launch Q2', brand_name: 'InnovateLabs', campaign_objective: 'Drive product trial and adoption', target_audience_description: 'Early adopters, professionals 25-40', status: 'Approved', created_ts: '2024-01-10', concepts_count: 3, creatives_count: 12 },
  { brief_id: 'BRIEF-003', brief_name: 'Holiday Season Push', brand_name: 'RetailMax', campaign_objective: 'Maximize holiday season sales', target_audience_description: 'Families, gift-givers, 30-55', status: 'In Review', created_ts: '2024-01-08', concepts_count: 4, creatives_count: 8 },
  { brief_id: 'BRIEF-004', brief_name: 'Sustainability Initiative', brand_name: 'EcoGreen', campaign_objective: 'Promote eco-friendly product line', target_audience_description: 'Eco-conscious consumers, 25-50', status: 'Draft', created_ts: '2024-01-05', concepts_count: 2, creatives_count: 0 },
  { brief_id: 'BRIEF-005', brief_name: 'B2B Enterprise Solutions', brand_name: 'CloudSync', campaign_objective: 'Acquire enterprise clients', target_audience_description: 'CTOs, IT directors, decision makers', status: 'Active', created_ts: '2024-01-02', concepts_count: 6, creatives_count: 18 },
  { brief_id: 'BRIEF-006', brief_name: 'Mobile App Promotion', brand_name: 'AppFlow', campaign_objective: 'Increase app downloads and engagement', target_audience_description: 'Mobile-first users, 18-35', status: 'Approved', created_ts: '2023-12-28', concepts_count: 3, creatives_count: 15 },
];

const STATUS_STYLES: Record<Brief['status'], string> = {
  Draft: 'bg-[var(--bg)] text-[var(--text-secondary)] border-[var(--border)]',
  'In Review': 'bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--warning)]/20',
  Approved: 'bg-[var(--success-subtle)] text-[var(--success)] border-[var(--success)]/20',
  Active: 'bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]/20',
};

export default function BriefsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return BRIEFS.filter((b) => {
      const matchesSearch = !search || b.brief_name.toLowerCase().includes(search.toLowerCase()) || b.brand_name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Creative Briefs</h1>
        <p className="text-sm text-[var(--text-secondary)]">Campaign briefs with objectives, audience targeting, and linked assets.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or brand..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs text-[13px] px-3 py-2 rounded-lg border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 bg-[var(--surface)]"
        />
        <div className="flex gap-1">
          {['all', 'Draft', 'In Review', 'Approved', 'Active'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                statusFilter === s
                  ? 'bg-[var(--text)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Brief</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Brand</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Objective</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Audience</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Status</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Concepts</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Creatives</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((brief, i) => (
                <tr
                  key={brief.brief_id}
                  className="hover:bg-[var(--bg)] transition-colors animate-slide-up cursor-pointer"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-medium">{brief.brief_name}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] font-mono">{brief.brief_id}</p>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)]">{brief.brand_name}</td>
                  <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)] max-w-[200px] truncate">{brief.campaign_objective}</td>
                  <td className="px-4 py-3 text-[12px] text-[var(--text-tertiary)] max-w-[160px] truncate">{brief.target_audience_description}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${STATUS_STYLES[brief.status]}`}>
                      {brief.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] font-mono text-[var(--text-secondary)]">{brief.concepts_count}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-mono text-[var(--text-secondary)]">{brief.creatives_count}</td>
                  <td className="px-4 py-3 text-[12px] font-mono text-[var(--text-tertiary)]">{brief.created_ts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-[13px] text-[var(--text-tertiary)]">No briefs match your filters.</div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">
        {filtered.length} of {BRIEFS.length} briefs
      </p>
    </div>
  );
}
