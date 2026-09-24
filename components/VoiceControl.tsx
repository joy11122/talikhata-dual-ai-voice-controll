'use client';

import { useRef, useState } from 'react';
import { AlertCircle, Check, ChevronRight, Loader2, Mic, Send, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type State='Idle'|'Listening'|'Processing'|'Success'|'Error';
type Pending={tool:string;args:any;message:string;matches?:any[]};

function resultMessage(tool:string,result:any){
  if(tool==='get_balance'||tool==='get_party'){
    const name=result?.party?.name||'গ্রাহক';
    const r=Number(result?.receivable||0),p=Number(result?.payable||0);
    if(r>0)return name+' এর কাছে আপনার '+r.toLocaleString('bn-BD')+' টাকা পাওনা আছে।';
    if(p>0)return name+' আপনাকে '+p.toLocaleString('bn-BD')+' টাকা পাবে।';
    return name+' এর সাথে কোনো বাকি নেই।';
  }
  if(tool==='create_party')return result.name+' নামে '+(result.partyType==='SUPPLIER'?'সাপ্লায়ার':'কাস্টমার')+' যোগ করা হয়েছে।';
  if(tool==='create_product')return result.name+' পণ্যটি যোগ করা হয়েছে।';
  if(tool==='create_transaction'){if(result.type==='DUE_GIVEN')return 'বাকির হিসাব যোগ করা হয়েছে।';if(result.type==='DUE_RECEIVED')return 'জমার হিসাব সংরক্ষণ করা হয়েছে।';return 'লেনদেন সংরক্ষণ করা হয়েছে।';}
  if(tool==='delete_party'||tool==='delete_product'||tool==='delete_transaction'||tool==='delete_user')return 'সফলভাবে মুছে দেওয়া হয়েছে।';
  if(tool.startsWith('update_'))return 'তথ্য সফলভাবে আপডেট হয়েছে।';
  if(tool.startsWith('list_')||tool==='search_transactions')return 'তথ্য পাওয়া গেছে।';
  return 'কাজটি সফলভাবে সম্পন্ন হয়েছে।';
}

export default function VoiceControl(){
  const[state,setState]=useState<State>('Idle');
  const[text,setText]=useState('');
  const[error,setError]=useState('');
  const[result,setResult]=useState<any>(null);
  const[pending,setPending]=useState<Pending|null>(null);
  const latest=useRef('');
  const recognition=useRef<any>(null);

  const speak=(s:string)=>{if(typeof window!=='undefined'&&'speechSynthesis'in window){const u=new SpeechSynthesisUtterance(s);u.lang='bn-BD';u.rate=.95;window.speechSynthesis.cancel();window.speechSynthesis.speak(u)}};

  const call=async(t:string,confirmed=false,p?:Pending)=>{
    setState('Processing');setError('');
    try{
      const r=await fetch('/api/voice-v2',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({transcript:t,confirmed,tool:p?.tool,args:p?.args})});
      const d=await r.json().catch(()=>({error:'Invalid server response'}));
      if(!r.ok||!d.ok){
        if(d.confirmationRequired){setPending({tool:d.tool,args:d.args,message:d.error});return;}
        if(d.code==='AMBIGUOUS_ENTITY'){setPending({tool:d.tool,args:d.details?.matches?.[0]?{...d.args}:d.args,message:d.error,matches:d.details?.matches||[]});return;}
        throw new Error(d.error||'Voice command failed');
      }
      setPending(null);setResult(d);setState('Success');window.dispatchEvent(new Event('talikhata:refresh'));const spoken=resultMessage(d.tool,d.result);speak(spoken);setTimeout(()=>setState('Idle'),1800);
    }catch(e:any){setState('Error');setError(e.message||'Voice command failed')}
  };

  const process=(t:string)=>{if(t.trim())call(t.trim())};
  const start=()=>{
    setError('');setText('');latest.current='';
    if(!('SpeechRecognition'in window||'webkitSpeechRecognition'in window)){setError('Voice recognition নেই। নিচের text box ব্যবহার করুন।');setState('Error');return;}
    const C=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;const r=new C();recognition.current=r;r.lang='bn-BD';r.interimResults=true;r.continuous=false;r.onstart=()=>setState('Listening');r.onresult=(e:any)=>{let out='';for(let i=0;i<e.results.length;i++)out+=e.results[i][0].transcript;latest.current=out;setText(out)};r.onerror=()=>{setState('Error');setError('Voice input নেওয়া যায়নি। Text command চেষ্টা করুন।')};r.onend=()=>{if(latest.current.trim())process(latest.current)};r.start();
  };
  const submit=(e:React.FormEvent)=>{e.preventDefault();process(text)};
  const confirm=()=>{if(pending)call(text||latest.current,true,pending)};
  const choose=(m:any)=>{if(!pending)return;call(text||latest.current,false,{...pending,args:{...pending.args,name:m.name}});setPending(null)};

  return <>
    {result?.tool&&(result.tool==='get_balance'||result.tool==='get_party')&&<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="fixed bottom-44 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border bg-white p-5 shadow-2xl">
      <div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">বর্তমান হিসাব</p><h3 className="text-lg font-bold">{result.result?.party?.name}</h3></div><button onClick={()=>setResult(null)}><X size={18}/></button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">আপনি পাবেন</p><p className="text-3xl font-bold">৳ {Number(result.result?.receivable||0).toLocaleString('bn-BD')}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">আপনাকে দিতে হবে</p><p className="text-3xl font-bold">৳ {Number(result.result?.payable||0).toLocaleString('bn-BD')}</p></div></div>
    </motion.div>}
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {text&&<div className="w-72 rounded-xl border bg-white p-4 shadow-lg"><div className="flex justify-between text-xs text-slate-500"><span>Live transcript</span><button onClick={()=>setText('')}><X size={15}/></button></div><p className="mt-2 text-sm">{text}</p></div>}
      <button onClick={start} disabled={state==='Listening'||state==='Processing'} className={'flex h-16 w-16 items-center justify-center rounded-full text-white shadow-2xl '+(state==='Error'?'bg-red-600':state==='Success'?'bg-emerald-500':'bg-emerald-600')} aria-label="Voice command">{state==='Listening'?<Mic/>:state==='Processing'?<Loader2 className="animate-spin"/>:state==='Success'?<Check/>:state==='Error'?<AlertCircle/>:<Mic/>}</button>
      <span className="rounded-full bg-white px-3 py-1 text-xs shadow">{state}</span>{error&&<div className="max-w-xs rounded-xl border border-red-100 bg-white p-3 text-xs text-red-600 shadow">{error}</div>}
    </div>
    <div className="fixed bottom-24 left-4 right-4 z-40 md:bottom-5 md:left-1/2 md:right-auto md:w-[min(520px,calc(100%-140px))] md:-translate-x-1/2"><form onSubmit={submit} className="flex gap-2 rounded-xl border bg-white p-2 shadow-lg"><input value={text} onChange={e=>setText(e.target.value)} aria-label="Voice command text fallback" placeholder="যেমন: করিমের কাছে কত টাকা পাব?" className="min-w-0 flex-1 border-0 px-3 outline-none"/><button className="rounded-xl bg-slate-900 p-3 text-white"><Send size={17}/></button></form></div>
    <AnimatePresence>{pending&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4"><motion.div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="text-xl font-bold">নিশ্চিত করুন</h2><button onClick={()=>setPending(null)}><X/></button></div><p className="mt-2 text-sm text-slate-500">{pending.message}</p>{pending.matches?.length&&<div className="mt-4 space-y-2">{pending.matches.map((m:any)=><button key={m.id} onClick={()=>choose(m)} className="flex w-full items-center justify-between rounded-xl border p-4 text-left"><span><b>{m.name}</b><small className="block text-slate-500">{m.phone||''}</small></span><ChevronRight size={18}/></button>)}</div>}<div className="mt-5 flex gap-3"><button onClick={()=>setPending(null)} className="flex-1 rounded-xl border p-3">Cancel</button><button onClick={confirm} className="flex-1 rounded-xl bg-slate-900 p-3 text-white">Confirm</button></div></motion.div></motion.div>}</AnimatePresence>
  </>;
}