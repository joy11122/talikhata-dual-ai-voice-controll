'use client';

import {useEffect,useRef,useState} from 'react';
import {Camera,Loader2,LogOut,UserRound} from 'lucide-react';
import {signOut} from 'next-auth/react';

export default function OwnerProfile({name,email,image}:{name?:string|null;email?:string|null;image?:string|null}){
 const [photo,setPhoto]=useState(image||'');const [saving,setSaving]=useState(false);const input=useRef<HTMLInputElement>(null);
 useEffect(()=>setPhoto(image||''),[image]);
 async function change(file?:File){if(!file)return;if(!file.type.match(/^image\/(jpeg|png|webp)$/)){alert('Please choose a JPG, PNG or WebP image.');return}if(file.size>500*1024){alert('Please choose an image under 500 KB.');return}const reader=new FileReader();reader.onload=async()=>{const value=String(reader.result||'');setSaving(true);try{const r=await fetch('/api/profile',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({image:value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not update photo');setPhoto(d.image||'')}catch(e){alert(e instanceof Error?e.message:'Could not update photo')}finally{setSaving(false)}};reader.readAsDataURL(file)}
 return <div className="flex items-center gap-2">
   <div className="hidden text-right lg:block"><p className="text-sm font-semibold">{name||'Shop owner'}</p><p className="text-xs text-slate-500">{email||''}</p></div>
   <button type="button" onClick={()=>input.current?.click()} disabled={saving} className="group relative h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-sm ring-2 ring-white transition hover:ring-emerald-200" aria-label="Edit profile photo" title="Edit profile photo">
    {photo?<img src={photo} alt={name||'Business owner'} className="h-full w-full object-cover"/>:<span className="flex h-full w-full items-center justify-center text-slate-500"><UserRound size={19}/></span>}
    <span className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-white opacity-0 transition group-hover:opacity-100">{saving?<Loader2 size={15} className="animate-spin"/>:<Camera size={15}/>}</span>
   </button>
   <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{void change(e.target.files?.[0]);e.currentTarget.value=''}}/>
   <button type="button" onClick={()=>void signOut({callbackUrl:'/signin'})} className="flex h-10 items-center justify-center gap-2 rounded-full border border-black/[0.06] bg-white px-3 text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95" aria-label="Sign out" title="Sign out"><LogOut size={17}/><span className="hidden xl:inline text-xs font-semibold">Sign out</span></button>
 </div>
}