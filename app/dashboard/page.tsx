'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, ChevronRight, Mic, Plus,
  Search, ShoppingCart, Users, WalletCards, Package, Sparkles,
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
 const[loading,setLoading]=useState(true);
 const[query,setQuery]=useState('');
 const load=async()=>{try{setData(await apiRequest<DashboardData>('/api/dashboard'))}catch{setData(null)}finally{setLoading(false)}};
 useEffect(()=>{void load();const r=()=>void load();window.addEventListener('talikhata:refresh',r);return()=>window.removeEventListener('talikhata:refresh',r)},[]);
 const recent=useMemo(()=>data?.recent?.filter(x=>{const q=query.trim().toLowerCase();return !q||txTitle(x).toLowerCase().includes(q)||txStatus(x).toLowerCase().includes(q)}).slice(0,5)??[],[data,query]);
 const chart=data?.weeklySales??[];
 const max=Math.max(...chart.map(x=>x.total),1);
 const todayTotal=data?.todaySales?.total??0;
 const due=data?.balances?.receivable??0;

 if(loading)return <div className="tk-new-dashboard mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8"><div className="space-y-5 animate-pulse"><div className="h-16 rounded-2xl bg-white/[.03]"/><div className="grid gap-4 sm:grid-cols-2"><div className="h-32 rounded-2xl bg-white/[.03]"/><div className="h-32 rounded-2xl bg-white/[.03]"/></div><div className="h-72 rounded-2xl bg-white/[.03]"/></div></div>;

 return <div className="tk-new-dashboard mx-auto w-full max-w-6xl px-4 pb-36 pt-3 md:px-8 md:pb-10">
   <section className="tk-dash-welcome">
     <div className="min-w-0">
       <p className="tk-dash-kicker">GOOD DAY · JALAL STORE</p>
       <h1>আজকের হিসাব এক নজরে</h1>
       <p className="tk-dash-subtitle">আপনার দোকানের গুরুত্বপূর্ণ হিসাব ও খাতা এখানে।</p>
     </div>
     <div className="tk-dash-date">আজকের হিসাব</div>
   </section>

   <section className="tk-dash-command">
     <button type="button" className="tk-command-icon" aria-label="Open AI Assistant" onClick={()=>window.dispatchEvent(new CustomEvent('talikhata:assistant-open'))}><Sparkles size={18}/></button>
     <div className="min-w-0 flex-1">
       <p>VOICE AI</p><strong>কথা বলেই দোকানের হিসাব করুন</strong>
       <span>কাস্টমার, বিক্রি, পেমেন্ট, পণ্য ও খাতা—সবকিছু ভয়েসে।</span>
     </div>
     <button type="button" className="tk-command-button" aria-label="Open Voice AI" onClick={()=>window.dispatchEvent(new CustomEvent('talikhata:voice-open'))}><Mic size={19}/><span>Voice AI</span></button>
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
