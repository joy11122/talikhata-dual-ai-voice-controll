'use client';
import {useEffect,useState} from 'react';
import {Search,Loader2} from 'lucide-react';
type Result={users:any[];shops:any[];parties:any[];products:any[];transactions:any[]};
export default function AdminSearch(){
 const[q,setQ]=useState(''); const[data,setData]=useState<Result|null>(null); const[loading,setLoading]=useState(false);
 useEffect(()=>{if(q.trim().length<2){setData(null);return} const t=setTimeout(async()=>{setLoading(true);try{const r=await fetch('/api/admin/search?q='+encodeURIComponent(q.trim()));if(r.ok)setData(await r.json());else setData(null)}catch{setData(null)}finally{setLoading(false)}},300);return()=>clearTimeout(t)},[q]);
 const groups=data?[['Users',data.users],['Shops',data.shops],['Parties',data.parties],['Products',data.products],['Transactions',data.transactions]] as const:[];
 const total=groups.reduce((n,[,items])=>n+items.length,0);
 return <section className="relative rounded-2xl border border-black/[.07] bg-white p-5"><label htmlFor="admin-search" className="text-sm font-semibold">Global search</label><div className="relative mt-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input id="admin-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Users, shops, parties, products…" className="h-11 w-full rounded-xl border border-black/10 pl-10 pr-10 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"/>{loading&&<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" size={18}/>}</div>{data&&<div className="mt-4 space-y-4 text-sm">{total===0?<p className="text-slate-500">No results found.</p>:groups.map(([title,items])=>items.length>0?<div key={title}><p className="mb-2 font-semibold">{title}</p><div className="grid gap-2">{items.slice(0,5).map((x:any)=><div key={String(x._id)} className="rounded-xl bg-slate-50 p-3">{x.email||x.name||x.shopName||x.type||'Result'} <span className="text-slate-400">{x.status||x.partyType||x.unit||''}</span></div>)}</div></div>:null)}</div>}</section>
}
