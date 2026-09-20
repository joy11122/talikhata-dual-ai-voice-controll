'use client';
import { Loader2 } from 'lucide-react';
export function LoadingSpinner({label='Loading…', className=''}:{label?:string;className?:string}) {
  return <span className={`inline-flex items-center justify-center gap-2 ${className}`} role="status" aria-live="polite"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true"/><span>{label}</span></span>;
}
export function PageSkeleton(){return <div className="mx-auto max-w-6xl animate-pulse space-y-5" aria-label="Loading"><div className="h-8 w-56 rounded-lg bg-slate-200"/><div className="h-4 w-80 max-w-full rounded bg-slate-200"/><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div className="h-28 rounded-2xl bg-slate-200"/><div className="h-28 rounded-2xl bg-slate-200"/><div className="h-28 rounded-2xl bg-slate-200"/></div><div className="h-56 rounded-2xl bg-slate-200"/></div>}
