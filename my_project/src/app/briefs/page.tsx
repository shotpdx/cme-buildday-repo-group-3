'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Search,
  Filter,
  FileText,
  Users,
  Target,
  Calendar,
  ExternalLink,
} from 'lucide-react';

// Mock data structure matching gold_media_creative_briefs
interface Brief {
  brief_id: string;
  brief_name: string;
  brand_name: string;
  campaign_objective: string;
  target_audience_description: string;
  status: 'Draft' | 'In Review' | 'Approved' | 'Active';
  created_ts: string;
  concepts_count?: number;
  creatives_count?: number;
}

// Mock data
const mockBriefs: Brief[] = [
  {
    brief_id: 'BRIEF-001',
    brief_name: 'Summer Campaign 2024',
    brand_name: 'TechCorp',
    campaign_objective: 'Increase brand awareness among Gen Z',
    target_audience_description: 'Ages 18-24, tech enthusiasts, urban dwellers',
    status: 'Active',
    created_ts: '2024-01-15T10:00:00Z',
    concepts_count: 5,
    creatives_count: 23,
  },
  {
    brief_id: 'BRIEF-002',
    brief_name: 'Product Launch Q2',
    brand_name: 'InnovateLabs',
    campaign_objective: 'Drive product trial and adoption',
    target_audience_description: 'Early adopters, tech-savvy professionals, ages 25-40',
    status: 'Approved',
    created_ts: '2024-01-10T14:30:00Z',
    concepts_count: 3,
    creatives_count: 12,
  },
  {
    brief_id: 'BRIEF-003',
    brief_name: 'Holiday Season Push',
    brand_name: 'RetailMax',
    campaign_objective: 'Maximize holiday season sales',
    target_audience_description: 'Families, gift-givers, ages 30-55',
    status: 'In Review',
    created_ts: '2024-01-08T09:15:00Z',
    concepts_count: 4,
    creatives_count: 8,
  },
  {
    brief_id: 'BRIEF-004',
    brief_name: 'Sustainability Initiative',
    brand_name: 'EcoGreen',
    campaign_objective: 'Promote eco-friendly product line',
    target_audience_description: 'Environmentally conscious consumers, ages 25-50',
    status: 'Draft',
    created_ts: '2024-01-05T11:45:00Z',
    concepts_count: 2,
    creatives_count: 0,
  },
  {
    brief_id: 'BRIEF-005',
    brief_name: 'B2B Enterprise Solutions',
    brand_name: 'CloudSync',
    campaign_objective: 'Acquire enterprise clients',
    target_audience_description: 'CTOs, IT directors, enterprise decision makers',
    status: 'Active',
    created_ts: '2024-01-02T16:20:00Z',
    concepts_count: 6,
    creatives_count: 18,
  },
  {
    brief_id: 'BRIEF-006',
    brief_name: 'Mobile App Promotion',
    brand_name: 'AppFlow',
    campaign_objective: 'Increase app downloads and engagement',
    target_audience_description: 'Mobile-first users, ages 18-35',
    status: 'Approved',
    created_ts: '2023-12-28T13:00:00Z',
    concepts_count: 3,
    creatives_count: 15,
  },
];

const statusColors: Record<Brief['status'], string> = {
  Draft: 'bg-slate-700/50 text-slate-200 border-slate-600',
  'In Review': 'bg-amber-900/50 text-amber-200 border-amber-700',
  Approved: 'bg-emerald-900/50 text-emerald-200 border-emerald-700',
  Active: 'bg-purple-900/50 text-purple-200 border-purple-700',
};

const statusIcons: Record<Brief['status'], React.ReactNode> = {
  Draft: '📝',
  'In Review': '👀',
  Approved: '✅',
  Active: '🚀',
};

