import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import Transaction from '@/models/Transaction';
import Party from '@/models/Party';
import Product from '@/models/Product';
import {Types} from 'mongoose';
import {createAIClient,getAIProviders,getModel,shouldFallback} from '@/lib/ai/provider';

function isSaleQuestion(q:string){
  return /(^|\s)(sell|sales|sale|বিক্রি|বিক্রির|বিক্রি হয়েছে|বেচা)(\s|$)/i.test(q)
    || q.includes('আজকের বিক্রি')
    || q.includes('মোট বিক্রি')
    || q.includes('কি কি বিক্রি')
    || q.includes('কী কী বিক্রি');
}

function bangladeshDayStart(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const y=parts.find(p=>p.type==='year')?.value;
  const m=parts.find(p=>p.type==='month')?.value;
  const d=parts.find(p=>p.type==='day')?.value;
  return new Date(`${y}-${m}-${d}T00:00:00+06:00`);
}

function getSalesWindow(q:string,now=new Date()){
  const lower=q.toLowerCase();
  const todayStart=bangladeshDayStart(now);
  const minutesMatch=lower.match(/(?:last|গত|শেষ)\s*(\d+)\s*(?:min(?:ute)?s?|মিনিট)/i);
  if(minutesMatch)return {start:new Date(now.getTime()-Number(minutesMatch[1])*60_000),label:`গত ${minutesMatch[1]} মিনিট`};
  if(lower.includes('আজ')||lower.includes('today')||lower.includes('ajker')||lower.includes('ajke'))
    return {start:todayStart,label:'আজ'};
  if(lower.includes('৭ দিন')||lower.includes('7 দিন')||lower.includes('7 day')||lower.includes('7 days')||lower.includes('seven day')||lower.includes('গত ৭'))
    return {start:new Date(now.getTime()-7*86_400_000),label:'গত ৭ দিন'};
  if(lower.includes('গতকাল')||lower.includes('yesterday'))
    return {start:new Date(todayStart.getTime()-86_400_000),end:todayStart,label:'গতকাল'};
  return {start:new Date(0),label:'সকল সময়'};
}

export async function POST(req:Request){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await req.json().catch(()=>({}));
  const question=String(body.question||'').trim();
  if(!question)return NextResponse.json({error:'Question is required'},{status:400});
  await connectDB();

  const uid=new Types.ObjectId(s.user.id);
  const q=question.toLowerCase();

  if(isSaleQuestion(q)){
    const now=new Date();
    const window=getSalesWindow(q,now);
    const query:any={userId:uid,type:'SALE',isDeleted:false,timestamp:{$gte:window.start,$lte:window.end||now}};
    const tx=await Transaction.find(query).sort({timestamp:1}).lean();
    const [parties,products]=await Promise.all([
      Party.find({userId:uid}).select('_id name').lean(),
      Product.find({userId:uid}).select('_id name unit').lean(),
    ]);
    const productMap=new Map(products.map(p=>[String(p._id),p]));
    const partyMap=new Map(parties.map(p=>[String(p._id),p]));
    const items=tx.map((x:any)=>({
      description:productMap.get(String(x.productId))?.name||'Sale',
      quantity:x.quantity||1,
      unit:productMap.get(String(x.productId))?.unit||'unit',
      unitPrice:x.unitPrice||((x.quantity||0)>0?x.amount/(x.quantity||1):x.amount),
      price:x.amount||0,
      partyName:x.partyId?partyMap.get(String(x.partyId))?.name||'Unknown customer':'Walk-in customer',
      timestamp:x.timestamp,
    }));
    const total=items.reduce((sum,x)=>sum+x.price,0);
    return NextResponse.json({
      mode:'sales_receipt',
      answer:`${window.label}-এর বিক্রির হিসাব প্রস্তুত করা হয়েছে। মোট ${items.length}টি sale, মোট ৳${total.toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})}।`,
      receipt:{periodLabel:window.label,total,items,generatedAt:now.toISOString()},
    });
  }

  const tx=await Transaction.find({userId:uid,timestamp:{$gte:new Date(Date.now()-7*86_400_000)},isDeleted:false}).lean();
  const [parties,products]=await Promise.all([
    Party.find({userId:uid}).lean(),
    Product.find({userId:uid}).lean(),
  ]);
  let answer='আপনার প্রশ্নটি বুঝতে পারিনি। বিক্রি, লাভ, পাওনা, দেনা বা স্টক সম্পর্কে জিজ্ঞেস করুন।';
  if(q.includes('লাভ')||q.includes('profit')){
    const sales=tx.filter(x=>x.type==='SALE').reduce((a,x)=>a+x.amount,0),cogs=tx.filter(x=>x.type==='SALE').reduce((a,x)=>a+(x.costAmount||0),0),exp=tx.filter(x=>x.type==='EXPENSE').reduce((a,x)=>a+x.amount,0);
    answer=`গত ৭ দিনের আনুমানিক নিট লাভ ৳${(sales-cogs-exp).toLocaleString()}।`;
  }else if(q.includes('পাওনা')||q.includes('receivable'))
    answer=`আপনার মোট পাওনা ৳${parties.filter(x=>x.partyType==='CUSTOMER'&&x.currentBalance>0).reduce((a,x)=>a+x.currentBalance,0).toLocaleString()}।`;
  else if(q.includes('দেনা')||q.includes('payable'))
    answer=`আপনার মোট দেনা ৳${parties.filter(x=>x.partyType==='SUPPLIER'&&x.currentBalance<0).reduce((a,x)=>a+Math.abs(x.currentBalance),0).toLocaleString()}।`;
  else if(q.includes('স্টক')||q.includes('stock'))
    answer=`${products.filter(x=>x.stockQuantity<=x.lowStockThreshold).length}টি পণ্য low stock-এ আছে।`;
  else if(getAIProviders().length){
    for(const provider of getAIProviders()){
      try{
        const client=createAIClient(provider);
        const completion=await client.chat.completions.create({
          model:getModel(provider),temperature:.2,
          messages:[
            {role:'system',content:'You are TaliKhata shop assistant. Answer in Bengali when the user asks in Bengali. Use ONLY the supplied shop data; never invent financial facts. Give a concise, organized answer. Use short headings and bullet-like lines when useful. Do not format as a receipt; sales questions are handled separately.'},
            {role:'user',content:JSON.stringify({question,transactions:tx,parties,products})}
          ]
        });
        answer=completion.choices[0]?.message?.content||answer;break;
      }catch(e){if(!shouldFallback(e))break;}
    }
  }
  return NextResponse.json({mode:'normal',answer});
}