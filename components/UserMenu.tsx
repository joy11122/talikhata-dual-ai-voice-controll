'use client';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
export default function UserMenu({name,email}:{name?:string|null;email?:string|null}){return <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-semibold">{name||'Shop owner'}</p><p className="text-xs text-slate-500">{email||''}</p></div><button onClick={()=>signOut({callbackUrl:'/'})} className="btn-secondary"><LogOut size={16}/> Sign out</button></div>}
