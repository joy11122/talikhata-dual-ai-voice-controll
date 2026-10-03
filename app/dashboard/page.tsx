'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, ChevronRight, Mic, Plus,
  Search, ShoppingCart, Users, WalletCards, Package, Sparkles, Send, Loader2, X,
} from 'lucide-react';
import { apiRequest } from '@/lib/api-client';

type Tx={_id:string;partyId?:{name:string};productId?:{name:string};type:string;amount?:number;timestamp:string;source?:'MANUAL'|'VOICE'|'SYSTEM'};
type DashboardData={dueCustomers?:number;balances?:{receivable?:number;payable?:number};recent?:Tx[];todaySales?:{total?:number;count?:number};weeklySales?:Array<{label:string;date:string;total:number}>};

const money=(v?:number)=>'৳ '+Number(v||0).toLocaleString('bn-BD');
const txTitle=(x:Tx)=>x.partyId?.name?(/DUE/i.test(x.type)?x.partyId.name+'-এর বাকি':x.partyId.name):/SALE/i.test(x.type)?'ক্যাশ বিক্রি':x.productId?.name||x.type;
const txStatus=(x:Tx)=>/SALE/i.test(x.type)?(/DUE/i.test(x.type)?'বাকি যোগ হয়েছে':'ক্যাশ বিক্রি'):/PAYMENT|RECEIVE/i.test(x.type)?'পেমেন্ট':'লেনদেন';
const isPositive=(x:Tx)=>/PAYMENT|RECEIVE/i.test(x.type);
const time=(v:string)=>new Date(v).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});

