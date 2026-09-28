'use client';
import {useRef, useState} from 'react';
import {Mic, Send, Loader2, X} from 'lucide-react';

export default function Page(){
  const [q,setQ]=useState(''),[a,setA]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[listening,setListening]=useState(false);
  const recognition=useRef<any>(null);

  async function ask(e?:React.FormEvent){
    e?.preventDefault();
    if(!q.trim()||busy)return;
    setBusy(true);setError('');
    try{
      const r=await fetch('/api/assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:q})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Assistant request failed');
      setA(d.answer||'No answer');
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

  return <div className="mx-auto max-w-3xl">
    <h1 className="text-3xl font-bold">Smart Shop Assistant</h1>
    <p className="mt-2 text-slate-500">Ask about sales, profit, receivables, payables or stock.</p>
    <form onSubmit={ask} className="mt-6">
      <label className="form-label">Your question</label>
      <div className="mt-2 flex items-center gap-2 rounded-2xl border bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20">
        <input className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 outline-none" value={q} onChange={e=>setQ(e.target.value)} placeholder="আজকের বিক্রি কেমন?" aria-label="Your question" required/>
        <button type="button" onClick={startVoice} disabled={listening||busy} aria-label="Speak your question" title="Speak your question" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${listening?'bg-emerald-600 text-white':'bg-slate-100 text-emerald-700 hover:bg-emerald-50'} disabled:opacity-50`}>
          {listening?<Mic className="animate-pulse"/>:<Mic/>}
        </button>
        <button type="submit" disabled={busy||!q.trim()} aria-label="Send question" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-40">
          {busy?<Loader2 className="animate-spin"/>:<Send size={18}/>}
        </button>
      </div>
    </form>
    {error&&<div className="mt-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button onClick={()=>setError('')} aria-label="Close error"><X size={16}/></button></div>}
    {a&&<div className="mt-5 rounded-2xl border bg-white p-5 text-lg">{a}</div>}
  </div>
}