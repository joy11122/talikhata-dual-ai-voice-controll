'use client';
import {useEffect,useState} from 'react';
import {ArchiveRestore,DatabaseBackup,History,Loader2,Package,Users,Receipt,Trash2,X} from 'lucide-react';

type Props={onClose:()=>void};
export default function DataRecoveryPanel({onClose}:Props){
 const [tab,setTab]=useState<'backup'|'deleted'>('backup');const [loading,setLoading]=useState(false);const [data,setData]=useState<any>({backups:[]});
 async function load(){
  setLoading(true);try{const r=await fetch(`/api/data-management?mode=${tab==='backup'?'backups':'deleted'}`,{cache:'no-store'});const d=await r.json();if(r.ok)setData(d)}finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[tab]);
 async function backup(){setLoading(true);try{const r=await fetch('/api/data-management',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({label:'Manual backup'})});if(!r.ok)throw new Error('Backup failed');await load()}finally{setLoading(false)}}
 async function restore(type:string,id:string){if(!confirm('Restore this deleted data?'))return;setLoading(true);try{const r=await fetch('/api/data-management/restore',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type,id})});if(!r.ok)throw new Error('Restore failed');await load()}finally{setLoading(false)}}
 async function restoreBackup(id:string){if(!confirm('Restore records from this backup? Matching records will be restored without deleting newer records.'))return;setLoading(true);try{const r=await fetch('/api/data-management',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id})});if(!r.ok)throw new Error('Backup restore failed');alert('Backup restored successfully.');}finally{setLoading(false)}}
 return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[24px]" role="dialog" aria-modal="true">
  <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#091540]/80 p-4 shadow-2xl backdrop-blur-2xl">
   <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Data & Backup</h2><p className="text-xs text-white/50">Protect and recover your shop data</p></div><button onClick={onClose} aria-label="Close"><X size={20}/></button></div>
   <div className="mt-4 flex gap-2"><button onClick={()=>setTab('backup')} className={`rounded-xl px-3 py-2 text-sm ${tab==='backup'?'bg-[#1B2CC1]/60':'bg-transparent text-white/60'}`}><DatabaseBackup size={15} className="mr-2 inline"/>Backups</button><button onClick={()=>setTab('deleted')} className={`rounded-xl px-3 py-2 text-sm ${tab==='deleted'?'bg-[#1B2CC1]/60':'bg-transparent text-white/60'}`}><Trash2 size={15} className="mr-2 inline"/>Deleted data</button></div>
   {tab==='backup'&&<div className="mt-4"><button onClick={()=>void backup()} disabled={loading} className="rounded-xl border border-white/10 px-4 py-2 text-sm">{loading?<Loader2 size={15} className="mr-2 inline animate-spin"/>:<DatabaseBackup size={15} className="mr-2 inline"/>}Create backup now</button><div className="mt-4 space-y-2">{(data.backups||[]).map((b:any)=><div key={b._id} className="flex items-center justify-between rounded-xl border border-white/10 p-3"><div><p className="text-sm">{b.label}</p><p className="text-xs text-white/45">{new Date(b.createdAt).toLocaleString()}</p></div><button onClick={()=>void restoreBackup(b._id)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs"><ArchiveRestore size={14} className="mr-1 inline"/>Restore</button></div>)}</div></div>}
   {tab==='deleted'&&<div className="mt-4 space-y-2">{[['party','customers','Users'],['product','products','Products'],['transaction','transactions','Transactions']].map(([type,key,label])=><section key={type}><h3 className="mb-2 text-sm font-semibold">{label==='Users'?'Customers':label}</h3>{(data[key]||[]).map((x:any)=><div key={x._id} className="mb-2 flex items-center justify-between rounded-xl border border-white/10 p-3"><div className="min-w-0"><p className="truncate text-sm">{x.name||x.notes||x.type||'Deleted item'}</p><p className="text-xs text-white/40">{x.deletedAt?new Date(x.deletedAt).toLocaleString():''}</p></div><button onClick={()=>void restore(type,x._id)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs"><ArchiveRestore size={14} className="mr-1 inline"/>Restore</button></div>)}</section>)}</div>}
   {loading&&<div className="mt-3 text-xs text-white/50">Working…</div>}
  </div>
 </div>
}
