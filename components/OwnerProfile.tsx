'use client';

import {useEffect,useRef,useState} from 'react';
import {LogOut,UserRound} from 'lucide-react';
import DataRecoveryPanel from '@/components/DataRecoveryPanel';
import {signOut} from 'next-auth/react';

export default function OwnerProfile({name,email,image}:{name?:string|null;email?:string|null;image?:string|null}){
 const [photo,setPhoto]=useState(image||'');const [recoveryOpen,setRecoveryOpen]=useState(false);
 useEffect(()=>setPhoto(image||''),[image]);
 return <div className="flex items-center gap-2">
   <div className="hidden text-right lg:block"><p className="text-sm font-semibold">{name||'Shop owner'}</p><p className="text-xs text-slate-500">{email||''}</p></div>
   <button type="button" onClick={()=>setRecoveryOpen(true)} className="group relative h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-transparent shadow-sm ring-1 ring-white/5 transition hover:ring-[#7692ff]/50 active:scale-95" aria-label="Open backup and deleted data" title="Backup & deleted data">
    {photo?<img src={photo} alt={name||'Business owner'} className="h-full w-full object-cover"/>:<span className="flex h-full w-full items-center justify-center text-white/60"><UserRound size={19}/></span>}
   </button>
   <button type="button" onClick={()=>void signOut({callbackUrl:'/signin'})} className="flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-transparent px-3 text-white/80 shadow-sm transition hover:bg-transparent active:scale-95" aria-label="Sign out" title="Sign out"><LogOut size={17}/><span className="hidden xl:inline text-xs font-semibold">Sign out</span></button>
   {recoveryOpen&&<DataRecoveryPanel onClose={()=>setRecoveryOpen(false)}/>}
 </div>
}