export default function DashboardPage(){
 const[data,setData]=useState<DashboardData|null>(null);
 const[shopName,setShopName]=useState('');
 const[loading,setLoading]=useState(true);
 const[query,setQuery]=useState('');
 const[assistantQ,setAssistantQ]=useState('');
 const[assistantA,setAssistantA]=useState('');
 const[assistantBusy,setAssistantBusy]=useState(false);
 const[assistantListening,setAssistantListening]=useState(false);
 const[assistantError,setAssistantError]=useState('');
 const load=async()=>{try{setData(await apiRequest<DashboardData>('/api/dashboard'))}catch{setData(null)}finally{setLoading(false)}};
 useEffect(()=>{void load();void fetch('/api/shop').then(r=>r.ok?r.json():null).then(x=>{if(x?.shopName)setShopName(x.shopName)}).catch(()=>{});const r=()=>{void load();void fetch('/api/shop').then(x=>x.ok?x.json():null).then(x=>{if(x?.shopName)setShopName(x.shopName)}).catch(()=>{})};window.addEventListener('talikhata:refresh',r);return()=>window.removeEventListener('talikhata:refresh',r)},[]);
 const recent=useMemo(()=>data?.recent?.filter(x=>{const q=query.trim().toLowerCase();return !q||txTitle(x).toLowerCase().includes(q)||txStatus(x).toLowerCase().includes(q)}).slice(0,5)??[],[data,query]);
 const chart=data?.weeklySales??[];
 const max=Math.max(...chart.map(x=>x.total),1);
 const todayTotal=data?.todaySales?.total??0;
 const due=data?.balances?.receivable??0;

 if(loading)return <div className="tk-new-dashboard mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8"><div className="space-y-5 animate-pulse"><div className="h-16 rounded-2xl bg-white/[.03]"/><div className="grid gap-4 sm:grid-cols-2"><div className="h-32 rounded-2xl bg-white/[.03]"/><div className="h-32 rounded-2xl bg-white/[.03]"/></div><div className="h-72 rounded-2xl bg-white/[.03]"/></div></div>;

 return <div className="tk-new-dashboard mx-auto w-full max-w-6xl px-4 pb-36 pt-3 md:px-8 md:pb-10">
   <section className="tk-dash-welcome">
     <div className="min-w-0">
       <p className="tk-dash-kicker">GOOD DAY · {shopName || 'YOUR STORE'}</p>
       <h1>আজকের হিসাব এক নজরে</h1>
       <p className="tk-dash-subtitle">আপনার দোকানের গুরুত্বপূর্ণ হিসাব ও খাতা এখানে।</p>
     </div>
     <div className="tk-dash-date">আজকের হিসাব</div>
   </section>

   <section className="w-full" aria-label="AI Assistant">
     <div className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full bg-[#7692ff]/10 blur-3xl" />
          <div className="relative min-w-0 flex-1">
       <form className="mt-4 flex w-full items-center gap-1.5 rounded-2xl border border-white/10 tk-glass-subtle p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]" onSubmit={async e=>{
         e.preventDefault();
         if(!assistantQ.trim()||assistantBusy)return;
         setAssistantBusy(true);setAssistantError('');
         try{
           const res=await fetch('/api/assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:assistantQ.trim()})});
           const d=await res.json();
           if(!res.ok)throw new Error(d.error||'Assistant request failed');
           setAssistantA(d.answer||'No answer');
         }catch(err){setAssistantError(err instanceof Error?err.message:'Assistant unavailable')}
         finally{setAssistantBusy(false)}
       }}>
         <input value={assistantQ} onChange={e=>setAssistantQ(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent px-2.5 py-2 text-sm text-white outline-none placeholder:text-white/30" placeholder="যেমন: আজকের বিক্রি কত?" aria-label="Ask AI Assistant"/>
         <button type="button" onClick={()=>{
           setAssistantError('');
           if(!('SpeechRecognition' in window||'webkitSpeechRecognition' in window)){setAssistantError('Voice input is not supported in this browser.');return;}
           const C=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
           const recognition=new C();
           recognition.lang='bn-BD';recognition.continuous=false;recognition.interimResults=true;
           recognition.onstart=()=>setAssistantListening(true);
           recognition.onresult=(e:any)=>{let value='';for(let i=0;i<e.results.length;i++)value+=e.results[i][0].transcript;setAssistantQ(value)};
           recognition.onerror=()=>{setAssistantListening(false);setAssistantError('Voice input could not be captured. Please try again.')};
           recognition.onend=()=>setAssistantListening(false);
           recognition.start();
         }} disabled={assistantListening||assistantBusy} aria-label="Speak your assistant question" title="Speak your assistant question" className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${assistantListening?'border-emerald-400/40 bg-emerald-400/10 text-emerald-300':'border-white/10 bg-white/[.05] text-[#abd2fa] hover:bg-white/[.09]'} disabled:opacity-50`}>
           {assistantListening&&<span className="absolute inset-0 animate-ping rounded-xl bg-emerald-400/10" />}
           <Mic size={17} className="relative" />
         </button>
         <button type="submit" disabled={assistantBusy||!assistantQ.trim()} aria-label="Send assistant question" title="Send assistant question" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1b2cc1] text-white transition hover:bg-[#2436d4] disabled:opacity-30">
           {assistantBusy?<Loader2 className="animate-spin" size={17}/>:<Send size={17}/>}
         </button>
       </form>
       {assistantA&&!assistantBusy&&<div className="mt-3 rounded-xl border border-white/10 tk-glass-subtle px-3.5 py-3 text-sm text-white/75"><div className="flex items-start gap-2"><span className="min-w-0 flex-1 leading-6">{assistantA}</span><button type="button" onClick={()=>setAssistantA('')} aria-label="Clear assistant answer" className="shrink-0 rounded-lg p-1 text-white/35 transition hover:bg-white/[.06] hover:text-white/70"><X size={15}/></button></div></div>}
       {assistantError&&<p className="mt-2 px-1 text-xs text-red-300/90" role="alert">{assistantError}</p>}
     </div>
   </section>

   <section className="tk-dash-stats">
     <Link href="/dashboard/sales" className="tk-stat-card">
       <div className="tk-stat-top"><span className="tk-stat-label">আজকের বিক্রি</span><span className="tk-stat-icon"><ShoppingCart size={17}/></span></div>
       <strong>{money(todayTotal)}</strong>
       <span className="tk-stat-meta">{data?.todaySales?.count||0} টি বিক্রি <ArrowUpRight size={14}/></span>
     </Link>
     <Link href="/dashboard/parties" className="tk-stat-card tk-stat-due">
       <div className="tk-stat-top"><span className="tk-stat-label">মোট বাকি</span><span className="tk-stat-icon"><WalletCards size={17}/></span></div>
       <strong>{money(due)}</strong>
       <span className="tk-stat-meta">{data?.dueCustomers||0} জন কাস্টমার <ArrowUpRight size={14}/></span>
     </Link>
   </section>

   <section className="tk-quick-actions">
     <div className="tk-new-section-head"><div><p className="tk-dash-kicker">QUICK ACTIONS</p><h2>দ্রুত কাজ</h2></div></div>
     <div className="tk-action-grid">
       <Link href="/dashboard/parties"><Users/><span><b>কাস্টমার</b><small>নতুন কাস্টমার</small></span><Plus size={15}/></Link>
       <Link href="/dashboard/sales"><ShoppingCart/><span><b>বিক্রি</b><small>নতুন বিক্রি</small></span><Plus size={15}/></Link>
       <Link href="/dashboard/products"><Package/><span><b>পণ্য</b><small>স্টক দেখুন</small></span><ChevronRight size={15}/></Link>
       <Link href="/dashboard/payments"><WalletCards/><span><b>পেমেন্ট</b><small>বাকি আদায়</small></span><Plus size={15}/></Link>
     </div>
   </section>

   <section className="tk-new-insight">
     <div className="tk-new-section-head"><div><p className="tk-dash-kicker">AI INSIGHT · 7 DAYS</p><h2>বিক্রির ট্রেন্ড</h2></div><Link href="/dashboard/reports">রিপোর্ট <ChevronRight size={15}/></Link></div>
     <div className="tk-insight-grid-new">
       <div className="tk-insight-number"><span>আজ</span><strong>{money(todayTotal)}</strong><p>আজকের বিক্রি গত ৭ দিনের activity-এর সাথে দেখুন।</p></div>
       <div className="tk-chart-new" aria-label="Last 7 days sales chart">{chart.map(item=><div className="tk-chart-new-col" key={item.date}><span>{item.total?money(item.total):''}</span><i style={{height:Math.max(item.total?10:3,(item.total/max)*100)+'%'}}/><small>{item.label}</small></div>)}</div>
     </div>
   </section>

   <section className="tk-ledger-new">
     <div className="tk-new-section-head">
       <div><p className="tk-dash-kicker">RECENT KHATA</p><h2>সাম্প্রতিক লেনদেন</h2></div>
       <Link href="/dashboard/transactions">সব দেখুন <ChevronRight size={15}/></Link>
     </div>
     <form className="tk-ledger-search" onSubmit={e=>e.preventDefault()}><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="কাস্টমার বা লেনদেন খুঁজুন..." aria-label="Search transactions"/></form>
     <div className="tk-ledger-list">
       {recent.map((item,i)=><Link href="/dashboard/transactions" key={item._id} className="tk-ledger-row">
         <span className={'tk-ledger-dot '+(/DUE/i.test(item.type)?'due':isPositive(item)?'paid':'sale')}/>
         <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3>{txTitle(item)}</h3>{i===0&&<em>LATEST</em>}</div><p>{time(item.timestamp)} · {txStatus(item)}{item.source==='VOICE'?' · Voice AI':''}</p></div>
         <strong className={isPositive(item)?'positive':''}>{isPositive(item)?'+':''}{money(item.amount)}</strong>
         <ChevronRight size={16} className="tk-ledger-chevron"/>
       </Link>)}
       {!recent.length&&<div className="py-10 text-center text-sm text-white/40">এখনো কোনো লেনদেন নেই।</div>}
     </div>
   </section>

   <button type="button" className="tk-floating-voice" aria-label="Open Voice AI" onClick={()=>window.dispatchEvent(new CustomEvent('talikhata:voice-open'))}><span><Mic size={24}/></span><b>ভয়েস এআই</b><small>কথা বলুন</small></button>
 </div>;
}