export default function BriefsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<Brief['status'][]>([
    'Draft',
    'In Review',
    'Approved',
    'Active',
  ]);
  const [sortBy, setSortBy] = useState<'created' | 'name'>('created');

  // Filter and sort briefs
  const filteredBriefs = useMemo(() => {
    let filtered = mockBriefs.filter((brief) => {
      const matchesSearch =
        brief.brief_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        brief.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        brief.campaign_objective.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = selectedStatuses.includes(brief.status);

      return matchesSearch && matchesStatus;
    });

    // Sort
    if (sortBy === 'created') {
      filtered.sort(
        (a, b) =>
          new Date(b.created_ts).getTime() - new Date(a.created_ts).getTime()
      );
    } else {
      filtered.sort((a, b) => a.brief_name.localeCompare(b.brief_name));
    }

    return filtered;
  }, [searchQuery, selectedStatuses, sortBy]);

  const toggleStatus = (status: Brief['status']) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Creative Briefs
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
          <h2 className="text-3xl font-bold mb-2">Manage Creative Briefs</h2>
          <p className="text-slate-400">
            Browse, filter, and manage your creative campaign briefs. View associated concepts and
            generated creatives.
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
                placeholder="Search briefs by name, brand, or objective..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
              />
            </div>
          </div>

          {/* Filters & Sort */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Status Filter */}
            <div className="flex flex-wrap gap-2 items-center">
              <Filter className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-400 font-medium">Status:</span>
              <div className="flex flex-wrap gap-2">
                {(['Draft', 'In Review', 'Approved', 'Active'] as const).map((status) => (
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

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'created' | 'name')}
                className="px-3 py-1 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500 transition-all"
              >
                <option value="created">Newest First</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-slate-400">
          Showing <span className="font-semibold text-white">{filteredBriefs.length}</span> of{' '}
          <span className="font-semibold text-white">{mockBriefs.length}</span> briefs
        </div>

        {/* Briefs Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden animate-fade-in">
          {filteredBriefs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-900/50">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Brief Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Brand
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Objective
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Audience
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Assets
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBriefs.map((brief, index) => (
                    <tr
                      key={brief.brief_id}
                      className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors"
                      style={{
                        animation: `fadeIn 0.5s ease-out forwards`,
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      {/* Brief Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
                            <FileText className="w-4 h-4 text-purple-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">{brief.brief_name}</p>
                            <p className="text-xs text-slate-400">{brief.brief_id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Brand */}
                      <td className="px-6 py-4">
                        <span className="text-slate-300">{brief.brand_name}</span>
                      </td>

                      {/* Objective */}
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-300 max-w-xs truncate">
                          {brief.campaign_objective}
                        </p>
                      </td>

                      {/* Audience */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-slate-400" />
                          <p className="text-sm text-slate-300 max-w-xs truncate">
                            {brief.target_audience_description}
                          </p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${
                            statusColors[brief.status]
                          }`}
                        >
                          {statusIcons[brief.status]} {brief.status}
                        </span>
                      </td>

                      {/* Assets Count */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1">
                            <Target className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-300">{brief.concepts_count}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-300">{brief.creatives_count}</span>
                          </div>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-300">
                            {formatDate(brief.created_ts)}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/briefs/${brief.brief_id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 hover:text-purple-200 rounded-lg text-xs font-medium transition-all border border-purple-500/30 hover:border-purple-500/60"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-300 mb-2">No briefs found</h3>
              <p className="text-slate-400">
                Try adjusting your search or filter criteria to find briefs.
              </p>
            </div>
          )}
        </div>

        {/* Stats Section */}
        <section className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Briefs',
              value: mockBriefs.length,
              icon: FileText,
              color: 'from-blue-500 to-cyan-500',
            },
            {
              label: 'Active Campaigns',
              value: mockBriefs.filter((b) => b.status === 'Active').length,
              icon: Target,
              color: 'from-purple-500 to-pink-500',
            },
            {
              label: 'Total Concepts',
              value: mockBriefs.reduce((sum, b) => sum + (b.concepts_count || 0), 0),
              icon: ChevronDown,
              color: 'from-emerald-500 to-teal-500',
            },
            {
              label: 'Total Creatives',
              value: mockBriefs.reduce((sum, b) => sum + (b.creatives_count || 0), 0),
              icon: Users,
              color: 'from-amber-500 to-orange-500',
            },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6 animate-fade-in"
                style={{
                  animation: `fadeIn 0.5s ease-out forwards`,
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
