import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Mic, ShieldCheck, LogIn, UserPlus } from 'lucide-react';
import GoogleButton from '@/components/GoogleButton';

export const metadata: Metadata = {
  title: 'TaliKhata Voice | Sign in to your shop',
  description: 'Secure voice-first shop accounting for ledger, inventory, sales and purchases.',
  alternates: { canonical: '/' },
};

export default async function Home(){
  const session=await auth();
  if(session?.user?.id) redirect('/dashboard');
  return <main className="min-h-screen bg-[#f5f5f7] px-5 py-6 sm:py-10">
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-[22px] font-semibold tracking-[-.03em]">TaliKhata<span className="text-emerald-600">.</span></Link>
        <Link href="/privacy" className="text-sm text-slate-500 hover:text-emerald-700">Privacy</Link>
      </header>
      <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.1fr_.9fr] lg:py-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"><Mic size={16}/> Voice-first shop management</div>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-.045em] text-[#1d1d1f] sm:text-5xl lg:text-[60px] lg:leading-[1.05]">আপনার দোকানের হিসাব, এক জায়গায়।</h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-7 text-slate-600">বাংলা, Banglish ও English voice দিয়ে বাকির খাতা, স্টক, বিক্রি, ক্রয় ও দৈনিক হিসাব পরিচালনা করুন। আপনার data দেখতে বা ব্যবহার করতে আগে sign in করতে হবে।</p>
          <div className="mt-7 flex flex-wrap gap-3 text-sm text-slate-600"><span className="inline-flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-600"/> Secure account access</span><span className="inline-flex items-center gap-2"><Mic size={17} className="text-emerald-600"/> Bengali voice ready</span></div>
        </div>
        <div className="rounded-2xl border border-black/[.07] bg-white/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,.08)] backdrop-blur-xl sm:p-8">
          <h2 className="text-2xl font-bold">Start with Google</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Sign in with Gmail to access your private shop dashboard.</p>
          <div className="mt-6"><GoogleButton /></div>
          <div className="my-6 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200"/>OR<span className="h-px flex-1 bg-slate-200"/></div>
          <Link href="/signin" className="btn-secondary w-full justify-center"><LogIn size={17}/> Sign in with email</Link>
          <Link href="/signup" className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"><UserPlus size={16}/> Create account</Link>
          <p className="mt-6 text-center text-xs leading-5 text-slate-400">No dashboard, customer, product, transaction or voice feature is available before authentication.</p>
        </div>
      </section>
      <footer className="flex flex-wrap gap-5 border-t pt-6 text-sm text-slate-500"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></footer>
    </div>
  </main>;
}
