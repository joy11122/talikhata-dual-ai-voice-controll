'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Boxes,
  ChevronRight,
  Clock3,
  PackagePlus,
  ReceiptText,
  Sparkles,
  Users,
  WalletCards,
  MessageCircle,
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
  { text: 'রহিমের কাছে কত টাকা পাব?', icon: WalletCards, tone: 'green' },
  { text: 'করিমকে ৫০০ টাকা দিলাম', icon: ReceiptText, tone: 'blue' },
  { text: 'নতুন কাস্টমার যোগ করো', icon: Users, tone: 'purple' },
  { text: 'আজকের বিক্রি দেখাও', icon: BarChart3, tone: 'orange' },
];

const quickActions = [
  { href: '/dashboard/parties', label: 'নতুন কাস্টমার', icon: Users, tone: 'green' },
  { href: '/dashboard/products', label: 'পণ্য যোগ', icon: PackagePlus, tone: 'blue' },
  { href: '/dashboard/sales', label: 'নতুন বিক্রি', icon: ReceiptText, tone: 'purple' },
  { href: '/dashboard/reports', label: 'রিপোর্ট', icon: BarChart3, tone: 'orange' },
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
      <div className="mx-auto min-h-[calc(100vh-8rem)] max-w-5xl px-4 py-8">
        <div className="space-y-5">
          <div className="h-10 w-56 animate-pulse rounded-2xl bg-white/70" />
          <div className="h-28 animate-pulse rounded-[28px] bg-white/60" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-[24px] bg-white/60" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-[calc(100vh-7rem)] max-w-5xl px-3 pb-28 pt-2 sm:px-5 sm:pt-4">
      <section className="space-y-5">
        <header className="flex items-center justify-between px-1 pt-1">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600">টালিখাতা AI Voice</span>
            </div>
            <h1 className="mt-0.5 text-[25px] font-bold tracking-[-0.04em] text-slate-900 sm:text-3xl">আজ কী হিসাব করবেন?</h1>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white/70 p-0.5 shadow-sm backdrop-blur-xl" aria-hidden="true">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white">T</div>
          </div>
        </header>

        <section>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">দ্রুত ভয়েস কমান্ডসমূহ</h2>
            <span className="text-[11px] font-medium text-blue-500">স্লাইড করুন →</span>
          </div>
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 py-1">
            {suggestions.map(({ text, icon: Icon, tone }) => (
              <button
                key={text}
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('talikhata:command', { detail: text }))}
                className="group flex h-[108px] w-[170px] flex-none flex-col justify-between rounded-[22px] border border-white/75 bg-white/65 p-3.5 text-left shadow-[0_8px_32px_rgba(31,38,135,0.07)] backdrop-blur-xl transition active:scale-[0.97] hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] font-semibold leading-5 text-slate-800">{text}</span>
                  <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full ${toneClass(tone)}`}>
                    <Icon size={15} />
                  </span>
                </div>
                <span className="flex items-center text-[12px] font-semibold text-emerald-600">চেষ্টা করুন <ChevronRight size={14} className="ml-0.5 transition group-hover:translate-x-1" /></span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">আপনার হিসাব</h2>
              <p className="text-[11px] text-slate-400">এক নজরে আজকের সামগ্রিক অবস্থা</p>
            </div>
            <Link href="/dashboard/reports" className="flex items-center text-xs font-semibold text-blue-500">বিস্তারিত <ChevronRight size={14} /></Link>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric icon={<WalletCards size={17} />} label="আপনি পাবেন" value={money(data?.balances?.receivable)} href="/dashboard/parties" tone="green" />
            <Metric icon={<ReceiptText size={17} />} label="আপনাকে দিতে হবে" value={money(data?.balances?.payable)} href="/dashboard/parties" tone="red" />
            <Metric icon={<Users size={17} />} label="কাস্টমার / পার্টি" value={data?.parties ?? 0} href="/dashboard/parties" tone="blue" />
            <Metric icon={<Boxes size={17} />} label="পণ্য আইটেম" value={data?.products ?? 0} href="/dashboard/products" tone="purple" />
          </div>
        </section>

        <section className="rounded-[28px] border border-white/75 bg-white/65 p-4 shadow-[0_8px_32px_rgba(31,38,135,0.07)] backdrop-blur-xl sm:p-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <h2 className="text-sm font-bold tracking-tight text-slate-900">সাম্প্রতিক হিসাব</h2>
            </div>
            <Link href="/dashboard/transactions" className="text-xs font-semibold text-emerald-600">সব দেখুন</Link>
          </div>
          <div className="space-y-2.5">
            {recent.map((item) => (
              <div key={item._id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/55 p-3 transition active:scale-[0.995]">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white shadow-sm">
                    {(item.partyId?.name || item.productId?.name || item.type).charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-800">{item.partyId?.name || item.productId?.name || item.type}</h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">{transactionLabel(item.type)}</span>
                      <span className="text-[10px] text-slate-400">{new Date(item.timestamp).toLocaleString('bn-BD')}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${amountTone(item.type)}`}>{amountPrefix(item.type)}৳{Number(item.amount || 0).toLocaleString('bn-BD')}</p>
                  <span className="text-[10px] text-slate-400">লেনদেন</span>
                </div>
              </div>
            ))}
            {!recent.length && <div className="py-10 text-center text-sm text-slate-400">এখনো কোনো লেনদেন নেই।</div>}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/75 bg-white/65 p-4 shadow-[0_8px_32px_rgba(31,38,135,0.07)] backdrop-blur-xl sm:p-5">
          <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">কুইক অ্যাকশন</h2>
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map(({ href, label, icon: Icon, tone }) => (
              <Link key={href} href={href} className="flex min-h-[94px] flex-col items-center justify-center rounded-2xl border border-white/70 bg-white/60 p-2 text-center transition hover:bg-white active:scale-[0.97]">
                <span className={`mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl ${toneClass(tone)}`}><Icon size={19} /></span>
                <span className="text-[11px] font-semibold leading-tight text-slate-800">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, href, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; href: string; tone: string }) {
  return (
    <Link href={href} className="group relative overflow-hidden rounded-[24px] border border-white/75 bg-white/65 p-4 shadow-[0_8px_32px_rgba(31,38,135,0.07)] backdrop-blur-xl transition hover:-translate-y-0.5 active:scale-[0.98]">
      <div className="mb-2 flex items-center justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${toneClass(tone)}`}>{icon}</span>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${toneBadge(tone)}`}>{tone === 'green' ? 'পাওনা' : tone === 'red' ? 'দেনা' : tone === 'blue' ? 'মোট সক্রিয়' : 'স্টক'}</span>
      </div>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-[22px] font-bold tracking-tight text-slate-900">{typeof value === 'number' ? value : value}</p>
    </Link>
  );
}

