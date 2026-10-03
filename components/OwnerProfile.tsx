'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArchiveRestore,LogOut,Settings,UserRound,X} from 'lucide-react';
import DataRecoveryPanel from '@/components/DataRecoveryPanel';
import {signOut} from 'next-auth/react';

export default function OwnerProfile({name,email,image}:{name?:string|null;email?:string|null;image?:string|null}){
 const [photo,setPhoto]=useState(image||'');
 const [menuOpen,setMenuOpen]=useState(false);
 const [recoveryOpen,setRecoveryOpen]=useState(false);
 const menuRef=useRef<HTMLDivElement>(null);

 useEffect(()=>setPhoto(image||''),[image]);

 useEffect(()=>{
   if(!menuOpen)return;
   const onPointerDown=(event:MouseEvent)=>{
     if(menuRef.current&&!menuRef.current.contains(event.target as Node))setMenuOpen(false);
   };
   const onKeyDown=(event:KeyboardEvent)=>{
     if(event.key==='Escape')setMenuOpen(false);
   };
   document.addEventListener('mousedown',onPointerDown);
   document.addEventListener('keydown',onKeyDown);
   return()=>{
     document.removeEventListener('mousedown',onPointerDown);
     document.removeEventListener('keydown',onKeyDown);
   };
 },[menuOpen]);

 const openRecovery=()=>setRecoveryOpen(value=>!value);

 return <div ref={menuRef} className="relative flex items-center gap-2">
   <div className="hidden text-right lg:block">
     <p className="text-sm font-semibold">{name||'Shop owner'}</p>
     <p className="text-xs text-white/45">{email||''}</p>
   </div>

   <button
     type="button"
     onClick={()=>setMenuOpen(value=>!value)}
     className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-transparent shadow-sm ring-1 ring-white/5 transition hover:ring-[#7692ff]/50 active:scale-95"
     aria-label="Open profile menu"
     aria-haspopup="menu"
     aria-expanded={menuOpen}
     title="Profile menu"
   >
     {photo
       ? <img src={photo} alt={name||'Business owner'} className="h-full w-full object-cover"/>
       : <span className="flex h-full w-full items-center justify-center text-white/60"><UserRound size={19}/></span>}
   </button>

   {menuOpen&&(
     <div
       role="menu"
       aria-label="Profile menu"
       className="absolute right-0 top-[calc(100%+10px)] z-[80] w-[min(280px,calc(100vw-24px))] max-h-[calc(100vh-90px)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#091540]/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-[24px]"
     >
       <div className="flex items-center gap-3 border-b border-white/[0.08] px-3 py-3">
         <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-transparent">
           {photo
             ? <img src={photo} alt="" className="h-full w-full object-cover"/>
             : <span className="flex h-full w-full items-center justify-center text-white/55"><UserRound size={18}/></span>}
         </div>
         <div className="min-w-0 flex-1">
           <p className="truncate text-sm font-semibold text-white">{name||'Shop owner'}</p>
           <p className="truncate text-xs text-white/45">{email||''}</p>
         </div>
         <button type="button" onClick={()=>setMenuOpen(false)} className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white" aria-label="Close profile menu">
           <X size={16}/>
         </button>
       </div>

       <div className="py-1">
         <Link href="/dashboard/settings" role="menuitem" onClick={()=>setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/75 transition hover:bg-white/5 hover:text-white">
           <Settings size={17} className="text-white/45"/>
           <span>Settings</span>
         </Link>
         <button type="button" role="menuitem" onClick={openRecovery} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 transition hover:bg-white/5 hover:text-white">
           <ArchiveRestore size={17} className="text-white/45"/>
           <span className="flex-1">Backup &amp; deleted data</span>
           <span className="text-xs text-white/40">{recoveryOpen?'▴':'▾'}</span>
         </button>
       </div>

       {recoveryOpen&&<div className="mx-1 mb-1 rounded-xl border border-white/[0.08] bg-transparent p-2"><DataRecoveryPanel embedded onClose={()=>setRecoveryOpen(false)}/></div>}

       <div className="border-t border-white/[0.08] pt-1">
         <button
           type="button"
           role="menuitem"
           onClick={()=>void signOut({callbackUrl:'/signin'})}
           className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 transition hover:bg-white/5 hover:text-white"
         >
           <LogOut size={17} className="text-white/45"/>
           <span>Sign out</span>
         </button>
       </div>
     </div>
   )}

 </div>
}