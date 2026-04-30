'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Filter,
  Users,
  Target,
  Globe,
  Radio,
  Zap,
  TrendingUp,
  ChevronDown,
  Search,
} from 'lucide-react';

// Type definitions
type DefinitionType = 'rule_based' | 'ml_model' | 'lookalike' | 'manual';
type PersonalizationGranularity = 'Segment' | 'Micro_Cohort' | 'One_to_One';
type CohortStatus = 'Active' | 'Archived';

interface AudienceCohort {
  cohort_id: string;
  cohort_name: string;
  cohort_description: string;
  definition_type: DefinitionType;
  personalization_granularity: PersonalizationGranularity;
  estimated_reach: number;
  is_region_allowed: boolean;
  is_channel_allowed: boolean;
  is_frequency_capped: boolean;
  status: CohortStatus;
  created_ts: string;
  last_updated_ts: string;
}

// Mock data matching gold_buyside_audience_cohort structure
const MOCK_COHORTS: AudienceCohort[] = [
  {
    cohort_id: 'COHORT-001',
    cohort_name: 'High-Value Customers',
    cohort_description: 'Customers with lifetime value > $5000 and recent purchase activity',
    definition_type: 'rule_based',
    personalization_granularity: 'Segment',
    estimated_reach: 125000,
    is_region_allowed: true,
    is_channel_allowed: true,
    is_frequency_capped: true,
    status: 'Active',
    created_ts: '2024-01-15T10:00:00Z',
    last_updated_ts: '2024-11-20T14:22:00Z',
  },
  {
    cohort_id: 'COHORT-002',
    cohort_name: 'Tech Enthusiasts',
    cohort_description: 'ML-based segment of users interested in technology products',
    definition_type: 'ml_model',
    personalization_granularity: 'Micro_Cohort',
    estimated_reach: 250000,
    is_region_allowed: true,
    is_channel_allowed: false,
    is_frequency_capped: false,
    status: 'Active',
    created_ts: '2024-01-10T14:30:00Z',
    last_updated_ts: '2024-11-19T09:15:00Z',
  },
  {
    cohort_id: 'COHORT-003',
    cohort_name: 'Competitor Lookalikes',
    cohort_description: 'Lookalike audience based on competitor customer data',
    definition_type: 'lookalike',
    personalization_granularity: 'Segment',
    estimated_reach: 500000,
    is_region_allowed: false,
    is_channel_allowed: true,
    is_frequency_capped: true,
    status: 'Active',
    created_ts: '2024-01-08T09:15:00Z',
    last_updated_ts: '2024-11-18T11:45:00Z',
  },
  {
    cohort_id: 'COHORT-004',
    cohort_name: 'Manual Exclusion List',
    cohort_description: 'Manually curated list of opted-out users',
    definition_type: 'manual',
    personalization_granularity: 'One_to_One',
    estimated_reach: 50000,
    is_region_allowed: true,
    is_channel_allowed: true,
    is_frequency_capped: false,
    status: 'Active',
    created_ts: '2024-01-05T11:45:00Z',
    last_updated_ts: '2024-11-20T08:30:00Z',
  },
  {
    cohort_id: 'COHORT-005',
    cohort_name: 'Seasonal Shoppers',
    cohort_description: 'Users with seasonal purchase patterns detected by ML model',
    definition_type: 'ml_model',
    personalization_granularity: 'Micro_Cohort',
    estimated_reach: 180000,
    is_region_allowed: true,
    is_channel_allowed: true,
    is_frequency_capped: true,
    status: 'Active',
    created_ts: '2024-01-02T16:20:00Z',
    last_updated_ts: '2024-11-17T13:00:00Z',
  },
  {
    cohort_id: 'COHORT-006',
    cohort_name: 'Legacy Segment',
    cohort_description: 'Previous campaign segment - no longer in use',
    definition_type: 'rule_based',
    personalization_granularity: 'Segment',
    estimated_reach: 75000,
    is_region_allowed: false,
    is_channel_allowed: false,
    is_frequency_capped: false,
    status: 'Archived',
    created_ts: '2023-12-28T13:00:00Z',
    last_updated_ts: '2024-10-15T10:00:00Z',
  },
  {
    cohort_id: 'COHORT-007',
    cohort_name: 'Mobile-First Users',
    cohort_description: 'Users primarily accessing via mobile devices',
    definition_type: 'rule_based',
    personalization_granularity: 'Segment',
    estimated_reach: 320000,
    is_region_allowed: true,
    is_channel_allowed: true,
    is_frequency_capped: false,
    status: 'Active',
    created_ts: '2023-12-20T15:30:00Z',
    last_updated_ts: '2024-11-20T12:00:00Z',
  },
  {
    cohort_id: 'COHORT-008',
    cohort_name: 'Premium Tier Members',
    cohort_description: 'Users enrolled in premium subscription tier',
    definition_type: 'rule_based',
    personalization_granularity: 'One_to_One',
    estimated_reach: 45000,
    is_region_allowed: true,
    is_channel_allowed: true,
    is_frequency_capped: true,
    status: 'Active',
    created_ts: '2023-12-10T09:00:00Z',
    last_updated_ts: '2024-11-20T14:00:00Z',
  },
];

