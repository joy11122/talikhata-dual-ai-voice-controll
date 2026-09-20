
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Menu,
  X,
  Home,
  Users,
  Boxes,
  ShoppingCart,
  Truck,
  WalletCards,
  BookOpen,
  Sunset,
  BarChart3,
  Bot,
  ScrollText,
  Settings,
  Mic,
  type LucideIcon,
} from 'lucide-react';

import UserMenu from '@/components/UserMenu';
import VoiceControl from '@/components/VoiceControl';

/**
 * This dashboard is authenticated and user-specific.
 * It must always be dynamically rendered.
 */
export const dynamic = 'force-dynamic';

type DashboardLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const links: DashboardLink[] = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: Home,
  },
  {
    href: '/dashboard/parties',
    label: 'বাকি',
    icon: Users,
  },
  {
    href: '/dashboard/products',
    label: 'স্টক',
    icon: Boxes,
  },
  {
    href: '/dashboard/sales',
    label: 'বিক্রি',
    icon: ShoppingCart,
  },
  {
    href: '/dashboard/purchases',
    label: 'ক্রয়',
    icon: Truck,
  },
  {
    href: '/dashboard/payments',
    label: 'পেমেন্ট',
    icon: WalletCards,
  },
  {
    href: '/dashboard/transactions',
    label: 'লেনদেন',
    icon: BookOpen,
  },
  {
    href: '/dashboard/closing',
    label: 'দিন শেষ',
    icon: Sunset,
  },
  {
    href: '/dashboard/reports',
    label: 'রিপোর্ট',
    icon: BarChart3,
  },
  {
    href: '/dashboard/assistant',
    label: 'Assistant',
    icon: Bot,
  },
  {
    href: '/dashboard/audit',
    label: 'Voice Audit',
    icon: ScrollText,
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const user = session?.user;

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] md:flex">
      {/* Mobile overlay */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Close dashboard menu"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] md:hidden"
          onClick={closeMenu}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50',
          'w-[min(86vw,292px)]',
          'border-r border-black/[0.08]',
          'bg-white/95 p-4',
          'shadow-xl backdrop-blur-xl',
          'transition-transform duration-200 ease-out',
          'md:static md:w-64 md:translate-x-0 md:shadow-none',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-2 py-2">
          <Link
            href="/dashboard"
            onClick={closeMenu}
            className="text-[21px] font-semibold tracking-[-0.03em]"
          >
            TaliKhata
            <span className="text-emerald-600">.</span>
          </Link>

          <button
            type="button"
            onClick={closeMenu}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-black/[0.05] md:hidden"
            aria-label="Close dashboard menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav
          className="mt-5 space-y-0.5"
          aria-label="Dashboard navigation"
        >
          {/* Admin link */}
          {user?.role === 'ADMIN' && (
            <Link
              href="/admin"
              onClick={closeMenu}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Settings size={18} strokeWidth={1.9} />
              <span>Admin Panel</span>
            </Link>
          )}

          {/* Dashboard links */}
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={closeMenu}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Voice status */}
        <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-800">
          <Mic size={18} strokeWidth={1.9} />

          <p className="mt-2 font-semibold">
            Voice ready
          </p>

          <p className="mt-1 leading-5 text-emerald-700">
            Use the floating mic to manage your shop.
          </p>
        </div>
      </aside>

      {/* Main application */}
      <div className="min-w-0 flex-1">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-black/[0.07] bg-white/85 px-4 backdrop-blur-xl md:px-8">
          {/* Mobile brand/menu */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-xl p-2 text-slate-700 transition hover:bg-black/[0.05] md:hidden"
              aria-label="Open dashboard menu"
              aria-expanded={menuOpen}
              aria-controls="dashboard-sidebar"
            >
              <Menu size={21} />
            </button>

            <Link
              href="/dashboard"
              className="text-[18px] font-semibold tracking-[-0.025em] md:hidden"
            >
              TaliKhata
              <span className="text-emerald-600">.</span>
            </Link>
          </div>

          {/* User menu */}
          <div className="ml-auto">
            {status !== 'loading' && (
              <UserMenu
                name={user?.name ?? ''}
                email={user?.email ?? ''}
              />
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 md:p-8">
          {/* Desktop quick navigation */}
          <nav
            className="mb-5 hidden gap-1.5 overflow-x-auto md:flex"
            aria-label="Dashboard shortcuts"
          >
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="whitespace-nowrap rounded-xl border border-black/[0.07] bg-white/80 px-3 py-2 text-[13px] font-medium text-slate-600 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:bg-white hover:text-slate-900"
              >
                {label}
              </Link>
            ))}
          </nav>

          {children}
        </main>

        {/* Floating voice control */}
        <VoiceControl />
      </div>
    </div>
  );
}
