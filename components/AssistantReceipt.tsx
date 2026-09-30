'use client';

import {useEffect, useMemo, useRef} from 'react';
import JsBarcode from 'jsbarcode';
import {motion} from 'framer-motion';

type AssistantReceiptProps = {
  answer: string;
};

const diamonds = '◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇';

export default function AssistantReceipt({answer}: AssistantReceiptProps){
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(()=>{
    if(!barcodeRef.current)return;
    JsBarcode(barcodeRef.current,'123456778963578021',{
      format:'CODE128',
      width:1.45,
      height:58,
      displayValue:false,
      margin:0,
      background:'#fff',
      lineColor:'#111',
    });
  },[]);

  const rows = useMemo(()=>{
    const parts = answer
      .split(/\n+/)
      .map(v=>v.trim())
      .filter(Boolean);

    const source = parts.length ? parts : [answer.trim() || 'No answer'];
    return source.map(line=>{
      const match = line.match(/^(.*?)(?:\s+)?([৳$]\s?[\d,]+(?:\.\d{1,2})?)\.?$/);
      return {
        description: match?.[1]?.trim() || line,
        price: match?.[2] || '—',
      };
    });
  },[answer]);

  const total = useMemo(()=>{
    const amounts = rows
      .map(row=>row.price.replace(/[^\d.]/g,''))
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);

    if(amounts.length !== 1)return '—';
    return rows[0].price;
  },[rows]);

  const date = new Intl.DateTimeFormat('en-GB',{
    day:'2-digit',
    month:'2-digit',
    year:'numeric',
  }).format(new Date());

  return (
    <motion.section
      initial={{opacity:0,y:20,scale:.985}}
      animate={{opacity:1,y:0,scale:1}}
      transition={{duration:.45,ease:[.22,1,.36,1]}}
      className="relative mx-auto mt-5 w-full max-w-xl overflow-hidden rounded-sm border border-slate-200 bg-[#fffefb] shadow-[0_14px_35px_rgba(15,23,42,0.10)]"
      aria-live="polite"
      aria-label="Assistant receipt"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-slate-900/90" />

      <div className="px-5 pb-7 pt-6 sm:px-8">
        <div className="text-center font-mono text-[10px] leading-none tracking-[.18em] text-slate-900 sm:text-xs">
          {diamonds}
        </div>

        <motion.h2
          initial={{opacity:0,letterSpacing:'.18em'}}
          animate={{opacity:1,letterSpacing:'.06em'}}
          transition={{duration:.5,delay:.08}}
          className="mt-3 text-center font-serif text-4xl font-black text-slate-950 sm:text-5xl"
        >
          RECEIPT
        </motion.h2>

        <div className="mt-3 text-center font-mono text-[10px] leading-none tracking-[.18em] text-slate-900 sm:text-xs">
          {diamonds}
        </div>

        <div className="mt-5 text-center font-sans text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">
          PREMIUM GROCERY CO.
        </div>

        <div className="mt-5 space-y-1.5 font-mono text-xs leading-5 text-slate-700 sm:text-sm">
          <div className="flex justify-between gap-4">
            <span className="font-bold">Address:</span>
            <span className="text-right">123 Market St. 8/24</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="font-bold">Date:</span>
            <span className="text-right">{date}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="font-bold">Manager:</span>
            <span className="text-right">John Doe</span>
          </div>
        </div>

        <div className="my-5 border-t border-dashed border-slate-400" />

        <div className="flex justify-between gap-5 font-mono text-xs font-bold uppercase tracking-wide text-slate-700 sm:text-sm">
          <span>Description</span>
          <span>Price</span>
        </div>

        <div className="mt-3 space-y-2 font-mono text-sm text-slate-900 sm:text-[15px]">
          {rows.map((row,index)=>(
            <motion.div
              key={index}
              initial={{opacity:0,x:-5}}
              animate={{opacity:1,x:0}}
              transition={{duration:.25,delay:Math.min(index*.06,.45)}}
              className="flex items-start justify-between gap-5"
            >
              <span className="min-w-0 break-words">{row.description}</span>
              <span className="shrink-0 text-right">{row.price}</span>
            </motion.div>
          ))}
        </div>

        <div className="my-5 border-t border-dashed border-slate-400" />

        <div className="flex justify-between font-mono text-sm text-slate-700">
          <span>Tax</span>
          <span>—</span>
        </div>

        <div className="mt-2 flex items-end justify-between gap-5 font-sans">
          <span className="text-2xl font-black tracking-tight text-slate-950">TOTAL</span>
          <span className="text-2xl font-black tracking-tight text-slate-950">{total}</span>
        </div>

        <div className="pb-8 pt-12 text-center">
          <div className="font-serif text-xl font-black tracking-wide text-slate-950">THANK YOU</div>
          <div className="mt-3 font-mono text-[10px] leading-none tracking-[.18em] text-slate-900 sm:text-xs">
            {diamonds}
          </div>
        </div>

        <div className="flex justify-center">
          <svg
            ref={barcodeRef}
            role="img"
            aria-label="Code 128 barcode 123456778963578021"
            className="h-[58px] w-full max-w-[300px]"
          />
        </div>
        <div className="mt-2 text-center font-mono text-xs tracking-[.12em] text-slate-900">
          123456778963578021
        </div>
      </div>

      <div
        className="h-3 w-full"
        style={{
          backgroundImage:'radial-gradient(circle at 7px -1px, transparent 6px, #e2e8f0 6.5px, #e2e8f0 7px, transparent 7.5px)',
          backgroundSize:'14px 14px',
        }}
      />
    </motion.section>
  );
}
