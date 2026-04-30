'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Filter,
  Image as ImageIcon,
  Video,
  Code2,
  Check,
  Clock,
  AlertCircle,
  X,
  ArrowLeft,
  Tag,
  Users,
} from 'lucide-react';

// Type definitions
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

// Mock data
const MOCK_CREATIVES: Creative[] = [
  {
    creative_asset_id: 'CAD-001',
    asset_name: 'Summer Sale Hero Banner',
    asset_type: 'Image',
    format: 'jpg',
    width_px: 1920,
    height_px: 1080,
    approval_status: 'Approved',
    target_segment: 'High-Value Customers',
    content_tags: ['summer', 'sale', 'promotional', 'hero'],
    generation_model: 'DALL-E 3',
    created_at: '2024-01-15',
  },
  {
    creative_asset_id: 'CAD-002',
    asset_name: 'Product Showcase Video',
    asset_type: 'Video',
    format: 'mp4',
    width_px: 1280,
    height_px: 720,
    approval_status: 'Pending_Review',
    target_segment: 'Tech Enthusiasts',
    content_tags: ['product', 'showcase', 'video', 'tech'],
    generation_model: 'Runway ML',
    created_at: '2024-01-14',
  },
  {
    creative_asset_id: 'CAD-003',
    asset_name: 'Dynamic DCO Template',
    asset_type: 'DCO',
    format: 'html',
    width_px: 300,
    height_px: 250,
    approval_status: 'Draft',
    target_segment: 'Mobile Users',
    content_tags: ['dco', 'dynamic', 'template', 'mobile'],
    generation_model: 'Custom DCO Engine',
    created_at: '2024-01-13',
  },
  {
    creative_asset_id: 'CAD-004',
    asset_name: 'Holiday Campaign Image',
    asset_type: 'Image',
    format: 'png',
    width_px: 1200,
    height_px: 800,
    approval_status: 'Approved',
    target_segment: 'All Segments',
    content_tags: ['holiday', 'seasonal', 'festive', 'campaign'],
    generation_model: 'Midjourney',
    created_at: '2024-01-12',
  },
  {
    creative_asset_id: 'CAD-005',
    asset_name: 'Product Demo Video',
    asset_type: 'Video',
    format: 'mp4',
    width_px: 1920,
    height_px: 1080,
    approval_status: 'Rejected',
    target_segment: 'Enterprise Buyers',
    content_tags: ['demo', 'product', 'video', 'tutorial'],
    generation_model: 'Synthesia',
    created_at: '2024-01-11',
  },
  {
    creative_asset_id: 'CAD-006',
    asset_name: 'Interactive DCO Ad',
    asset_type: 'DCO',
    format: 'html',
    width_px: 728,
    height_px: 90,
    approval_status: 'Pending_Review',
    target_segment: 'Web Browsers',
    content_tags: ['dco', 'interactive', 'ad', 'web'],
    generation_model: 'Custom DCO Engine',
    created_at: '2024-01-10',
  },
  {
    creative_asset_id: 'CAD-007',
    asset_name: 'Social Media Post',
    asset_type: 'Image',
    format: 'jpg',
    width_px: 1080,
    height_px: 1080,
    approval_status: 'Approved',
    target_segment: 'Social Media Followers',
    content_tags: ['social', 'instagram', 'post', 'engagement'],
    generation_model: 'DALL-E 3',
    created_at: '2024-01-09',
  },
  {
    creative_asset_id: 'CAD-008',
    asset_name: 'Email Header Banner',
    asset_type: 'Image',
    format: 'png',
    width_px: 600,
    height_px: 200,
    approval_status: 'Draft',
    target_segment: 'Email Subscribers',
    content_tags: ['email', 'header', 'banner', 'newsletter'],
    generation_model: 'DALL-E 3',
    created_at: '2024-01-08',
  },
];