// Color mappings
const definitionTypeColors: Record<DefinitionType, string> = {
  rule_based: 'bg-blue-900/50 text-blue-200 border-blue-700',
  ml_model: 'bg-purple-900/50 text-purple-200 border-purple-700',
  lookalike: 'bg-amber-900/50 text-amber-200 border-amber-700',
  manual: 'bg-slate-700/50 text-slate-200 border-slate-600',
};

const definitionTypeLabels: Record<DefinitionType, string> = {
  rule_based: 'Rule-Based',
  ml_model: 'ML Model',
  lookalike: 'Lookalike',
  manual: 'Manual',
};

const granularityIcons: Record<PersonalizationGranularity, React.ReactNode> = {
  Segment: <Users className="w-4 h-4" />,
  Micro_Cohort: <Target className="w-4 h-4" />,
  One_to_One: <Zap className="w-4 h-4" />,
};

const granularityLabels: Record<PersonalizationGranularity, string> = {
  Segment: 'Segment',
  Micro_Cohort: 'Micro-Cohort',
  One_to_One: '1:1 Personalization',
};

const statusColors: Record<CohortStatus, string> = {
  Active: 'bg-emerald-900/50 text-emerald-200 border-emerald-700',
  Archived: 'bg-slate-700/50 text-slate-200 border-slate-600',
};

const statusIcons: Record<CohortStatus, string> = {
  Active: '🟢',
  Archived: '⏸️',
};

// Format number with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

