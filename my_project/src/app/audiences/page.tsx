'use client';

import { useState, useMemo } from 'react';

type DefinitionType = 'rule_based' | 'ml_model' | 'lookalike' | 'manual';

interface Cohort {
  cohort_id: string;
  cohort_name: string;
  cohort_description: string;
  definition_type: DefinitionType;
  personalization_granularity: 'Segment' | 'Micro_Cohort' | 'One_to_One';
  estimated_reach: number;
  is_region_allowed: boolean;
  is_channel_allowed: boolean;
  is_frequency_capped: boolean;
  status: 'Active' | 'Archived';
  last_updated_ts: string;
}

const COHORTS: Cohort[] = [
  { cohort_id: 'COH-001', cohort_name: 'High-Value Customers', cohort_description: 'LTV > $5000, recent purchase', definition_type: 'rule_based', personalization_granularity: 'Segment', estimated_reach: 125000, is_region_allowed: true, is_channel_allowed: true, is_frequency_capped: true, status: 'Active', last_updated_ts: '2024-11-20' },
  { cohort_id: 'COH-002', cohort_name: 'Tech Enthusiasts', cohort_description: 'ML-based tech interest segment', definition_type: 'ml_model', personalization_granularity: 'Micro_Cohort', estimated_reach: 250000, is_region_allowed: true, is_channel_allowed: false, is_frequency_capped: false, status: 'Active', last_updated_ts: '2024-11-19' },
  { cohort_id: 'COH-003', cohort_name: 'Competitor Lookalikes', cohort_description: 'Lookalike from competitor data', definition_type: 'lookalike', personalization_granularity: 'Segment', estimated_reach: 500000, is_region_allowed: false, is_channel_allowed: true, is_frequency_capped: true, status: 'Active', last_updated_ts: '2024-11-18' },
  { cohort_id: 'COH-004', cohort_name: 'Manual Exclusion List', cohort_description: 'Opted-out users', definition_type: 'manual', personalization_granularity: 'One_to_One', estimated_reach: 50000, is_region_allowed: true, is_channel_allowed: true, is_frequency_capped: false, status: 'Active', last_updated_ts: '2024-11-20' },
  { cohort_id: 'COH-005', cohort_name: 'Seasonal Shoppers', cohort_description: 'Seasonal purchase patterns', definition_type: 'ml_model', personalization_granularity: 'Micro_Cohort', estimated_reach: 180000, is_region_allowed: true, is_channel_allowed: true, is_frequency_capped: true, status: 'Active', last_updated_ts: '2024-11-17' },
  { cohort_id: 'COH-006', cohort_name: 'Legacy Segment', cohort_description: 'Previous campaign, deprecated', definition_type: 'rule_based', personalization_granularity: 'Segment', estimated_reach: 75000, is_region_allowed: false, is_channel_allowed: false, is_frequency_capped: false, status: 'Archived', last_updated_ts: '2024-10-15' },
  { cohort_id: 'COH-007', cohort_name: 'Mobile-First Users', cohort_description: 'Primary mobile access', definition_type: 'rule_based', personalization_granularity: 'Segment', estimated_reach: 320000, is_region_allowed: true, is_channel_allowed: true, is_frequency_capped: false, status: 'Active', last_updated_ts: '2024-11-20' },
  { cohort_id: 'COH-008', cohort_name: 'Premium Tier Members', cohort_description: 'Premium subscription tier', definition_type: 'rule_based', personalization_granularity: 'One_to_One', estimated_reach: 45000, is_region_allowed: true, is_channel_allowed: true, is_frequency_capped: true, status: 'Active', last_updated_ts: '2024-11-20' },
];

const TYPE_LABELS: Record<DefinitionType, string> = { rule_based: 'Rule', ml_model: 'ML', lookalike: 'Lookalike', manual: 'Manual' };
const TYPE_STYLES: Record<DefinitionType, string> = {
  rule_based: 'bg-[var(--info-subtle)] text-[var(--info)]',
  ml_model: 'bg-[#F5F3FF] text-[#7C3AED]',
  lookalike: 'bg-[var(--warning-subtle)] text-[var(--warning)]',
  manual: 'bg-[var(--bg)] text-[var(--text-secondary)]',
};

function formatReach(n: number) {
  return n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
}

export default function AudiencesPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('Active');

  const filtered = useMemo(() => {
    return COHORTS.filter((c) => {
      const matchesType = typeFilter === 'all' || c.definition_type === typeFilter;
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesType && matchesStatus;
    }).sort((a, b) => b.estimated_reach - a.estimated_reach);
  }, [typeFilter, statusFilter]);

  const totalReach = filtered.reduce((sum, c) => sum + c.estimated_reach, 0);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Audiences</h1>
          <p className="text-sm text-[var(--text-secondary)]">Cohort definitions, reach estimates, and eligibility flags.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold font-mono tracking-tight">{formatReach(totalReach)}</p>
          <p className="text-[11px] text-[var(--text-tertiary)]">total reach</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1">
          {['all', 'rule_based', 'ml_model', 'lookalike', 'manual'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                typeFilter === t ? 'bg-[var(--text)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'
              }`}
            >
              {t === 'all' ? 'All Types' : TYPE_LABELS[t as DefinitionType]}
            </button>
          ))}
        </div>
        <div className="w-px bg-[var(--border)]" />
        <div className="flex gap-1">
          {['all', 'Active', 'Archived'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                statusFilter === s ? 'bg-[var(--text)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cohort, i) => (
          <div
            key={cohort.cohort_id}
            className="border border-[var(--border)] rounded-lg p-4 hover:border-[var(--border-strong)] transition-colors bg-[var(--surface)] animate-slide-up cursor-pointer"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-[14px] font-semibold">{cohort.cohort_name}</h3>
                <p className="text-[11px] text-[var(--text-tertiary)] font-mono">{cohort.cohort_id}</p>
              </div>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_STYLES[cohort.definition_type]}`}>
                {TYPE_LABELS[cohort.definition_type]}
              </span>
            </div>

            <p className="text-[12px] text-[var(--text-secondary)] mb-4">{cohort.cohort_description}</p>

            <div className="flex items-center gap-4 mb-3 pb-3 border-b border-[var(--border)]">
              <div>
                <p className="text-lg font-semibold font-mono">{formatReach(cohort.estimated_reach)}</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">reach</p>
              </div>
              <div>
                <p className="text-[13px] font-medium">{cohort.personalization_granularity.replace('_', ' ')}</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">granularity</p>
              </div>
            </div>

            {/* Flags */}
            <div className="flex gap-2 mb-3">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cohort.is_region_allowed ? 'bg-[var(--success-subtle)] text-[var(--success)]' : 'bg-[var(--bg)] text-[var(--text-tertiary)]'}`}>
                Region {cohort.is_region_allowed ? '✓' : '✗'}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cohort.is_channel_allowed ? 'bg-[var(--success-subtle)] text-[var(--success)]' : 'bg-[var(--bg)] text-[var(--text-tertiary)]'}`}>
                Channel {cohort.is_channel_allowed ? '✓' : '✗'}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cohort.is_frequency_capped ? 'bg-[var(--success-subtle)] text-[var(--success)]' : 'bg-[var(--bg)] text-[var(--text-tertiary)]'}`}>
                Freq Cap {cohort.is_frequency_capped ? '✓' : '✗'}
              </span>
            </div>

            <p className="text-[10px] text-[var(--text-tertiary)] font-mono">Updated {cohort.last_updated_ts}</p>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[13px] text-[var(--text-tertiary)]">No cohorts match your filters.</div>
      )}
    </div>
  );
}
