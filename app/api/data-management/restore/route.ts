import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import Party from '@/models/Party';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import {Types} from 'mongoose';import {restoreTransaction} from '@/services/transactionService';

export async function POST(req:Request){
  const s=await auth(); if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  let body:any;try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
  const uid=new Types.ObjectId(s.user.id);const id=String(body.id||'');const type=String(body.type||'');
  if(!Types.ObjectId.isValid(id)||!['party','product','transaction'].includes(type))return NextResponse.json({error:'Invalid restore request'},{status:400});
  await connectDB();
  if(type==='transaction'){
    try{return NextResponse.json({ok:true,result:await restoreTransaction(id,s.user.id)})}catch(e:any){return NextResponse.json({error:e?.message||'Restore failed',code:e?.code},{status:e?.code==='RESTORE_BLOCKED'?409:404})}
  }
  const Model:any=type==='party'?Party:Product;
  const row=await Model.findOneAndUpdate({_id:id,userId:uid,isDeleted:true},{$set:{isDeleted:false},$unset:{deletedAt:1,deletedBy:1}},{new:true}).lean();
  if(!row)return NextResponse.json({error:'Deleted item not found'},{status:404});
  return NextResponse.json({ok:true,item:row});
}
