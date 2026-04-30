'use client';

import { useState, useMemo } from 'react';

interface Activation {
  activation_id: string;
  creative_asset_id: string;
  line_item_id: string;
  campaign_id: string;
  brief_id: string;
  destination_platform: 'The_Trade_Desk' | 'DV360' | 'Amazon_DSP' | 'Meta' | 'Google_Ads' | 'TikTok' | 'Innovid';
  destination_placement_id: string;
  trafficking_status: 'Draft' | 'Submitted' | 'Live' | 'Paused' | 'Ended';
  activation_ts: string;
  last_sync_ts: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  last_metrics_update_ts: string;
  ab_test_id: string | null;
  ab_test_variant_id: string | null;
}

// Mock data matching the DLT pipeline structure
const MOCK_ACTIVATIONS: Activation[] = [
  {
    activation_id: 'ACT-000000',
    creative_asset_id: 'CREAT-000000',
    line_item_id: 'LI-000000',
    campaign_id: 'CAMP-0000',
    brief_id: 'BRIEF-000',
    destination_platform: 'The_Trade_Desk',
    destination_placement_id: 'PLAC-000000',
    trafficking_status: 'Live',
    activation_ts: '2024-11-01T10:30:00Z',
    last_sync_ts: '2024-11-20T14:22:00Z',
    impressions: 125000,
    clicks: 3750,
    conversions: 375,
    cost: 625.50,
    last_metrics_update_ts: '2024-11-20T14:22:00Z',
    ab_test_id: 'ABTEST-000',
    ab_test_variant_id: 'VAR-00',
  },
  {
    activation_id: 'ACT-000001',
    creative_asset_id: 'CREAT-000001',
    line_item_id: 'LI-000001',
    campaign_id: 'CAMP-0000',
    brief_id: 'BRIEF-000',
    destination_platform: 'DV360',
    destination_placement_id: 'PLAC-000001',
    trafficking_status: 'Live',
    activation_ts: '2024-11-02T09:15:00Z',
    last_sync_ts: '2024-11-20T13:45:00Z',
    impressions: 250000,
    clicks: 6250,
    conversions: 625,
    cost: 1250.75,
    last_metrics_update_ts: '2024-11-20T13:45:00Z',
    ab_test_id: 'ABTEST-000',
    ab_test_variant_id: 'VAR-01',
  },
  {
    activation_id: 'ACT-000002',
    creative_asset_id: 'CREAT-000002',
    line_item_id: 'LI-000002',
    campaign_id: 'CAMP-0001',
    brief_id: 'BRIEF-000',
    destination_platform: 'Amazon_DSP',
    destination_placement_id: 'PLAC-000002',
    trafficking_status: 'Live',
    activation_ts: '2024-11-03T11:20:00Z',
    last_sync_ts: '2024-11-20T12:30:00Z',
    impressions: 180000,
    clicks: 4320,
    conversions: 432,
    cost: 900.00,
    last_metrics_update_ts: '2024-11-20T12:30:00Z',
    ab_test_id: null,
    ab_test_variant_id: null,
  },
  {
    activation_id: 'ACT-000003',
    creative_asset_id: 'CREAT-000003',
    line_item_id: 'LI-000003',
    campaign_id: 'CAMP-0001',
    brief_id: 'BRIEF-001',
    destination_platform: 'Meta',
    destination_placement_id: 'PLAC-000003',
    trafficking_status: 'Paused',
    activation_ts: '2024-11-04T08:45:00Z',
    last_sync_ts: '2024-11-15T10:00:00Z',
    impressions: 95000,
    clicks: 2850,
    conversions: 285,
    cost: 475.25,
    last_metrics_update_ts: '2024-11-15T10:00:00Z',
    ab_test_id: 'ABTEST-001',
    ab_test_variant_id: 'VAR-00',
  },
  {
    activation_id: 'ACT-000004',
    creative_asset_id: 'CREAT-000004',
    line_item_id: 'LI-000004',
    campaign_id: 'CAMP-0002',
    brief_id: 'BRIEF-001',
    destination_platform: 'Google_Ads',
    destination_placement_id: 'PLAC-000004',
    trafficking_status: 'Live',
    activation_ts: '2024-11-05T13:30:00Z',
    last_sync_ts: '2024-11-20T15:10:00Z',
    impressions: 320000,
    clicks: 8960,
    conversions: 896,
    cost: 1600.00,
    last_metrics_update_ts: '2024-11-20T15:10:00Z',
    ab_test_id: null,
    ab_test_variant_id: null,
  },
  {
    activation_id: 'ACT-000005',
    creative_asset_id: 'CREAT-000005',
    line_item_id: 'LI-000005',
    campaign_id: 'CAMP-0002',
    brief_id: 'BRIEF-001',
    destination_platform: 'TikTok',
    destination_placement_id: 'PLAC-000005',
    trafficking_status: 'Draft',
    activation_ts: '2024-11-18T16:20:00Z',
    last_sync_ts: '2024-11-18T16:20:00Z',
    impressions: 0,
    clicks: 0,
    conversions: 0,
    cost: 0.00,
    last_metrics_update_ts: '2024-11-18T16:20:00Z',
    ab_test_id: 'ABTEST-002',
    ab_test_variant_id: 'VAR-02',
  },
  {
    activation_id: 'ACT-000006',
    creative_asset_id: 'CREAT-000006',
    line_item_id: 'LI-000006',
    campaign_id: 'CAMP-0003',
    brief_id: 'BRIEF-002',
    destination_platform: 'Innovid',
    destination_placement_id: 'PLAC-000006',
    trafficking_status: 'Live',
    activation_ts: '2024-11-06T12:00:00Z',
    last_sync_ts: '2024-11-20T11:45:00Z',
    impressions: 210000,
    clicks: 5250,
    conversions: 525,
    cost: 1050.00,
    last_metrics_update_ts: '2024-11-20T11:45:00Z',
    ab_test_id: null,
    ab_test_variant_id: null,
  },
  {
    activation_id: 'ACT-000007',
    creative_asset_id: 'CREAT-000007',
    line_item_id: 'LI-000007',
    campaign_id: 'CAMP-0003',
    brief_id: 'BRIEF-002',
    destination_platform: 'The_Trade_Desk',
    destination_placement_id: 'PLAC-000007',
    trafficking_status: 'Ended',
    activation_ts: '2024-10-20T09:00:00Z',
    last_sync_ts: '2024-11-10T14:30:00Z',
    impressions: 450000,
    clicks: 10800,
    conversions: 1080,
    cost: 2250.00,
    last_metrics_update_ts: '2024-11-10T14:30:00Z',
    ab_test_id: 'ABTEST-001',
    ab_test_variant_id: 'VAR-01',
  },
  {
    activation_id: 'ACT-000008',
    creative_asset_id: 'CREAT-000008',
    line_item_id: 'LI-000008',
    campaign_id: 'CAMP-0004',
    brief_id: 'BRIEF-002',
    destination_platform: 'DV360',
    destination_placement_id: 'PLAC-000008',
    trafficking_status: 'Live',
    activation_ts: '2024-11-07T14:15:00Z',
    last_sync_ts: '2024-11-20T16:00:00Z',
    impressions: 175000,
    clicks: 3500,
    conversions: 350,
    cost: 875.00,
    last_metrics_update_ts: '2024-11-20T16:00:00Z',
    ab_test_id: null,
    ab_test_variant_id: null,
  },
  {
    activation_id: 'ACT-000009',
    creative_asset_id: 'CREAT-000009',
    line_item_id: 'LI-000009',
    campaign_id: 'CAMP-0004',
    brief_id: 'BRIEF-003',
    destination_platform: 'Meta',
    destination_placement_id: 'PLAC-000009',
    trafficking_status: 'Submitted',
    activation_ts: '2024-11-19T10:30:00Z',
    last_sync_ts: '2024-11-19T10:30:00Z',
    impressions: 0,
    clicks: 0,
    conversions: 0,
    cost: 0.00,
    last_metrics_update_ts: '2024-11-19T10:30:00Z',
    ab_test_id: 'ABTEST-003',
    ab_test_variant_id: 'VAR-00',
  },
];

