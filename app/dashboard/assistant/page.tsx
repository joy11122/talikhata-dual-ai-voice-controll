'use client';

import {useRef, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {Mic, Send, Loader2, X, Sparkles} from 'lucide-react';
import AssistantReceipt,{ReceiptData} from '@/components/AssistantReceipt';
import AssistantAnswer from '@/components/AssistantAnswer';

export default function Page(){
  const [q,setQ]=useState(''),[a,setA]=useState(''),[receipt,setReceipt]=useState<ReceiptData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[listening,setListening]=useState(false);
  const recognition=useRef<any>(null);

  async function ask(e?:React.FormEvent){
    e?.preventDefault();
    if(!q.trim()||busy)return;
    setBusy(true);setError('');setReceipt(null);
    try{
      const r=await fetch('/api/assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:q})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Assistant request failed');
      setA(d.answer||'No answer');
      setReceipt(d.mode==='sales_receipt'&&d.receipt?d.receipt:null);
    }catch(e){setError(e instanceof Error?e.message:'Assistant unavailable')}
    finally{setBusy(false)}
  }

  function startVoice(){
    setError('');
    if(!('SpeechRecognition' in window||'webkitSpeechRecognition' in window)){
      setError('Voice input is not supported in this browser. You can type your question.');
      return;
    }
    const C=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    const r=new C();
    recognition.current=r;r.lang='bn-BD';r.continuous=false;r.interimResults=true;
    r.onstart=()=>setListening(true);
    r.onresult=(e:any)=>{
      let value='';
      for(let i=0;i<e.results.length;i++)value+=e.results[i][0].transcript;
      setQ(value);
    };
    r.onerror=()=>{setListening(false);setError('Voice input could not be captured. Please try again.')};
    r.onend=()=>{setListening(false)};
    r.start();
  }

  return <div className="mx-auto max-w-3xl px-4 md:px-0">
    <motion.div
      initial={{opacity:0,y:12}}
      animate={{opacity:1,y:0}}
      transition={{duration:0.45,ease:'easeOut'}}
    >
      <h1 className="text-3xl font-bold">Smart Shop Assistant</h1>
      <p className="mt-2 text-white/50">Ask about sales, profit, receivables, payables or stock.</p>
    </motion.div>

    <motion.form
      onSubmit={ask}
      className="mt-6"
      initial={{opacity:0,y:10}}
      animate={{opacity:1,y:0}}
      transition={{duration:0.4,delay:0.08}}
    >
      <label className="form-label">Your question</label>
      <div className="mt-2 flex items-center gap-2 tk-page-surface rounded-2xl p-2 shadow-sm focus-within:border-white/15 focus-within:ring-2 focus-within:ring-[#7692FF]/20">
        <input className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 outline-none" value={q} onChange={e=>setQ(e.target.value)} placeholder="আজকের বিক্রি কেমন?" aria-label="Your question" required/>
        <button type="button" onClick={startVoice} disabled={listening||busy} aria-label="Speak your question" title="Speak your question" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${listening?'bg-emerald-600 text-white':'bg-transparent text-[#ABD2FA] border border-white/10 hover:bg-white/[0.06]'} disabled:opacity-50`}>
          {listening?<Mic className="animate-pulse"/>:<Mic/>}
        </button>
        <button type="submit" disabled={busy||!q.trim()} aria-label="Send question" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1B2CC1]/70 text-white transition hover:bg-[#1B2CC1] border border-white/10 disabled:opacity-40">
          {busy?<Loader2 className="animate-spin"/>:<Send size={18}/>}
        </button>
      </div>
    </motion.form>

    <AnimatePresence mode="wait">
      {busy&&(
        <motion.div
          key="thinking"
          initial={{opacity:0,y:8,scale:0.98}}
          animate={{opacity:1,y:0,scale:1}}
          exit={{opacity:0,y:-5,scale:0.98}}
          transition={{duration:0.25}}
          className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#091540]/60 backdrop-blur-[18px] px-5 py-4 text-sm text-white/70"
          aria-live="polite"
        >
          <motion.div
            animate={{rotate:360}}
            transition={{duration:1.4,repeat:Infinity,ease:'linear'}}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-emerald-400 shadow-sm"
          >
            <Sparkles size={16}/>
          </motion.div>
          <span>Assistant is thinking</span>
          <span className="flex gap-1" aria-hidden="true">
            {[0,1,2].map(i=>(
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                animate={{y:[0,-4,0],opacity:[0.35,1,0.35]}}
                transition={{duration:0.8,repeat:Infinity,delay:i*0.14}}
              />
            ))}
          </span>
        </motion.div>
      )}

      {error&&(
        <motion.div
          key="error"
          initial={{opacity:0,y:8}}
          animate={{opacity:1,y:0}}
          exit={{opacity:0,y:-5}}
          className="mt-4 flex items-center justify-between rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200"
        >
          <span>{error}</span>
          <button onClick={()=>setError('')} aria-label="Close error"><X size={16}/></button>
        </motion.div>
      )}

      {a&&!busy&&(receipt?<AssistantReceipt key={a} receipt={receipt}/>:<AssistantAnswer key={a} answer={a}/>)}
    </AnimatePresence>
  </div>
}