// Format date
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Eligibility flag component
const EligibilityFlag = ({
  icon,
  label,
  enabled,
}: {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
}) => (
  <div
    className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-all ${
      enabled
        ? 'bg-emerald-900/40 text-emerald-200 border border-emerald-700/50'
        : 'bg-slate-700/30 text-slate-400 border border-slate-600/30'
    }`}
  >
    {icon}
    <span>{label}</span>
  </div>
);

// Cohort card component
const CohortCard = ({ cohort }: { cohort: AudienceCohort }) => (
  <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/80 transition-all hover:shadow-lg hover:shadow-purple-500/10">
    {/* Header */}
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{cohort.cohort_name}</h3>
            <p className="text-xs text-slate-400">{cohort.cohort_id}</p>
          </div>
        </div>
      </div>
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${
          statusColors[cohort.status]
        }`}
      >
        {statusIcons[cohort.status]} {cohort.status}
      </span>
    </div>

    {/* Description */}
    <p className="text-sm text-slate-300 mb-4">{cohort.cohort_description}</p>

    {/* Metrics Row */}
    <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-700/30">
      {/* Estimated Reach */}
      <div className="bg-slate-900/50 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Estimated Reach</span>
        </div>
        <p className="text-xl font-bold text-white">{formatNumber(cohort.estimated_reach)}</p>
      </div>

      {/* Personalization Granularity */}
      <div className="bg-slate-900/50 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          {granularityIcons[cohort.personalization_granularity]}
          <span className="text-xs text-slate-400 font-medium">Granularity</span>
        </div>
        <p className="text-sm font-semibold text-white">
          {granularityLabels[cohort.personalization_granularity]}
        </p>
      </div>
    </div>

    {/* Definition Type & Eligibility Flags */}
    <div className="space-y-3">
      {/* Definition Type */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 font-medium">Definition Type:</span>
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
            definitionTypeColors[cohort.definition_type]
          }`}
        >
          {definitionTypeLabels[cohort.definition_type]}
        </span>
      </div>

      {/* Eligibility Flags */}
      <div className="flex flex-wrap gap-2">
        <EligibilityFlag
          icon={<Globe className="w-3 h-3" />}
          label="Region"
          enabled={cohort.is_region_allowed}
        />
        <EligibilityFlag
          icon={<Radio className="w-3 h-3" />}
          label="Channel"
          enabled={cohort.is_channel_allowed}
        />
        <EligibilityFlag
          icon={<Zap className="w-3 h-3" />}
          label="Freq Cap"
          enabled={cohort.is_frequency_capped}
        />
      </div>
    </div>

    {/* Footer */}
    <div className="mt-4 pt-4 border-t border-slate-700/30 flex items-center justify-between text-xs text-slate-400">
      <span>Updated {formatDate(cohort.last_updated_ts)}</span>
      <button className="text-purple-400 hover:text-purple-300 transition-colors font-medium">
        View Details →
      </button>
    </div>
  </div>
);

export default function AudiencesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDefinitionTypes, setSelectedDefinitionTypes] = useState<DefinitionType[]>([
    'rule_based',
    'ml_model',
    'lookalike',
    'manual',
  ]);
  const [selectedStatuses, setSelectedStatuses] = useState<CohortStatus[]>(['Active', 'Archived']);
  const [sortBy, setSortBy] = useState<'reach' | 'name' | 'updated'>('reach');

  // Filter and sort cohorts
  const filteredCohorts = useMemo(() => {
    let filtered = MOCK_COHORTS.filter((cohort) => {
      const matchesSearch =
        cohort.cohort_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cohort.cohort_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cohort.cohort_id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDefinitionType = selectedDefinitionTypes.includes(cohort.definition_type);
      const matchesStatus = selectedStatuses.includes(cohort.status);

      return matchesSearch && matchesDefinitionType && matchesStatus;
    });

    // Sort
    if (sortBy === 'reach') {
      filtered.sort((a, b) => b.estimated_reach - a.estimated_reach);
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.cohort_name.localeCompare(b.cohort_name));
    } else {
      filtered.sort(
        (a, b) =>
          new Date(b.last_updated_ts).getTime() - new Date(a.last_updated_ts).getTime()
      );
    }

    return filtered;
  }, [searchQuery, selectedDefinitionTypes, selectedStatuses, sortBy]);

  const toggleDefinitionType = (type: DefinitionType) => {
    setSelectedDefinitionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleStatus = (status: CohortStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Audience Cohorts
              </h1>
            </Link>
            <Link
              href="/"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Title & Description */}
        <section className="mb-8 animate-fade-in">
          <h2 className="text-3xl font-bold mb-2">Manage Audience Cohorts</h2>
          <p className="text-slate-400">
            Browse and manage your audience segments. Filter by definition type, status, and
            eligibility flags to find the right cohorts for your campaigns.
          </p>
        </section>

        {/* Controls Section */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6 mb-8 animate-fade-in">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search cohorts by name, ID, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
              />
            </div>
          </div>

          {/* Filters & Sort */}
          <div className="space-y-4">
            {/* Definition Type Filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <Filter className="w-5 h-5 text-slate-400 mt-1 sm:mt-0" />
              <div className="flex-1">
                <span className="text-sm text-slate-400 font-medium block mb-2 sm:mb-0 sm:inline mr-3">
                  Definition Type:
                </span>
                <div className="flex flex-wrap gap-2">
                  {(['rule_based', 'ml_model', 'lookalike', 'manual'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleDefinitionType(type)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-all border ${
                        selectedDefinitionTypes.includes(type)
                          ? definitionTypeColors[type]
                          : 'bg-slate-700/30 text-slate-400 border-slate-600/30 hover:bg-slate-700/50'
                      }`}
                    >
                      {definitionTypeLabels[type]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="w-5" />
              <div className="flex-1">
                <span className="text-sm text-slate-400 font-medium block mb-2 sm:mb-0 sm:inline mr-3">
                  Status:
                </span>
                <div className="flex flex-wrap gap-2">
                  {(['Active', 'Archived'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => toggleStatus(status)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-all border ${
                        selectedStatuses.includes(status)
                          ? statusColors[status]
                          : 'bg-slate-700/30 text-slate-400 border-slate-600/30 hover:bg-slate-700/50'
                      }`}
                    >
                      {statusIcons[status]} {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-700/30">
              <span className="text-sm text-slate-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'reach' | 'name' | 'updated')}
                className="px-3 py-1 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 transition-all"
              >
                <option value="reach">Largest Reach</option>
                <option value="name">Name (A-Z)</option>
                <option value="updated">Recently Updated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6 text-sm text-slate-400">
          Showing <span className="font-semibold text-white">{filteredCohorts.length}</span> of{' '}
          <span className="font-semibold text-white">{MOCK_COHORTS.length}</span> cohorts
        </div>

        {/* Cohorts Grid */}
        {filteredCohorts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {filteredCohorts.map((cohort, index) => (
              <div
                key={cohort.cohort_id}
                style={{
                  animation: `fadeIn 0.5s ease-out forwards`,
                  animationDelay: `${index * 50}ms`,
                }}
              >
                <CohortCard cohort={cohort} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/30">
            <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-300 mb-1">No cohorts found</h3>
            <p className="text-slate-400">
              Try adjusting your filters or search query to find audience cohorts.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
