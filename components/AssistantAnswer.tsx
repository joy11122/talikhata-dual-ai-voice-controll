'use client';

import {motion} from 'framer-motion';

export default function AssistantAnswer({answer}:{answer:string}){
  const lines=answer.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  return <motion.section initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:.4,ease:[.22,1,.36,1]}} className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-live="polite" aria-label="Assistant answer">
    <div className="mb-4 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500"/><span className="text-sm font-bold text-slate-900">Assistant</span></div>
    <div className="space-y-3 text-[15px] leading-7 text-slate-700 sm:text-base">
      {lines.map((line,i)=>{
        const bullet=/^[-•*]\s+/.test(line);
        const text=bullet?line.replace(/^[-•*]\s+/,''):line;
        return <motion.div key={i} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{delay:Math.min(i*.05,.35)}} className={bullet?'flex gap-3':''}>
          {bullet&&<span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"/>}
          <span>{text}</span>
        </motion.div>;
      })}
    </div>
  </motion.section>;
}
