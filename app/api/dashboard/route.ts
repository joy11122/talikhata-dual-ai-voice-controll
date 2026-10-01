import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import Party from '@/models/Party';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import {Types} from 'mongoose';

function dhakaDateParts(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
  return {year:get('year'),month:get('month'),day:get('day')};
}
function dhakaDayStart(daysAgo=0){
  const p=dhakaDateParts(new Date(Date.now()-daysAgo*86400000));
  return new Date(`${p.year}-${p.month}-${p.day}T00:00:00+06:00`);
}
function dhakaDayEnd(daysAgo=0){return new Date(dhakaDayStart(daysAgo).getTime()+86400000)}

export async function GET(){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  await connectDB();
  const uid=new Types.ObjectId(s.user.id);
  const todayStart=dhakaDayStart(0), todayEnd=dhakaDayEnd(0), sevenStart=dhakaDayStart(6);
  const [parties,products,lowStock,recent,balances,dueCustomers,todaySales,weekly]=await Promise.all([
    Party.countDocuments({userId:uid}),
    Product.countDocuments({userId:uid}),
    Product.countDocuments({userId:uid,$expr:{$lte:['$stockQuantity','$lowStockThreshold']}}),
    Transaction.find({userId:uid,isDeleted:false}).sort({timestamp:-1}).limit(5).populate('partyId','name').populate('productId','name').lean(),
    Party.aggregate([{$match:{userId:uid}},{$group:{_id:null,receivable:{$sum:{$cond:[{$gt:['$currentBalance',0]},'$currentBalance',0]}},payable:{$sum:{$cond:[{$lt:['$currentBalance',0]},{$abs:'$currentBalance'},0]}}}}]),
    Party.countDocuments({userId:uid,currentBalance:{$gt:0}}),
    Transaction.aggregate([{$match:{userId:uid,isDeleted:false,timestamp:{$gte:todayStart,$lt:todayEnd},type:{$in:['SALE']}}},{$group:{_id:null,total:{$sum:{$ifNull:['$amount',0]}},count:{$sum:1}}}]),
    Transaction.aggregate([{$match:{userId:uid,timestamp:{$gte:sevenStart,$lt:todayEnd},type:{$in:['SALE']}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$timestamp',timezone:'+06:00'}},total:{$sum:{$ifNull:['$amount',0]}}}},{$sort:{_id:1}}])
  ]);
  const weeklyMap=new Map(weekly.map((x:{_id:string,total:number})=>[x._id,Number(x.total||0)]));
  const chart=Array.from({length:7},(_,i)=>{
    const d=dhakaDayStart(6-i);
    const p=dhakaDateParts(d);
    return {label:i===6?'আজ':['৭ম','৬ষ্ঠ','৫ম','৪র্থ','৩য়','২য়'][i]||'',date:`${p.year}-${p.month}-${p.day}`,total:weeklyMap.get(`${p.year}-${p.month}-${p.day}`)||0};
  });
  return NextResponse.json({parties,products,lowStock,stats,recent,balances:balances[0]||{receivable:0,payable:0},dueCustomers,todaySales:todaySales[0]||{total:0,count:0},weeklySales:chart});
}