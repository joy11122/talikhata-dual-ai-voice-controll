import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import Transaction from '@/models/Transaction';
import Party from '@/models/Party';
import Product from '@/models/Product';
import {Types} from 'mongoose';
import {createAIClient,getAIProviders,getModel,shouldFallback} from '@/lib/ai/provider';
import {detectAssistantIntent,getAssistantRange,money,normalizeBangla} from '@/services/assistantQuery';

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
  const now=new Date();
  const q=normalizeBangla(question);
  const intent=detectAssistantIntent(question);
  const range=getAssistantRange(question,now);
  const [assistantParties,assistantProducts,assistantTransactions]=await Promise.all([
    Party.find({userId:uid,isDeleted:false}).lean(),
    Product.find({userId:uid,isDeleted:false}).lean(),
    Transaction.find({userId:uid,isDeleted:false,timestamp:{$gte:range.start,$lte:range.end}}).sort({timestamp:-1}).lean(),
  ]);
  const supplierWord=/(supplier|সাপ্লায়ার|সাপ্লায়ার|সরবরাহকারী)/i.test(q);
  const customerWord=/(customer|কাস্টমার|গ্রাহক)/i.test(q);
  const partyMatches=assistantParties.filter(p=>(!supplierWord&&!customerWord)||p.partyType===(supplierWord?'SUPPLIER':'CUSTOMER')).filter(p=>q.includes(normalizeBangla(p.name)));
  if(partyMatches.length>1)return NextResponse.json({mode:'normal',answer:partyMatches.map(p=>p.name).join(' ও ')+' নামে একাধিক party আছে। Customer নাকি Supplier নির্দিষ্ট করে বলুন।'});
  const party=partyMatches[0];
  const productMatches=assistantProducts.filter(p=>q.includes(normalizeBangla(p.name))||(p.sku&&q.includes(normalizeBangla(p.sku)))||(p.barcode&&q.includes(normalizeBangla(p.barcode))));
  if(productMatches.length>1)return NextResponse.json({mode:'normal',answer:productMatches.map(p=>p.name).join(' ও ')+' নামে একাধিক product আছে। নির্দিষ্ট product-এর নাম বলুন।'});
  const product=productMatches[0];
  const tx=assistantTransactions.filter(x=>!party||String(x.partyId)===String(party._id)).filter(x=>!product||String(x.productId)===String(product._id));
  const total=(type:string,rows=tx)=>rows.filter(x=>x.type===type).reduce((a,x)=>a+Number(x.amount||0),0);

  if(intent==='CUSTOMERS'){
    const rows=assistantParties.filter(p=>p.partyType==='CUSTOMER');
    return NextResponse.json({mode:'normal',answer:'মোট '+rows.length+' জন Customer।\n'+rows.slice(0,50).map(p=>'- '+p.name+(p.phone?' — '+p.phone:'')+' — '+money(p.currentBalance)).join('\n')});
  }
  if(intent==='SUPPLIERS'){
    const rows=assistantParties.filter(p=>p.partyType==='SUPPLIER');
    return NextResponse.json({mode:'normal',answer:'মোট '+rows.length+' জন Supplier।\n'+rows.slice(0,50).map(p=>'- '+p.name+(p.phone?' — '+p.phone:'')+' — '+money(Math.abs(p.currentBalance||0))).join('\n')});
  }
  if(intent==='STOCK'){
    if(product)return NextResponse.json({mode:'normal',answer:product.name+': '+product.stockQuantity+' '+product.unit+' stock আছে। Buy '+money(product.buyPrice)+', sell '+money(product.sellPrice)+'।'});
    const low=assistantProducts.filter(p=>Number(p.stockQuantity)<=Number(p.lowStockThreshold));
    return NextResponse.json({mode:'normal',answer:'মোট '+assistantProducts.length+'টি product। Low stock '+low.length+'টি।'+(low.length?'\n'+low.slice(0,15).map(p=>p.name+' ('+p.stockQuantity+' '+p.unit+')').join(', '):'')});
  }
  if(intent==='BALANCE'){
    if(party){
      const b=Number(party.currentBalance||0);
      const label=party.partyType==='CUSTOMER'?(b>0?'পাওনা '+money(b):'পাওনা নেই'):(b<0?'দেনা '+money(Math.abs(b)):'দেনা নেই');
      return NextResponse.json({mode:'normal',answer:party.name+' ('+party.partyType+'): '+label+'।'});
    }
    const rec=assistantParties.filter(p=>p.partyType==='CUSTOMER'&&p.currentBalance>0).reduce((a,p)=>a+p.currentBalance,0);
    const pay=assistantParties.filter(p=>p.partyType==='SUPPLIER'&&p.currentBalance<0).reduce((a,p)=>a+Math.abs(p.currentBalance),0);
    return NextResponse.json({mode:'normal',answer:'মোট পাওনা '+money(rec)+'। মোট দেনা '+money(pay)+'।'});
  }
  if(intent==='SALES'){
    const rows=tx.filter(x=>x.type==='SALE'); return NextResponse.json({mode:'normal',answer:range.label+'-এর '+(party?party.name+'-এর ':product?product.name+'-এর ':'')+'বিক্রি '+money(total('SALE'))+'। '+rows.length+'টি sale হয়েছে।'});
  }
  if(intent==='PURCHASE'){
    const rows=tx.filter(x=>x.type==='STOCK_IN'); return NextResponse.json({mode:'normal',answer:range.label+'-এর '+(party?party.name+'-এর ':product?product.name+'-এর ':'')+'purchase '+money(total('STOCK_IN'))+'। '+rows.length+'টি purchase হয়েছে।'});
  }
  if(intent==='EXPENSE')return NextResponse.json({mode:'normal',answer:range.label+'-এর মোট খরচ '+money(total('EXPENSE'))+'।'});
  if(intent==='INCOME')return NextResponse.json({mode:'normal',answer:range.label+'-এর অন্যান্য আয় '+money(total('OTHER_INCOME'))+'।'});
  if(intent==='PROFIT'){
    const sales=total('SALE'),cogs=tx.filter(x=>x.type==='SALE').reduce((a,x)=>a+Number(x.costAmount||0),0),expense=total('EXPENSE');
    return NextResponse.json({mode:'normal',answer:range.label+'-এর হিসাব:\nSales '+money(sales)+'\nCOGS '+money(cogs)+'\nGross profit '+money(sales-cogs)+'\nExpense '+money(expense)+'\nNet profit '+money(sales-cogs-expense)});
  }
  if(intent==='TOP_SALES'){
    const map=new Map<string,number>();tx.filter(x=>x.type==='SALE').forEach(x=>map.set(String(x.productId),Number(map.get(String(x.productId))||0)+Number(x.amount||0)));
    const top=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v])=>(assistantProducts.find(p=>String(p._id)===id)?.name||'অজানা')+': '+money(v));
    return NextResponse.json({mode:'normal',answer:range.label+'-এর top sales:\n'+(top.map(x=>'- '+x).join('\n')||'কোনো sale নেই')});
  }
  if(intent==='TRANSACTIONS'){
    const n=Math.min(Number(q.match(/(?:শেষ|last|recent)\s*(\d+)/)?.[1]||10),50);
    const pm=new Map(assistantParties.map(p=>[String(p._id),p.name])),xm=new Map(assistantProducts.map(p=>[String(p._id),p.name]));
    const lines=tx.slice(0,n).map(x=>new Date(x.timestamp).toLocaleDateString('bn-BD')+' — '+x.type+' — '+(xm.get(String(x.productId))||'')+' — '+(pm.get(String(x.partyId))||'নগদ')+' — '+money(x.amount));
    return NextResponse.json({mode:'normal',answer:range.label+'-এর '+lines.length+'টি transaction:\n'+(lines.join('\n')||'কোনো transaction নেই')});
  }
  if(intent==='SUMMARY'){
    const sales=total('SALE'),purchase=total('STOCK_IN'),expense=total('EXPENSE'),cogs=tx.filter(x=>x.type==='SALE').reduce((a,x)=>a+Number(x.costAmount||0),0);
    return NextResponse.json({mode:'normal',answer:range.label+' business summary:\nSales '+money(sales)+'\nPurchase '+money(purchase)+'\nExpense '+money(expense)+'\nGross profit '+money(sales-cogs)+'\nNet profit '+money(sales-cogs-expense)});
  }

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