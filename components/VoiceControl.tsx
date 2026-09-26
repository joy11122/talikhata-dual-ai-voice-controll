'use client';
import {useEffect,useRef,useState} from 'react';
import {Mic,Loader2,Check,AlertCircle,X,Send,ChevronRight} from 'lucide-react';
import {AnimatePresence,motion} from 'framer-motion';

type State='Idle'|'Listening'|'Processing'|'Success'|'Error';
type Pending={command:any;message:string;matches?:any[]};

function message(c:any,result:any){
 if(c.action==='CREATE_PARTY')return result.name+' নামে '+(result.partyType==='SUPPLIER'?'সাপ্লায়ার':'কাস্টমার')+' যোগ করা হয়েছে।';
 if(c.action==='CREATE_PRODUCT')return result.name+' পণ্যটি যোগ করা হয়েছে।';
 if(c.action==='READ_BALANCE'){const n=result?.party?.name||'গ্রাহক',r=Number(result?.receivable||0),p=Number(result?.payable||0);if(r>0)return n+' এর কাছে আপনার '+r.toLocaleString('bn-BD')+' টাকা পাওনা আছে।';if(p>0)return n+' আপনাকে '+p.toLocaleString('bn-BD')+' টাকা পাবে।';return n+' এর সাথে কোনো বাকি নেই।';}
 if(c.action==='CREATE_DUE')return 'বাকির হিসাব যোগ করা হয়েছে।';
 if(c.action==='RECEIVE_PAYMENT')return 'জমার হিসাব সংরক্ষণ করা হয়েছে।';
 if(c.action==='CREATE_SALE')return 'বিক্রির হিসাব সংরক্ষণ করা হয়েছে।';
 if(c.action==='CREATE_PURCHASE')return 'কেনার হিসাব সংরক্ষণ করা হয়েছে।';
 if(c.action==='CREATE_EXPENSE')return (result?.amount||c.amount)+' টাকার খরচ সংরক্ষণ করা হয়েছে।';
 if(c.action==='STOCK_IN'||c.action==='STOCK_OUT')return 'স্টকের হিসাব আপডেট হয়েছে।';
 if(c.action.startsWith('DELETE_'))return 'মুছে ফেলার কাজটি সফল হয়েছে।';
 if(c.action.startsWith('UPDATE_'))return 'তথ্য সফলভাবে আপডেট হয়েছে।';
 if(c.action.startsWith('LIST_')||c.action.startsWith('READ_'))return 'তথ্য পাওয়া গেছে।';
 return 'কাজটি সফলভাবে সম্পন্ন হয়েছে।';
}