// Status badge component
function StatusBadge({ status }: { status: ApprovalStatus }) {
  const statusConfig = {
    Approved: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', icon: Check, label: 'Approved' },
    Pending_Review: { bg: 'bg-amber-500/20', text: 'text-amber-300', icon: Clock, label: 'Pending' },
    Draft: { bg: 'bg-slate-500/20', text: 'text-slate-300', icon: AlertCircle, label: 'Draft' },
    Rejected: { bg: 'bg-red-500/20', text: 'text-red-300', icon: X, label: 'Rejected' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${config.bg} ${config.text} text-xs font-medium`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </div>
  );
}

// Asset type icon component
function AssetTypeIcon({ type }: { type: AssetType }) {
  const icons = {
    Image: <ImageIcon className="w-5 h-5" />,
    Video: <Video className="w-5 h-5" />,
    DCO: <Code2 className="w-5 h-5" />,
  };

  return icons[type];
}

// Creative card component
function CreativeCard({ creative }: { creative: Creative }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:border-slate-600/80 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
      {/* Thumbnail placeholder */}
      <div className="relative aspect-video bg-gradient-to-br from-slate-700/30 to-slate-800/30 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-3 text-slate-400">
              <AssetTypeIcon type={creative.asset_type} />
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {creative.width_px} × {creative.height_px}
            </p>
            <p className="text-xs text-slate-600 mt-1">{creative.format.toUpperCase()}</p>
          </div>
        </div>

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-purple-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Asset type badge */}
        <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-xs font-semibold text-purple-300 border border-purple-500/30">
          {creative.asset_type}
        </div>

        {/* Status badge */}
        <div className="absolute bottom-3 left-3">
          <StatusBadge status={creative.approval_status} />
        </div>
      </div>

      {/* Content section */}
      <div className="p-4">
        <h3 className="font-semibold text-slate-100 text-sm line-clamp-2 mb-2 group-hover:text-purple-300 transition-colors">
          {creative.asset_name}
        </h3>

        {/* Target segment */}
        <div className="flex items-center gap-2 mb-3 text-xs text-slate-400">
          <Users className="w-3.5 h-3.5" />
          <span className="truncate">{creative.target_segment}</span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {creative.content_tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10 text-purple-300 text-xs border border-purple-500/20"
            >
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
          {creative.content_tags.length > 2 && (
            <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-700/30 text-slate-400 text-xs">
              +{creative.content_tags.length - 2}
            </span>
          )}
        </div>

        {/* Generation model */}
        <p className="text-xs text-slate-500 border-t border-slate-700/50 pt-2">
          Model: <span className="text-slate-400">{creative.generation_model}</span>
        </p>
      </div>
    </div>
  );
}

// Filter panel component
function FilterPanel({
  selectedTypes,
  selectedStatuses,
  onTypeChange,
  onStatusChange,
}: {
  selectedTypes: Set<AssetType>;
  selectedStatuses: Set<ApprovalStatus>;
  onTypeChange: (type: AssetType) => void;
  onStatusChange: (status: ApprovalStatus) => void;
}) {
  const types: AssetType[] = ['Image', 'Video', 'DCO'];
  const statuses: ApprovalStatus[] = ['Draft', 'Pending_Review', 'Approved', 'Rejected'];

  return (
    <div className="space-y-6">
      {/* Asset Type Filter */}
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-purple-400" />
          Asset Type
        </h3>
        <div className="space-y-2">
          {types.map((type) => (
            <label key={type} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedTypes.has(type)}
                onChange={() => onTypeChange(type)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700/50 checked:bg-purple-600 checked:border-purple-500 cursor-pointer accent-purple-500"
              />
              <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">
                {type}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Approval Status Filter */}
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Check className="w-4 h-4 text-purple-400" />
          Approval Status
        </h3>
        <div className="space-y-2">
          {statuses.map((status) => (
            <label key={status} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedStatuses.has(status)}
                onChange={() => onStatusChange(status)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700/50 checked:bg-purple-600 checked:border-purple-500 cursor-pointer accent-purple-500"
              />
              <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">
                {status.replace('_', ' ')}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CreativesPage() {
  const [selectedTypes, setSelectedTypes] = useState<Set<AssetType>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ApprovalStatus>>(new Set());

  // Filter creatives
  const filteredCreatives = useMemo(() => {
    return MOCK_CREATIVES.filter((creative) => {
      const typeMatch = selectedTypes.size === 0 || selectedTypes.has(creative.asset_type);
      const statusMatch = selectedStatuses.size === 0 || selectedStatuses.has(creative.approval_status);
      return typeMatch && statusMatch;
    });
  }, [selectedTypes, selectedStatuses]);

  const handleTypeChange = (type: AssetType) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
  };

  const handleStatusChange = (status: ApprovalStatus) => {
    const newStatuses = new Set(selectedStatuses);
    if (newStatuses.has(status)) {
      newStatuses.delete(status);
    } else {
      newStatuses.add(status);
    }
    setSelectedStatuses(newStatuses);
  };

  const clearFilters = () => {
    setSelectedTypes(new Set());
    setSelectedStatuses(new Set());
  };

  const hasActiveFilters = selectedTypes.size > 0 || selectedStatuses.size > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-slate-100">Creatives Gallery</h1>
                <p className="text-sm text-slate-400 mt-1">
                  Browse and manage generated creative assets
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-400">{filteredCreatives.length}</p>
              <p className="text-xs text-slate-400">creatives</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar filters */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-purple-400" />
                  Filters
                </h2>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>

              <FilterPanel
                selectedTypes={selectedTypes}
                selectedStatuses={selectedStatuses}
                onTypeChange={handleTypeChange}
                onStatusChange={handleStatusChange}
              />
            </div>
          </div>

          {/* Gallery grid */}
          <div className="lg:col-span-3">
            {filteredCreatives.length === 0 ? (
              <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-12 text-center">
                <Filter className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-300 mb-2">No creatives found</h3>
                <p className="text-slate-500 mb-6">
                  Try adjusting your filters to find what you're looking for
                </p>
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-max">
                {filteredCreatives.map((creative) => (
                  <CreativeCard key={creative.creative_asset_id} creative={creative} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