function toneClass(tone: string) {
  return tone === 'green' ? 'bg-emerald-500/10 text-emerald-600' :
    tone === 'red' ? 'bg-red-500/10 text-red-500' :
    tone === 'blue' ? 'bg-blue-500/10 text-blue-500' :
    'bg-purple-500/10 text-purple-600';
}

function toneBadge(tone: string) {
  return tone === 'green' ? 'bg-emerald-500/10 text-emerald-600' :
    tone === 'red' ? 'bg-red-500/10 text-red-500' :
    tone === 'blue' ? 'bg-black/5 text-slate-500' :
    'bg-purple-500/10 text-purple-600';
}

function transactionLabel(type: string) {
  const value = type.toUpperCase();
  if (value.includes('RECEIVE') || value.includes('PAYMENT')) return 'জমা প্রাপ্তি';
  if (value.includes('SALE') || value.includes('DUE')) return 'বাকি বিক্রি';
  if (value.includes('EXPENSE') || value.includes('PURCHASE')) return 'খরচ / কেনা';
  return type;
}

function amountTone(type: string) {
  const value = type.toUpperCase();
  return value.includes('RECEIVE') || value.includes('PAYMENT') ? 'text-emerald-600' : 'text-slate-800';
}

function amountPrefix(type: string) {
  const value = type.toUpperCase();
  return value.includes('RECEIVE') || value.includes('PAYMENT') ? '+' : '';
}

function money(value?: number) {
  return `৳${Number(value || 0).toLocaleString('bn-BD')}`;
}
