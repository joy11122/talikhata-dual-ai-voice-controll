'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArchiveRestore,DatabaseBackup,Loader2,Trash2,X} from 'lucide-react';

type Props={onClose:()=>void;embedded?:boolean};

export default function DataRecoveryPanel({onClose,embedded=false}:Props){
 const [tab,setTab]=useState<'backup'|'deleted'>('backup');
 const [loading,setLoading]=useState(false);
 const [data,setData]=useState<any>({backups:[]});
 const [status,setStatus]=useState<{type:'success'|'error';message:string}|null>(null);
 const [confirmAction,setConfirmAction]=useState<{kind:'deleted'|'backup';type?:string;id:string;message:string}|null>(null);

 async function load(){
  setLoading(true);
  setStatus(null);
  try{
   const r=await fetch(`/api/data-management?mode=${tab==='backup'?'backups':'deleted'}`,{cache:'no-store'});
   const d=await r.json();
   if(r.ok)setData(d);
  }finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[tab]);

 async function backup(){
  setLoading(true);
  try{
   const r=await fetch('/api/data-management',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({label:'Manual backup'})});
   if(!r.ok)throw new Error('Backup failed');
   setStatus({type:'success',message:'Backup successfully created.'});
   await load();
  }catch(e:any){setStatus({type:'error',message:e?.message||'Backup failed. Please try again.'})}finally{setLoading(false)}
 }
 async function restore(type:string,id:string){
  setConfirmAction({kind:'deleted',type,id,message:'এই deleted data আবার restore করতে চান?'});
 }
 async function confirmRestore(){
  if(!confirmAction)return;
  const {kind,type,id}=confirmAction;
  setConfirmAction(null);
  setLoading(true);
  try{
   const r=await fetch('/api/data-management/restore',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type,id})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(d?.error||'Restore failed');
   setStatus({type:'success',message:'Deleted data restored successfully.'});
   await load();
  }catch(e:any){setStatus({type:'error',message:e?.message||'Restore failed. Please try again.'})}finally{setLoading(false)}
 }
 async function restoreBackup(id:string){
  setConfirmAction({kind:'backup',id,message:'এই backup restore করতে চান? নতুন records মুছে ফেলা হবে না।'});
 }
 async function confirmBackupRestore(id:string){
  setLoading(true);
  try{
   const r=await fetch('/api/data-management',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(d?.error||'Backup restore failed');
   setStatus({type:'success',message:'Backup restored successfully.'});
  }catch(e:any){setStatus({type:'error',message:e?.message||'Backup restore failed. Please try again.'})}finally{setLoading(false)}
 }

 if(!embedded&&typeof document==='undefined')return null;

 const content=(
  <div className={embedded?'w-full':'fixed inset-0 z-[2147483647] overflow-y-auto bg-black/35 backdrop-blur-[24px]'} role="dialog" aria-modal={!embedded}>
  <div className={embedded?'w-full':'flex min-h-full w-full items-start justify-center p-3 py-6 sm:items-center sm:p-5'}>
   <div className={embedded?'w-full overflow-hidden':'tk-modal-panel w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl p-4 sm:p-5'}>
    <div className="flex items-start justify-between gap-3">
     <div className="min-w-0"><h2 className="text-lg font-semibold">Data & Backup</h2><p className="text-xs text-white/50">Protect and recover your shop data</p></div>
     <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-lg p-1.5 text-white/60 hover:bg-white/5 hover:text-white"><X size={20}/></button>
    </div>
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
     <button type="button" onClick={()=>setTab('backup')} className={`shrink-0 rounded-xl px-3 py-2 text-sm ${tab==='backup'?'bg-[#1B2CC1]/60':'bg-transparent text-white/60'}`}><DatabaseBackup size={15} className="mr-2 inline"/>Backups</button>
     <button type="button" onClick={()=>setTab('deleted')} className={`shrink-0 rounded-xl px-3 py-2 text-sm ${tab==='deleted'?'bg-[#1B2CC1]/60':'bg-transparent text-white/60'}`}><Trash2 size={15} className="mr-2 inline"/>Deleted data</button>
    </div>
    {tab==='backup'&&<div className="mt-4">
      <button type="button" onClick={()=>void backup()} disabled={loading} className="rounded-xl border border-white/10 px-4 py-2 text-sm">{loading?<Loader2 size={15} className="mr-2 inline animate-spin"/>:<DatabaseBackup size={15} className="mr-2 inline"/>}Create backup now</button>
      <div className="mt-4 space-y-2">{(data.backups||[]).map((b:any)=><div key={b._id} className="flex flex-col gap-3 rounded-xl border border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm">{b.label}</p><p className="text-xs text-white/45">{new Date(b.createdAt).toLocaleString()}</p></div><button type="button" onClick={()=>void restoreBackup(b._id)} className="shrink-0 self-start rounded-lg border border-white/10 px-3 py-1.5 text-xs sm:self-auto"><ArchiveRestore size={14} className="mr-1 inline"/>Restore</button></div>)}</div>
    </div>}
    {tab==='deleted'&&<div className="mt-4 space-y-2">{[['party','customers','Users'],['product','products','Products'],['transaction','transactions','Transactions']].map(([type,key,label])=><section key={type}><h3 className="mb-2 text-sm font-semibold">{label==='Users'?'Customers':label}</h3>{(data[key]||[]).map((x:any)=><div key={x._id} className="mb-2 flex flex-col gap-3 rounded-xl border border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm">{x.name||x.notes||x.type||'Deleted item'}</p><p className="text-xs text-white/40">{x.deletedAt?new Date(x.deletedAt).toLocaleString():''}</p></div><button type="button" onClick={()=>void restore(type,x._id)} className="shrink-0 self-start rounded-lg border border-white/10 px-3 py-1.5 text-xs sm:self-auto"><ArchiveRestore size={14} className="mr-1 inline"/>Restore</button></div>)}</section>)}</div>}
    {loading&&<div className="mt-3 text-xs text-white/50">Working…</div>}
    {confirmAction&&<div className="fixed inset-0 z-[2147483648] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[32px]" role="alertdialog" aria-modal="true"><div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#091540]/98 p-5 shadow-2xl backdrop-blur-[28px]"><h3 className="text-base font-semibold">Confirm restore</h3><p className="mt-2 text-sm text-white/60">{confirmAction.message}</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setConfirmAction(null)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/65">Cancel</button><button type="button" onClick={()=>void (confirmAction.kind==='deleted'?confirmRestore():confirmBackupRestore(confirmAction.id))} className="rounded-xl bg-[#1B2CC1]/80 px-4 py-2 text-sm font-medium">Restore</button></div></div></div>}
    {status&&<div role="status" className={`mt-3 rounded-lg border px-3 py-2 text-xs ${status.type==='success'?'border-emerald-400/20 bg-emerald-400/10 text-emerald-200':'border-red-400/20 bg-red-400/10 text-red-200'}`}>{status.message}</div>}
   </div>
  </div>
 </div>
 );
 return embedded?content:createPortal(content,document.body);
}