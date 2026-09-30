'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import JsBarcode from 'jsbarcode';
import {Download,Loader2} from 'lucide-react';
import {motion} from 'framer-motion';

export type ReceiptItem={description:string;quantity:number;unit:string;unitPrice:number;price:number;partyName?:string;timestamp:string};
export type ReceiptData={periodLabel:string;total:number;items:ReceiptItem[];generatedAt:string};

type AssistantReceiptProps={receipt:ReceiptData};

type ShopInfo={shopName?:string;address?:string;currency?:string;managerName?:string;_id?:string};

const diamonds='◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇';

function money(value:number,currency='BDT / ৳'){
  const symbol=currency.includes('৳')?'৳':currency.includes('$')?'$':'৳';
  return `${symbol}${value.toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

function esc(value:string){
  return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]||c));
}

export default function AssistantReceipt({receipt}:AssistantReceiptProps){
  const [shop,setShop]=useState<ShopInfo>({});
  const [downloading,setDownloading]=useState(false);
  const barcodeRef=useRef<SVGSVGElement>(null);

  useEffect(()=>{
    let active=true;
    fetch('/api/shop').then(r=>r.ok?r.json():null).then(data=>{if(active&&data)setShop(data)}).catch(()=>{});
    return()=>{active=false};
  },[]);

  const barcodeValue=shop._id?shop._id.replace(/\D/g,'').slice(-18).padStart(18,'0'):'123456778963578021';

  useEffect(()=>{
    if(!barcodeRef.current)return;
    JsBarcode(barcodeRef.current,barcodeValue,{format:'CODE128',width:1.45,height:58,displayValue:false,margin:0,background:'#fff',lineColor:'#111'});
  },[barcodeValue]);

  const date=useMemo(()=>new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(receipt.generatedAt)),[receipt.generatedAt]);

  async function downloadReceipt(){
    setDownloading(true);
    try{
      const rows=receipt.items.length
        ? receipt.items.map(item=>`<tr><td>${esc(item.description)} × ${item.quantity}</td><td>${money(item.price,shop.currency)}</td></tr>`).join('')
        : '<tr><td>No sales found</td><td>—</td></tr>';
      const barcode=barcodeRef.current?.outerHTML||'';
      const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(shop.shopName||'TaliKhata')} Receipt</title>
      <style>
      @page{size:80mm auto;margin:8mm}*{box-sizing:border-box}body{margin:0;background:#f5f5f4;color:#111;font-family:Arial,sans-serif}.receipt{width:72mm;margin:20px auto;padding:18px 14px;background:#fffefb;box-shadow:0 4px 18px #0001}.band{text-align:center;font:10px monospace;letter-spacing:2px;white-space:nowrap;overflow:hidden}.title{text-align:center;font:bold 32px Georgia,serif;letter-spacing:2px;margin:12px 0}.shop{text-align:center;font:bold 18px Arial,sans-serif;margin:18px 0}.meta{font:11px monospace;line-height:1.8}.meta div,.tot{display:flex;justify-content:space-between;gap:12px}.line{border-top:1px dashed #777;margin:16px 0}table{width:100%;border-collapse:collapse;font:11px monospace}th{text-align:left;font-weight:bold;padding-bottom:7px}th:last-child,td:last-child{text-align:right}td{padding:4px 0;vertical-align:top}.total{font:bold 21px Arial,sans-serif}.thanks{text-align:center;font:bold 18px Georgia,serif;margin:42px 0 12px}.barcode{text-align:center}.barcode svg{width:100%;height:58px}.code{text-align:center;font:10px monospace;letter-spacing:1px;margin-top:6px}@media print{body{background:#fff}.receipt{margin:0;box-shadow:none}}
      </style></head><body><main class="receipt">
      <div class="band">${diamonds}</div><div class="title">RECEIPT</div><div class="band">${diamonds}</div>
      <div class="shop">${esc(shop.shopName||'YOUR SHOP')}</div>
      <div class="meta"><div><b>Address:</b><span>${esc(shop.address||'—')}</span></div><div><b>Date:</b><span>${date}</span></div><div><b>Period:</b><span>${esc(receipt.periodLabel)}</span></div><div><b>Manager:</b><span>${esc(shop.managerName||'—')}</span></div></div>
      <div class="line"></div><table><thead><tr><th>Description</th><th>Price</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="line"></div><div class="tot"><span>Tax</span><span>—</span></div><div class="tot total"><span>TOTAL</span><span>${money(receipt.total,shop.currency)}</span></div>
      <div class="thanks">THANK YOU<div class="band" style="margin-top:10px">${diamonds}</div></div>
      <div class="barcode">${barcode}<div class="code">${barcodeValue}</div></div></main></body></html>`;
      const blob=new Blob([html],{type:'text/html;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`talikhata-receipt-${Date.now()}.html`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    }finally{setDownloading(false)}
  }

  return <motion.section initial={{opacity:0,y:20,scale:.985}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.45,ease:[.22,1,.36,1]}} className="relative mx-auto mt-5 w-full max-w-xl overflow-hidden rounded-sm border border-slate-200 bg-[#fffefb] shadow-[0_14px_35px_rgba(15,23,42,0.10)]" aria-live="polite" aria-label="Assistant sales receipt">
    <div className="absolute inset-x-0 top-0 h-1 bg-slate-900/90"/>
    <div className="px-5 pb-5 pt-6 sm:px-8">
      <div className="text-center font-mono text-[10px] leading-none tracking-[.18em] text-slate-900 sm:text-xs">{diamonds}</div>
      <motion.h2 initial={{opacity:0,letterSpacing:'.18em'}} animate={{opacity:1,letterSpacing:'.06em'}} transition={{duration:.5,delay:.08}} className="mt-3 text-center font-serif text-4xl font-black text-slate-950 sm:text-5xl">RECEIPT</motion.h2>
      <div className="mt-3 text-center font-mono text-[10px] leading-none tracking-[.18em] text-slate-900 sm:text-xs">{diamonds}</div>
      <div className="mt-5 text-center font-sans text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">{shop.shopName||'YOUR SHOP'}</div>

      <div className="mt-5 space-y-1.5 font-mono text-xs leading-5 text-slate-700 sm:text-sm">
        <div className="flex justify-between gap-4"><span className="font-bold">Address:</span><span className="text-right">{shop.address||'—'}</span></div>
        <div className="flex justify-between gap-4"><span className="font-bold">Date:</span><span className="text-right">{date}</span></div>
        <div className="flex justify-between gap-4"><span className="font-bold">Period:</span><span className="text-right">{receipt.periodLabel}</span></div>
        <div className="flex justify-between gap-4"><span className="font-bold">Manager:</span><span className="text-right">{shop.managerName||'—'}</span></div>
      </div>

      <div className="my-5 border-t border-dashed border-slate-400"/>
      <div className="flex justify-between gap-5 font-mono text-xs font-bold uppercase tracking-wide text-slate-700 sm:text-sm"><span>Description</span><span>Price</span></div>
      <div className="mt-3 space-y-2 font-mono text-sm text-slate-900 sm:text-[15px]">
        {receipt.items.length?receipt.items.map((item,index)=><motion.div key={`${item.timestamp}-${index}`} initial={{opacity:0,x:-5}} animate={{opacity:1,x:0}} transition={{duration:.25,delay:Math.min(index*.05,.5)}} className="flex items-start justify-between gap-5"><span className="min-w-0 break-words">{item.description} × {item.quantity}</span><span className="shrink-0 text-right">{money(item.price,shop.currency)}</span></motion.div>):<div className="py-3 text-center text-slate-500">No sales found</div>}
      </div>

      <div className="my-5 border-t border-dashed border-slate-400"/>
      <div className="flex justify-between font-mono text-sm text-slate-700"><span>Tax</span><span>—</span></div>
      <div className="mt-2 flex items-end justify-between gap-5 font-sans"><span className="text-2xl font-black tracking-tight text-slate-950">TOTAL</span><span className="text-2xl font-black tracking-tight text-slate-950">{money(receipt.total,shop.currency)}</span></div>

      <div className="pb-7 pt-12 text-center"><div className="font-serif text-xl font-black tracking-wide text-slate-950">THANK YOU</div><div className="mt-3 font-mono text-[10px] leading-none tracking-[.18em] text-slate-900 sm:text-xs">{diamonds}</div></div>
      <div className="flex justify-center"><svg ref={barcodeRef} role="img" aria-label="Code 128 receipt barcode" className="h-[58px] w-full max-w-[300px]"/></div>
      <div className="mt-2 text-center font-mono text-xs tracking-[.12em] text-slate-900">{barcodeValue}</div>

      <motion.button type="button" onClick={downloadReceipt} disabled={downloading} whileTap={{scale:.97}} className="mx-auto mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60" aria-label="Download receipt" title="Download receipt">
        {downloading?<Loader2 size={17} className="animate-spin"/>:<Download size={17}/>} {downloading?'Preparing receipt…':'Download receipt'}
      </motion.button>
    </div>
    <div className="h-3 w-full" style={{backgroundImage:'radial-gradient(circle at 7px -1px, transparent 6px, #e2e8f0 6.5px, #e2e8f0 7px, transparent 7.5px)',backgroundSize:'14px 14px'}}/>
  </motion.section>;
}
