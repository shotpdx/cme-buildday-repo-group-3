'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AskAIPanel } from '@/components/ask-ai-panel';
import { BRAND } from '@/config/brand';

const NAV_ITEMS = [
  { href: '/', label: 'Overview' },
  { href: '/briefs', label: 'Briefs' },
  { href: '/audiences', label: 'Audiences' },
  { href: '/creatives', label: 'Creatives' },
  { href: '/activations', label: 'Activations' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [askOpen, setAskOpen] = useState(false);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          {/* Top bar */}
          <header className="border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-50">
            <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between h-14">
              <div className="flex items-center gap-10">
                {/* Brand */}
                <Link href="/" className="flex items-center gap-2.5">
                  {BRAND.logoUrl ? (
                    <img src={BRAND.logoUrl} alt={BRAND.name} className="h-7 w-auto" />
                  ) : (
                    <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: BRAND.accentColor }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="1" y="1" width="5" height="5" rx="1" fill="white"/>
                        <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
                        <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
                        <rect x="8" y="8" width="5" height="5" rx="1" fill="white" opacity="0.3"/>
                      </svg>
                    </div>
                  )}
                  <span className="font-semibold text-[14px] tracking-tight uppercase" style={{ fontFamily: 'Sora, sans-serif' }}>
                    {BRAND.name}
                  </span>
                </Link>

                {/* Navigation */}
                <nav className="flex items-center gap-6">
                  {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`text-[12px] font-medium uppercase tracking-wider transition-colors pb-0.5 ${
                          isActive
                            ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text)] border-b-2 border-transparent'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setAskOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium rounded-md border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="7" cy="7" r="5.5"/>
                    <path d="M5.5 5.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1-1.5 2"/>
                    <circle cx="7" cy="10" r="0.5" fill="currentColor"/>
                  </svg>
                  Ask AI
                </button>
                <div className="w-7 h-7 rounded-full bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[11px] font-semibold text-[var(--text-secondary)]">
                  AK
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1">
            {children}
          </main>
        </div>

        {/* Ask AI slide-over panel */}
        <AskAIPanel open={askOpen} onClose={() => setAskOpen(false)} />
      </body>
    </html>
  );
}
