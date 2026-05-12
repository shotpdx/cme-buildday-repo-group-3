'use client';

import { useState, useMemo } from 'react';

type AssetType = 'Image' | 'Video' | 'DCO';
type ApprovalStatus = 'Draft' | 'Pending_Review' | 'Approved' | 'Rejected';

interface Creative {
  creative_asset_id: string;
  asset_name: string;
  asset_type: AssetType;
  format: string;
  width_px: number;
  height_px: number;
  approval_status: ApprovalStatus;
  target_segment: string;
  content_tags: string[];
  generation_model: string;
  created_at: string;
}

const CREATIVES: Creative[] = [
  { creative_asset_id: 'CAD-001', asset_name: 'Summer Sale Hero 01', asset_type: 'Image', format: 'JPG', width_px: 1280, height_px: 628, approval_status: 'Approved', target_segment: 'Summer Shoppers', content_tags: ['summer', 'sale', 'hero'], generation_model: 'Model: Ideogram 2.0', created_at: 'May 16, 2025' },
  { creative_asset_id: 'CAD-002', asset_name: 'Product Launch Teaser', asset_type: 'Video', format: 'MP4', width_px: 1920, height_px: 1080, approval_status: 'Approved', target_segment: 'Tech Enthusiasts', content_tags: ['product', 'teaser'], generation_model: 'Model: Runway Gen-3', created_at: 'May 15, 2025' },
  { creative_asset_id: 'CAD-003', asset_name: 'DCO Dynamic Offer 03', asset_type: 'DCO', format: 'HTML', width_px: 1024, height_px: 1080, approval_status: 'Approved', target_segment: 'High Value Shoppers', content_tags: ['dco', 'offer'], generation_model: 'Model: Celtra DCO', created_at: 'May 14, 2025' },
  { creative_asset_id: 'CAD-004', asset_name: 'Sidebar Promo 02', asset_type: 'Image', format: 'PNG', width_px: 300, height_px: 250, approval_status: 'Approved', target_segment: 'Budget Conscious', content_tags: ['sidebar', 'promo'], generation_model: 'Model: Ideogram 2.0', created_at: 'May 14, 2025' },
  { creative_asset_id: 'CAD-005', asset_name: 'Story Ad – New Arrival', asset_type: 'Video', format: 'MP4', width_px: 1080, height_px: 1920, approval_status: 'Pending_Review', target_segment: 'New Arrivals', content_tags: ['story', 'mobile'], generation_model: 'Model: Runway May 11, 2025', created_at: 'May 10, 2025' },
  { creative_asset_id: 'CAD-006', asset_name: 'Leaderboard – Spring Drop', asset_type: 'Image', format: 'JPG', width_px: 728, height_px: 90, approval_status: 'Pending_Review', target_segment: 'Spring', content_tags: ['leaderboard', 'spring'], generation_model: 'Model: Ideogram 2.0', created_at: 'May 12, 2025' },
  { creative_asset_id: 'CAD-007', asset_name: 'DCO Retargeting Banner 01', asset_type: 'DCO', format: 'HTML', width_px: 1200, height_px: 628, approval_status: 'Draft', target_segment: 'Retargeting', content_tags: ['dco', 'retarget'], generation_model: 'Model: Celtra DCO', created_at: 'May 9, 2025' },
  { creative_asset_id: 'CAD-008', asset_name: 'Brand Awareness Video', asset_type: 'Video', format: 'MP4', width_px: 1080, height_px: 1080, approval_status: 'Draft', target_segment: 'Broad Awareness', content_tags: ['brand', 'awareness'], generation_model: 'Model: Runway Gen-3', created_at: 'May 11, 2025' },
];

const STATUS_STYLES: Record<ApprovalStatus, string> = {
  Draft: 'bg-[var(--bg)] text-[var(--text-secondary)] border border-[var(--border)]',
  Pending_Review: 'bg-[var(--warning-subtle)] text-[var(--warning)] border border-[var(--warning)]/20',
  Approved: 'bg-[var(--success-subtle)] text-[var(--success)] border border-[var(--success)]/20',
  Rejected: 'bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]/20',
};

const TYPE_BORDER: Record<AssetType, string> = {
  Image: 'border-l-[#2563EB]',
  Video: 'border-l-[var(--accent)]',
  DCO: 'border-l-[#7C3AED]',
};

function aspectRatio(w: number, h: number) {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

export default function CreativesPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return CREATIVES.filter((c) => {
      const matchesType = typeFilter === 'all' || c.asset_type === typeFilter;
      const matchesStatus = statusFilter === 'all' || c.approval_status === statusFilter;
      return matchesType && matchesStatus;
    });
  }, [typeFilter, statusFilter]);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      {/* Header with action buttons */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Creatives</h1>
          <p className="text-sm text-[var(--text-secondary)]">Generated creative assets with approval workflows.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-[12px] font-medium px-3 py-2 rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors">
            + New Creative
          </button>
          <button className="text-[12px] font-medium px-3 py-2 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
            Upload
          </button>
        </div>
      </div>

      {/* Filters — rounded pill style like mockup */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {/* Type filters */}
        {['all', 'Image', 'Video', 'DCO'].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-colors border ${
              typeFilter === t
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
          >
            {t === 'all' ? 'All Types' : t}
          </button>
        ))}

        <div className="w-px h-5 bg-[var(--border)] mx-1" />

        {/* Status filters */}
        {['all', 'Draft', 'Pending_Review', 'Approved', 'Rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-colors border ${
              statusFilter === s
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}

        <div className="ml-auto text-[11px] text-[var(--text-tertiary)]">
          Sort by: <span className="font-medium text-[var(--text-secondary)]">Newest</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map((c, i) => {
          const heightRatio = c.height_px / c.width_px;
          const clampedRatio = Math.min(Math.max(heightRatio, 0.4), 1.2);

          return (
            <div
              key={c.creative_asset_id}
              className={`border border-[var(--border)] border-l-[3px] ${TYPE_BORDER[c.asset_type]} rounded-lg overflow-hidden hover:border-[var(--border-strong)] hover:shadow-sm transition-all bg-[var(--surface)] animate-slide-up cursor-pointer`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Thumbnail with real aspect ratio */}
              <div
                className="bg-[var(--bg)] flex items-center justify-center relative"
                style={{ paddingBottom: `${clampedRatio * 100}%`, position: 'relative' }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[13px] font-mono font-medium text-[var(--text-tertiary)]">
                      {aspectRatio(c.width_px, c.height_px)}
                    </p>
                    <p className="text-[11px] font-mono text-[var(--text-tertiary)] mt-0.5">
                      {c.width_px}x{c.height_px}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1 uppercase">{c.format}</p>
                  </div>
                </div>

                {/* Type badge */}
                <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--surface)]/90 text-[var(--text-secondary)] border border-[var(--border)]">
                  {c.asset_type}
                </span>
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="text-[13px] font-medium mb-1 truncate">{c.asset_name}</h3>
                <p className="text-[11px] text-[var(--text-tertiary)] mb-2">Segment: {c.target_segment}</p>

                {/* Status + tags */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_STYLES[c.approval_status]}`}>
                    {c.approval_status.replace('_', ' ')}
                  </span>
                  {c.content_tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg)] text-[var(--text-tertiary)]">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-tertiary)]">{c.generation_model}</span>
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{c.created_at}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[13px] text-[var(--text-tertiary)]">No creatives match your filters.</div>
      )}
    </div>
  );
}
