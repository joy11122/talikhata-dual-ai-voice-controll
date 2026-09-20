'use client';
import {useEffect,useState} from 'react';
import {ShieldCheck,CheckCircle2,XCircle} from 'lucide-react';
export default function AuditPage(){
 const[rows,setRows]=useState<any[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 useEffect(()=>{fetch('/api/audit').then(r=>{if(!r.ok)throw new Error('Could not load audit');return r.json()}).then(d=>setRows(Array.isArray(d)?d:[])).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);
 return <div className="mx-auto max-w-6xl"><div className="flex items-center gap-3"><ShieldCheck className="text-emerald-600"/><div><h1 className="text-3xl font-bold">Voice audit</h1><p className="mt-1 text-slate-500">Recent voice commands and their execution status.</p></div></div>
 {error&&<div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
 {loading?<div className="mt-6 animate-pulse space-y-3" aria-label="Loading voice audit"><div className="h-24 rounded-2xl bg-slate-200"/><div className="h-24 rounded-2xl bg-slate-200"/></div>:<div className="mt-6 space-y-3">{rows.map(r=><div key={r._id} className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="font-medium">{r.voiceTranscript||'—'}</p><p className="mt-1 text-xs text-slate-500">{new Date(r.createdAt).toLocaleString('en-BD')}</p></div>{r.status==='SUCCESS'?<CheckCircle2 className="text-emerald-600"/>:<XCircle className="text-red-500"/>}</div><pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(r.parsedIntent,null,2)}</pre></div>)}{!rows.length&&<div className="rounded-xl border bg-white p-12 text-center text-slate-400">No voice activity yet.</div>}</div>}
 </div>
}