export default function VoiceControl(){
 const[state,setState]=useState<State>('Idle');const[text,setText]=useState('');const[error,setError]=useState('');const[result,setResult]=useState<any>(null);const[pending,setPending]=useState<Pending|null>(null);const latest=useRef('');const recognition=useRef<any>(null);
 useEffect(()=>{const onCommand=(event:Event)=>{const value=(event as CustomEvent<string>).detail;if(typeof value==='string'&&value.trim())setText(value)};window.addEventListener('talikhata:command',onCommand);return()=>window.removeEventListener('talikhata:command',onCommand)},[]);
 const speak=(s:string)=>{if(typeof window!=='undefined'&&'speechSynthesis'in window){const u=new SpeechSynthesisUtterance(s);u.lang='bn-BD';u.rate=.95;window.speechSynthesis.cancel();window.speechSynthesis.speak(u)}};
 const process=async(t:string,command?:any,confirmed=false)=>{if(!t.trim()&&!command)return;setState('Processing');setError('');try{const r=await fetch('/api/voice-v2',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({transcript:t||text,confirmed,command})});const d=await r.json().catch(()=>({error:'Invalid server response'}));if(!r.ok||!d.ok){if(d.confirmationRequired){setPending({command:d.command||command,message:d.error||'এই কাজটি করার আগে confirmation প্রয়োজন।'});return;}if(d.code==='AMBIGUOUS_ENTITY'){setPending({command:d.command||command,message:d.error,matches:d.details?.matches||[]});return;}throw new Error(d.error||'Voice command failed');}setPending(null);setResult(d);setState('Success');const spoken=message(d.command,d.result);speak(spoken);window.dispatchEvent(new Event('talikhata:refresh'));setTimeout(()=>setState('Idle'),1800)}catch(e:any){setState('Error');setError(e.message||'Voice command failed')}};
 const start=()=>{setError('');setText('');latest.current='';if(!('SpeechRecognition'in window||'webkitSpeechRecognition'in window)){setError('Voice recognition নেই। নিচের text box ব্যবহার করুন।');setState('Error');return;}const C=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;const r=new C();recognition.current=r;r.lang='bn-BD';r.interimResults=true;r.continuous=false;r.onstart=()=>setState('Listening');r.onresult=(e:any)=>{let out='';for(let i=0;i<e.results.length;i++)out+=e.results[i][0].transcript;latest.current=out;setText(out)};r.onerror=()=>{setState('Error');setError('Voice input নেওয়া যায়নি। Text command চেষ্টা করুন।')};r.onend=()=>{if(latest.current.trim())process(latest.current.trim())};r.start()};
 const confirm=()=>pending&&process(text||latest.current,pending.command,true);
 const choose=(m:any)=>{if(!pending)return;const command={...pending.command,entityName:m.name};setPending(null);process(text||latest.current,command,false)};
 const submit=(e:React.FormEvent)=>{e.preventDefault();process(text)};
 return <>
 {result?.command?.action==='READ_BALANCE'&&<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="fixed bottom-44 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">বর্তমান হিসাব</p><h3 className="text-lg font-bold">{result.result?.party?.name}</h3></div><button onClick={()=>setResult(null)}><X size={18}/></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">আপনি পাবেন</p><p className="text-3xl font-bold">৳ {Number(result.result?.receivable||0).toLocaleString('bn-BD')}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">আপনাকে দিতে হবে</p><p className="text-3xl font-bold">৳ {Number(result.result?.payable||0).toLocaleString('bn-BD')}</p></div></div></motion.div>}
 <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-4">
   <div className="mx-auto w-full max-w-3xl">
     {text&&<div className="mb-2 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
       <div className="min-w-0 flex-1"><div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-500"><span>Live transcript</span><button type="button" onClick={()=>setText('')} className="rounded-md p-1 hover:bg-slate-100" aria-label="Clear transcript"><X size={14}/></button></div><p className="break-words text-slate-800">{text}</p></div>
     </div>}
     {error&&<div className="mb-2 rounded-2xl border border-red-100 bg-white px-4 py-3 text-xs text-red-600 shadow-lg">{error}</div>}
     <form onSubmit={submit} className="flex items-center gap-2 rounded-[28px] border border-slate-200 bg-white p-2 shadow-[0_8px_32px_rgba(15,23,42,0.12)] focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
       <input value={text} onChange={e=>setText(e.target.value)} aria-label="Voice command text fallback" placeholder="Message TaliKhata..." className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:text-base"/>
       <button type="button" onClick={start} disabled={state==='Listening'||state==='Processing'} className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 '+(state==='Error'?'bg-red-50 text-red-600':state==='Success'?'bg-emerald-50 text-emerald-600':'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700')} aria-label="Start voice command">
         {state==='Listening'?<motion.div animate={{scale:[1,1.18,1]}} transition={{repeat:Infinity,duration:.8}}><Mic size={19}/></motion.div>:state==='Processing'?<Loader2 size={19} className="animate-spin"/>:state==='Success'?<Check size={19}/>:state==='Error'?<AlertCircle size={19}/>:<Mic size={19}/>}
       </button>
       <button type="submit" disabled={state==='Processing'||!text.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send command">
         <Send size={18}/>
       </button>
     </form>
     <div className="mt-1.5 flex items-center justify-center gap-2 text-[10px] text-slate-400"><span className={'h-1.5 w-1.5 rounded-full '+(state==='Listening'?'bg-red-500':state==='Processing'?'bg-amber-500':state==='Success'?'bg-emerald-500':'bg-slate-300')}></span><span>{state==='Idle'?'Voice or text command':state}</span></div>
   </div>
 </div>
 <AnimatePresence>{pending&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4"><motion.div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="text-xl font-bold">নিশ্চিত করুন</h2><button onClick={()=>setPending(null)}><X/></button></div><p className="mt-2 text-sm text-slate-500">{pending.message}</p>{pending.matches?.length&&<div className="mt-4 space-y-2">{pending.matches.map((m:any)=><button key={m.id} onClick={()=>choose(m)} className="flex w-full items-center justify-between rounded-xl border p-4 text-left"><span><b>{m.name}</b><small className="block text-slate-500">{m.phone||''}</small></span><ChevronRight size={18}/></button>)}</div>}<div className="mt-5 flex gap-3"><button onClick={()=>setPending(null)} className="flex-1 rounded-xl border p-3">Cancel</button>{!pending.matches?.length&&<button onClick={confirm} className="flex-1 rounded-xl bg-slate-900 p-3 text-white">Confirm</button>}</div></motion.div></motion.div>}</AnimatePresence>
 </>;
}