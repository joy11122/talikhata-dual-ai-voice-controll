'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUp,
  BarChart3,
  BookOpen,
  Boxes,
  ChevronRight,
  Clock3,
  Mic,
  Plus,
  ReceiptText,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';
import { apiRequest } from '@/lib/api-client';

type DashboardData = {
  parties: number;
  products: number;
  lowStock: number;
  balances?: { receivable?: number; payable?: number };
  recent?: Array<{
    _id: string;
    partyId?: { name: string };
    productId?: { name: string };
    type: string;
    amount?: number;
    timestamp: string;
  }>;
};

const suggestions = [
  'রহিমের কাছে কত টাকা পাব?',
  'করিমকে ৫০০ টাকা দিলাম',
  'নতুন কাস্টমার যোগ করো',
  'আজকের বিক্রি দেখাও',
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const value = await apiRequest<DashboardData>('/api/dashboard');
      setData(value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('talikhata:refresh', refresh);
    return () => window.removeEventListener('talikhata:refresh', refresh);
  }, []);

  const recent = useMemo(() => data?.recent?.slice(0, 5) ?? [], [data]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col items-center justify-center px-4">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-emerald-100" />
        <div className="mt-5 h-5 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-5xl flex-col">
      <section className="flex flex-1 flex-col justify-center px-1 pb-8 pt-4">
        <div className="mx-auto w-full max-w-3xl">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Sparkles size={26} />
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-4xl">
              আজ কী হিসাব করবেন?
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
              TaliKhata Voice-এর সাথে কথা বলুন বা নিচের composer-এ লিখুন।
              আপনার হিসাবের কাজগুলো এখান থেকেই করা যাবে।
            </p>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            {suggestions.map((suggestion) => (
              <Suggestion key={suggestion} text={suggestion} />
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-black/[0.07] bg-white p-2 shadow-[0_8px_35px_rgba(15,23,42,0.06)]">
            <div className="flex min-h-14 items-center gap-2 rounded-2xl px-3">
              <Mic className="shrink-0 text-emerald-600" size={20} />
              <span className="flex-1 text-sm text-slate-400">
                নিচের microphone চাপুন অথবা voice command লিখুন…
              </span>
              <div className="hidden rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500 sm:block">
                Voice ready
              </div>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800"
                aria-label="Focus voice controls"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-6">
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <p className="text-sm font-semibold text-slate-900">আপনার হিসাব</p>
            <p className="text-xs text-slate-500">এক নজরে আজকের অবস্থান</p>
          </div>
          <Link
            href="/dashboard/reports"
            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            বিস্তারিত <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<WalletCards size={18} />} label="আপনি পাবেন" value={money(data?.balances?.receivable)} href="/dashboard/parties" />
          <Metric icon={<ReceiptText size={18} />} label="আপনাকে দিতে হবে" value={money(data?.balances?.payable)} href="/dashboard/parties" />
          <Metric icon={<Users size={18} />} label="কাস্টমার / পার্টি" value={data?.parties ?? 0} href="/dashboard/parties" />
          <Metric icon={<Boxes size={18} />} label="পণ্য" value={data?.products ?? 0} href="/dashboard/products" />
        </div>
      </section>

      <section className="grid gap-4 pb-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-2xl border border-black/[0.07] bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock3 size={17} className="text-slate-500" />
              <h2 className="text-sm font-semibold">সাম্প্রতিক হিসাব</h2>
            </div>
            <Link href="/dashboard/transactions" className="text-xs font-semibold text-emerald-700">
              সব দেখুন
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {recent.map((item) => (
              <div key={item._id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {item.partyId?.name || item.productId?.name || item.type}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(item.timestamp).toLocaleString('bn-BD')} · {item.type}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-800">
                  ৳{Number(item.amount || 0).toLocaleString('bn-BD')}
                </span>
              </div>
            ))}
            {!recent.length && (
              <div className="py-10 text-center">
                <BookOpen className="mx-auto text-slate-300" size={24} />
                <p className="mt-2 text-sm text-slate-400">এখনো কোনো লেনদেন নেই।</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-black/[0.07] bg-white p-5">
          <div className="flex items-center gap-2">
            <BarChart3 size={17} className="text-emerald-600" />
            <h2 className="text-sm font-semibold">Quick actions</h2>
          </div>
          <div className="mt-4 space-y-2">
            <QuickAction href="/dashboard/parties" icon={<Users size={17} />} label="নতুন কাস্টমার" />
            <QuickAction href="/dashboard/products" icon={<Boxes size={17} />} label="পণ্য যোগ করুন" />
            <QuickAction href="/dashboard/sales" icon={<Plus size={17} />} label="বিক্রি যোগ করুন" />
            <QuickAction href="/dashboard/reports" icon={<BarChart3 size={17} />} label="রিপোর্ট দেখুন" />
          </div>
        </div>
      </section>
    </div>
  );
}

function Suggestion({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="group rounded-2xl border border-black/[0.07] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_8px_25px_rgba(16,185,129,0.08)]"
      onClick={() => {
        window.dispatchEvent(new CustomEvent('talikhata:command', { detail: text }));
      }}
    >
      <span className="text-sm leading-6 text-slate-700 group-hover:text-slate-900">{text}</span>
      <span className="mt-2 block text-xs font-medium text-emerald-600">Try this →</span>
    </button>
  );
}

function Metric({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-black/[0.07] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
      <div className="flex items-center gap-2 text-emerald-600">{icon}<span className="text-xs text-slate-500">{label}</span></div>
      <p className="mt-3 text-xl font-semibold tracking-[-0.025em] text-slate-900">{value}</p>
    </Link>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-sm text-slate-700 transition hover:border-emerald-100 hover:bg-emerald-50">
      <span className="text-emerald-600">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight size={15} className="text-slate-300" />
    </Link>
  );
}

function money(value?: number) {
  return `৳${Number(value || 0).toLocaleString('bn-BD')}`;
}