interface ActivationWithMetrics extends Activation {
  ctr: number;
  conversionRate: number;
}

function calculateMetrics(activation: Activation): ActivationWithMetrics {
  const ctr = activation.impressions > 0 ? (activation.clicks / activation.impressions) * 100 : 0;
  const conversionRate = activation.clicks > 0 ? (activation.conversions / activation.clicks) * 100 : 0;

  return {
    ...activation,
    ctr: parseFloat(ctr.toFixed(2)),
    conversionRate: parseFloat(conversionRate.toFixed(2)),
  };
}

function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    The_Trade_Desk: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    DV360: 'bg-red-500/10 text-red-300 border-red-500/30',
    Amazon_DSP: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
    Meta: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    Google_Ads: 'bg-green-500/10 text-green-300 border-green-500/30',
    TikTok: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
    Innovid: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  };
  return colors[platform] || 'bg-gray-500/10 text-gray-300 border-gray-500/30';
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Live: 'bg-green-500/10 text-green-300 border-green-500/30',
    Paused: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
    Draft: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
    Submitted: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    Ended: 'bg-red-500/10 text-red-300 border-red-500/30',
  };
  return colors[status] || 'bg-gray-500/10 text-gray-300 border-gray-500/30';
}

export default function ActivationsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Get unique platforms and statuses from mock data
  const platforms = Array.from(new Set(MOCK_ACTIVATIONS.map((a) => a.destination_platform))).sort();
  const statuses = Array.from(new Set(MOCK_ACTIVATIONS.map((a) => a.trafficking_status))).sort();

  // Filter and calculate metrics
  const filteredActivations = useMemo(() => {
    return MOCK_ACTIVATIONS.filter((activation) => {
      const platformMatch = !selectedPlatform || activation.destination_platform === selectedPlatform;
      const statusMatch = !selectedStatus || activation.trafficking_status === selectedStatus;
      return platformMatch && statusMatch;
    }).map(calculateMetrics);
  }, [selectedPlatform, selectedStatus]);

  // Calculate aggregate metrics
  const aggregateMetrics = useMemo(() => {
    const totals = filteredActivations.reduce(
      (acc, act) => ({
        impressions: acc.impressions + act.impressions,
        clicks: acc.clicks + act.clicks,
        conversions: acc.conversions + act.conversions,
        cost: acc.cost + act.cost,
      }),
      { impressions: 0, clicks: 0, conversions: 0, cost: 0 }
    );

    return {
      ...totals,
      avgCTR: totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '0.00',
      avgConversionRate: totals.clicks > 0 ? ((totals.conversions / totals.clicks) * 100).toFixed(2) : '0.00',
      avgCPC: totals.clicks > 0 ? (totals.cost / totals.clicks).toFixed(2) : '0.00',
    };
  }, [filteredActivations]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Campaign Activations</h1>
          <p className="text-slate-400">Monitor and manage campaign activations across platforms</p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Filter by Platform</label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Platforms</option>
              {platforms.map((platform) => (
                <option key={platform} value={platform}>
                  {platform.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Filter by Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Aggregate Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
            <div className="text-slate-400 text-sm font-medium mb-1">Total Impressions</div>
            <div className="text-2xl font-bold text-white">{aggregateMetrics.impressions.toLocaleString()}</div>
          </div>
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
            <div className="text-slate-400 text-sm font-medium mb-1">Total Clicks</div>
            <div className="text-2xl font-bold text-white">{aggregateMetrics.clicks.toLocaleString()}</div>
          </div>
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
            <div className="text-slate-400 text-sm font-medium mb-1">Avg CTR</div>
            <div className="text-2xl font-bold text-blue-400">{aggregateMetrics.avgCTR}%</div>
          </div>
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
            <div className="text-slate-400 text-sm font-medium mb-1">Avg Conv. Rate</div>
            <div className="text-2xl font-bold text-green-400">{aggregateMetrics.avgConversionRate}%</div>
          </div>
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
            <div className="text-slate-400 text-sm font-medium mb-1">Total Cost</div>
            <div className="text-2xl font-bold text-orange-400">${aggregateMetrics.cost.toFixed(2)}</div>
          </div>
        </div>

        {/* Activations Table */}
        <div className="bg-slate-700/30 border border-slate-600 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-600 bg-slate-800/50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Platform</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">Impressions</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">Clicks</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">CTR</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">Conversions</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">Conv. Rate</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">Cost</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">A/B Test</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivations.map((activation, idx) => (
                  <tr
                    key={activation.activation_id}
                    className={`border-b border-slate-600/50 hover:bg-slate-700/20 transition-colors ${
                      idx % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-700/10'
                    }`}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-white">{activation.activation_id}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-block px-3 py-1 rounded-full border text-xs font-medium ${getPlatformColor(activation.destination_platform)}`}>
                        {activation.destination_platform.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-block px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor(activation.trafficking_status)}`}>
                        {activation.trafficking_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-slate-300">{activation.impressions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-right text-slate-300">{activation.clicks.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-blue-400">{activation.ctr.toFixed(2)}%</td>
                    <td className="px-6 py-4 text-sm text-right text-slate-300">{activation.conversions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-green-400">{activation.conversionRate.toFixed(2)}%</td>
                    <td className="px-6 py-4 text-sm text-right text-orange-400 font-medium">${activation.cost.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm">
                      {activation.ab_test_id ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-blue-400 font-medium">{activation.ab_test_id}</span>
                          <span className="text-slate-400 text-xs">{activation.ab_test_variant_id}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {filteredActivations.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="text-slate-400">No activations found matching your filters.</p>
            </div>
          )}
        </div>

        {/* Results summary */}
        <div className="mt-4 text-sm text-slate-400">
          Showing {filteredActivations.length} of {MOCK_ACTIVATIONS.length} activations
        </div>
      </div>
    </div>
  );
}
