'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {BarChart3,Download,Mic,Search,SlidersHorizontal,ChevronRight} from 'lucide-react';
import {apiRequest} from '@/lib/api-client';

type Tx={_id:string;partyId?:{name:string};productId?:{name:string};type:string;amount?:number;timestamp:string;source?:'MANUAL'|'VOICE'|'SYSTEM'};
type DashboardData={parties:number;products:number;lowStock:number;dueCustomers?:number;balances?:{receivable?:number;payable?:number};recent?:Tx[];todaySales?:{total?:number;count?:number};weeklySales?:Array<{label:string;date:string;total:number}>};

const money=(v?:number)=>`৳ ${Number(v||0).toLocaleString('bn-BD')}`;
const saleType=(type:string)=>/SALE|DUE_SALE|CASH_SALE/i.test(type);
const txTitle=(x:Tx)=>x.partyId?.name?(/DUE/i.test(x.type)?`${x.partyId.name}-এর বাকি`:x.partyId.name):/SALE/i.test(x.type)?'ক্যাশ বিক্রি':x.productId?.name||x.type;
const txStatus=(x:Tx)=>/SALE/i.test(x.type)?(/DUE/i.test(x.type)?'Due added, via Voice':'Cash sale'):/PAYMENT|RECEIVE/i.test(x.type)?'Payment, via Voice':'লেনদেন';
const isPositive=(x:Tx)=>/PAYMENT|RECEIVE/i.test(x.type);
const time=(v:string)=>new Date(v).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});

export default function DashboardPage(){
 const[data,setData]=useState<DashboardData|null>(null);const[loading,setLoading]=useState(true);const[query,setQuery]=useState('');
 const load=async()=>{try{setData(await apiRequest<DashboardData>('/api/dashboard'))}finally{setLoading(false)}};
 useEffect(()=>{void load();const r=()=>void load();window.addEventListener('talikhata:refresh',r);return()=>window.removeEventListener('talikhata:refresh',r)},[]);
 const recent=useMemo(()=>data?.recent?.filter(x=>{const q=query.trim().toLowerCase();return !q||txTitle(x).toLowerCase().includes(q)||txStatus(x).toLowerCase().includes(q)}).slice(0,5)??[],[data,query]);
 const dueCustomers=data?.dueCustomers??0;
 const chart=data?.weeklySales??[];
 const max=Math.max(...chart.map(x=>x.total),1);
 const runSearch=()=>{if(query.trim())window.dispatchEvent(new CustomEvent('talikhata:command',{detail:query.trim()}))};
 if(loading)return <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8"><div className="space-y-4 animate-pulse"><div className="h-12 rounded-xl bg-white"/><div className="grid grid-cols-2 gap-3"><div className="h-32 rounded-2xl bg-white"/><div className="h-32 rounded-2xl bg-white"/></div><div className="h-80 rounded-2xl bg-white"/></div></div>;

 return <div className="tk-dashboard mx-auto w-full max-w-6xl px-4 pb-36 pt-2 md:px-8 md:pb-10">
   <header className="tk-store-header"><div className="tk-store-name"><span>Jalal Store</span><span className="tk-store-bn">জালাল স্টোর</span></div><div className="tk-voice-ready"><Mic size={16} className="tk-voice-ready-icon"/><span>Voice AI Ready</span></div></header>
   <div className="space-y-5">
     <form onSubmit={e=>{e.preventDefault();runSearch()}} className="tk-search">
       <Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search (voice-capable)" aria-label="Search, voice-capable"/><button type="button" aria-label="Filter" title="Filter"><SlidersHorizontal size={19}/></button>
     </form>

     <section className="grid grid-cols-2 gap-3 md:gap-4">
       <Link href="/dashboard/sales" className="tk-metric tk-metric-sales"><span>আজকের বিক্রি</span><strong>{money(data?.todaySales?.total)}</strong><small>{data?.todaySales?.count||0} টি sale</small></Link>
       <Link href="/dashboard/parties" className="tk-metric tk-metric-due"><span>মোট বাকি</span><strong>{money(data?.balances?.receivable)}</strong><small>({dueCustomers} কাস্টমার)</small></Link>
     </section>

     <section className="tk-insight">
       <div className="tk-insight-heading"><div><p className="tk-eyebrow">TALIKHATA AI INSIGHT</p><h2>গত ৭ দিনের বিক্রি</h2></div></div>
       <div className="tk-insight-body">
         <div className="tk-insight-summary">
           <span>Business Insight</span>
           <strong>{money(data?.todaySales?.total)}</strong>
           <span>আজকের বিক্রি · গত ৭ দিনের ট্রেন্ড দেখুন</span>
         </div>
         <div className="tk-insight-chart-wrap">
           <div className="tk-chart" aria-label="Last 7 days sales chart">
             {chart.map(item => (
               <div key={item.date} className="tk-bar-wrap">
                 <div className="tk-bar-value">{item.total ? money(item.total) : ''}</div>
                 <div className="tk-bar" style={{height: Math.max(item.total ? 10 : 3, (item.total / max) * 100) + '%'}} />
                 <span>{item.label}</span>
               </div>
             ))}
           </div>
         </div>
       </div>
       <div className="flex flex-col gap-3 border-t border-teal-900/10 pt-3 sm:flex-row sm:items-center sm:justify-between"><p className="tk-insight-copy">গত ৭ দিনের sales এক নজরে দেখুন। আজকের হিসাবসহ দ্রুত business insight।</p><button type="button" className="tk-export" onClick={()=>window.print()}><Download size={15}/> Quick export</button></div>
     </section>

     <section>
       <div className="mb-3 flex items-end justify-between"><div><p className="tk-eyebrow">LEDGER</p><h2 className="tk-section-title">রিসেন্ট খাতা ট্রানজ্যাকশন</h2></div><Link href="/dashboard/transactions" className="flex items-center gap-1 text-xs font-semibold text-teal-700">সব দেখুন <ChevronRight size={14}/></Link></div>
       <div className="space-y-2.5">
        {recent.map((item,i)=><div key={item._id} className="tk-transaction">
          <span className={`tk-status-dot ${/DUE/i.test(item.type)?'due':isPositive(item)?'paid':'sale'}`}/>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3>{txTitle(item)}</h3>{i===0&&<span className="tk-new">LATEST</span>}</div><p>{time(item.timestamp)} <span>•</span> {txStatus(item)}</p></div>
          <div className="text-right"><strong className={isPositive(item)?'positive':''}>{isPositive(item)?'+':''}{money(item.amount).replace('৳ ','৳ ')}</strong><span>{saleType(item.type)?'Sale':'Transaction'}</span></div>
          {item.source==='VOICE'&&<Mic size={14} className="tk-mic" aria-label="Voice transaction"/>}
        </div>)}
        {!recent.length&&<div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">এখনো কোনো লেনদেন নেই।</div>}
       </div>
     </section>
   </div>
 </div>;
}
