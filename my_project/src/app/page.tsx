'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Zap,
  TrendingUp,
  Users,
  Sparkles,
  ArrowRight,
  Activity,
  CheckCircle,
  Clock,
} from 'lucide-react';

interface MetricCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}

interface ActivityItem {
  id: string;
  type: 'activation' | 'approval' | 'test';
  title: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'running';
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const metrics: MetricCard[] = [
    {
      label: 'Total Generated Creatives',
      value: '1,247',
      icon: <Sparkles className="w-6 h-6" />,
      color: 'from-purple-500 to-pink-500',
      trend: '+12% this week',
    },
    {
      label: 'Active Campaigns',
      value: '25',
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'from-blue-500 to-cyan-500',
      trend: '+3 new',
    },
    {
      label: 'A/B Tests Running',
      value: '5',
      icon: <Zap className="w-6 h-6" />,
      color: 'from-amber-500 to-orange-500',
      trend: '2 completed',
    },
    {
      label: 'Total Audience Reach',
      value: '500K',
      icon: <Users className="w-6 h-6" />,
      color: 'from-emerald-500 to-teal-500',
      trend: '+45K this month',
    },
  ];

  const recentActivity: ActivityItem[] = [
    {
      id: '1',
      type: 'activation',
      title: 'Summer Campaign Activated',
      description: 'Launched personalized creative variants across 50K users',
      timestamp: '2 hours ago',
      status: 'completed',
    },
    {
      id: '2',
      type: 'approval',
      title: 'Creative Brief Approved',
      description: 'Q3 Product Launch brief approved by marketing team',
      timestamp: '4 hours ago',
      status: 'completed',
    },
    {
      id: '3',
      type: 'test',
      title: 'A/B Test Running',
      description: 'Headline variation test - 48h remaining',
      timestamp: 'Started 1 day ago',
      status: 'running',
    },
    {
      id: '4',
      type: 'activation',
      title: 'Audience Segment Updated',
      description: 'High-value customer segment refined with new behavioral data',
      timestamp: '8 hours ago',
      status: 'completed',
    },
  ];

  const navigationLinks = [
    {
      href: '/briefs',
      label: 'Creative Briefs',
      description: 'Manage campaign briefs',
      icon: '📋',
    },
    {
      href: '/audiences',
      label: 'Audience Management',
      description: 'Define and segment audiences',
      icon: '👥',
    },
    {
      href: '/creatives',
      label: 'Creative Assets',
      description: 'Browse and manage creatives',
      icon: '🎨',
    },
    {
      href: '/activations',
      label: 'Campaign Activations',
      description: 'Launch and monitor campaigns',
      icon: '🚀',
    },
    {
      href: '/ask',
      label: 'AI Assistant',
      description: 'Ask questions about your data',
      icon: '🤖',
    },
  ];

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Creative Command Center
              </h1>
            </div>
            <nav className="hidden md:flex gap-6">
              {navigationLinks.slice(0, 4).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate-300 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <section className="mb-16 animate-fade-in">
          <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 md:p-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Welcome to Your Creative Dashboard
            </h2>
            <p className="text-lg text-slate-300 mb-8 max-w-2xl">
              Manage personalized creative activations, run A/B tests, and reach your audience with
              precision. Real-time insights into campaign performance and creative effectiveness.
            </p>
            <div className="flex gap-4 flex-wrap">
              <Link
                href="/creatives"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition-all hover:shadow-lg hover:shadow-purple-500/50"
              >
                Browse Creatives <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/activations"
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all"
              >
                View Activations
              </Link>
            </div>
          </div>
        </section>

        {/* Metrics Grid */}
        <section className="mb-16">
          <h3 className="text-2xl font-bold mb-8 text-slate-100">Key Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((metric, index) => (
              <div
                key={metric.label}
                className="group relative animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 rounded-xl blur-xl transition-opacity duration-300"
                  style={{
                    backgroundImage: `linear-gradient(to right, var(--color-start), var(--color-end))`,
                    '--color-start': 'rgb(168, 85, 247)',
                    '--color-end': 'rgb(236, 72, 153)',
                  } as React.CSSProperties}
                />
                <div className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-all">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${metric.color} p-2.5 mb-4 text-white`}>
                    {metric.icon}
                  </div>
                  <p className="text-slate-400 text-sm mb-2">{metric.label}</p>
                  <p className="text-3xl font-bold text-white mb-2">{metric.value}</p>
                  {metric.trend && (
                    <p className="text-xs text-slate-400">{metric.trend}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="mb-16">
          <h3 className="text-2xl font-bold mb-8 text-slate-100">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div
                key={activity.id}
                className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg p-6 hover:border-slate-600/50 transition-all animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {activity.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    )}
                    {activity.status === 'running' && (
                      <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
                    )}
                    {activity.status === 'pending' && (
                      <Clock className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-white mb-1">{activity.title}</h4>
                    <p className="text-sm text-slate-400 mb-2">{activity.description}</p>
                    <p className="text-xs text-slate-500">{activity.timestamp}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Navigation Grid */}
        <section>
          <h3 className="text-2xl font-bold mb-8 text-slate-100">Quick Navigation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {navigationLinks.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                className="group relative animate-fade-in"
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
                <div className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg p-6 hover:border-slate-600/50 transition-all text-center">
                  <div className="text-3xl mb-3">{link.icon}</div>
                  <h4 className="font-semibold text-white mb-1">{link.label}</h4>
                  <p className="text-xs text-slate-400">{link.description}</p>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors mt-3 mx-auto" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400">
            <p>&copy; 2024 Creative Activation Command Center. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-slate-200 transition-colors">
                Documentation
              </a>
              <a href="#" className="hover:text-slate-200 transition-colors">
                Support
              </a>
              <a href="#" className="hover:text-slate-200 transition-colors">
                Settings
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
