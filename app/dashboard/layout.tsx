'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Menu, X, Home, Users, Boxes, ShoppingCart, Truck, WalletCards,
  BookOpen, Sunset, BarChart3, Bot, ScrollText, Settings, Mic,
  Plus, PanelLeftClose, PanelLeftOpen, type LucideIcon,
} from 'lucide-react';
import UserMenu from '@/components/UserMenu';
import VoiceControl from '@/components/VoiceControl';

type DashboardLink = { href: string; label: string; icon: LucideIcon };

const links: DashboardLink[] = [
  { href: '/dashboard', label: 'নতুন হিসাব', icon: Plus },
  { href: '/dashboard/parties', label: 'বাকি / কাস্টমার', icon: Users },
  { href: '/dashboard/products', label: 'স্টক / পণ্য', icon: Boxes },
  { href: '/dashboard/sales', label: 'বিক্রি', icon: ShoppingCart },
  { href: '/dashboard/purchases', label: 'ক্রয়', icon: Truck },
  { href: '/dashboard/payments', label: 'পেমেন্ট', icon: WalletCards },
  { href: '/dashboard/transactions', label: 'লেনদেন', icon: BookOpen },
  { href: '/dashboard/closing', label: 'দিন শেষ', icon: Sunset },
  { href: '/dashboard/reports', label: 'রিপোর্ট', icon: BarChart3 },
  { href: '/dashboard/assistant', label: 'Assistant', icon: Bot },
  { href: '/dashboard/audit', label: 'Voice Audit', icon: ScrollText },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const user = session?.user;

  // Header Title Resolution Fix
  const activeSubLink = links
    .filter((x) => x.href !== '/dashboard')
    .find((x) => pathname.startsWith(x.href));

  const currentTitle = pathname === '/dashboard'
    ? 'New conversation'
    : activeSubLink?.label || 'TaliKhata';

  const sidebar = (
    <aside
      className={[
        'flex h-full flex-col border-r border-black/[0.07] bg-white',
        collapsed ? 'w-[76px]' : 'w-[258px]',
      ].join(' ')}
    >
      <div className="flex h-16 items-center gap-2 px-3">
        <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex min-w-0 flex-1 items-center gap-2 px-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">T</span>
          {!collapsed && <span className="truncate text-[17px] font-semibold tracking-[-0.03em]">TaliKhata<span className="text-emerald-600">.</span></span>}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:block"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-slate-400 md:hidden" aria-label="Close menu">
          <X size={19} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Dashboard navigation">
        <p className={`px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${collapsed ? 'sr-only' : ''}`}>Workspace</p>
        <div className="space-y-0.5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                className={[
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition',
                  active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  collapsed ? 'justify-center' : '',
                ].join(' ')}
              >
                <Icon size={18} strokeWidth={1.9} />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
          {user?.role === 'ADMIN' && (
            <Link href="/admin" onClick={() => setMobileOpen(false)} title={collapsed ? 'Admin Panel' : undefined} className={`mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 ${collapsed ? 'justify-center' : ''}`}>
              <Settings size={18} />{!collapsed && <span>Admin Panel</span>}
            </Link>
          )}
        </div>
      </nav>

      <div className="border-t border-black/[0.06] p-2">
        <div className={`rounded-xl bg-emerald-50 p-3 text-emerald-800 ${collapsed ? 'flex justify-center' : ''}`}>
          <Mic size={18} />
          {!collapsed && <div className="ml-2"><p className="text-xs font-semibold">Voice ready</p><p className="mt-0.5 text-[11px] text-emerald-700">Bangla · Banglish · English</p></div>}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-slate-900">
      <div className="fixed inset-y-0 left-0 z-50 hidden md:block">{sidebar}</div>

      {mobileOpen && (
        <button className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px] md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close dashboard navigation" />
      )}
      <div className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebar}
      </div>

      <div className={`min-w-0 transition-[padding] duration-200 ${collapsed ? 'md:pl-[76px]' : 'md:pl-[258px]'}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-black/[0.07] bg-white/90 px-3 backdrop-blur-xl sm:px-5">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Open dashboard navigation">
            <Menu size={21} />
          </button>
          <div className="ml-2 flex items-center gap-2 md:ml-0">
            <Home size={17} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-600">{currentTitle}</span>
          </div>
          <div className="ml-auto">{status !== 'loading' && <UserMenu name={user?.name ?? ''} email={user?.email ?? ''} />}</div>
        </header>

        <main className="px-3 pb-28 pt-3 sm:px-5 md:px-8 md:pb-10">{children}</main>
        <VoiceControl />
      </div>
    </div>
  );
}
