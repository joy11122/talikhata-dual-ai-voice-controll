import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import Party from '@/models/Party';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import Backup from '@/models/Backup';
import {Types} from 'mongoose';

async function userId(){
  const s=await auth();
  if(!s?.user?.id)return null;
  return new Types.ObjectId(s.user.id);
}

function clean(value:any){return JSON.parse(JSON.stringify(value));}

export async function GET(req:Request){
  const uid=await userId();
  if(!uid)return NextResponse.json({error:'Unauthorized'},{status:401});
  await connectDB();
  const url=new URL(req.url); const mode=url.searchParams.get('mode')||'deleted';
  if(mode==='backups'){
    const rows=await Backup.find({userId:uid}).sort({createdAt:-1}).limit(20).select('_id source label createdAt expiresAt').lean();
    return NextResponse.json({backups:rows});
  }
  const [parties,products,transactions]=await Promise.all([
    Party.find({userId:uid,isDeleted:true}).sort({deletedAt:-1}).lean(),
    Product.find({userId:uid,isDeleted:true}).sort({deletedAt:-1}).lean(),
    Transaction.find({userId:uid,isDeleted:true}).sort({deletedAt:-1}).lean(),
  ]);
  return NextResponse.json({parties,products,transactions});
}

export async function POST(req:Request){
  const uid=await userId();
  if(!uid)return NextResponse.json({error:'Unauthorized'},{status:401});
  await connectDB();
  let body:any={}; try{body=await req.json()}catch{}
  const [parties,products,transactions]=await Promise.all([
    Party.find({userId:uid,isDeleted:false}).lean(),
    Product.find({userId:uid,isDeleted:false}).lean(),
    Transaction.find({userId:uid,isDeleted:false}).lean(),
  ]);
  const backup=await Backup.create({
    userId:uid,
    source:body.source==='SCHEDULED'?'SCHEDULED':'MANUAL',
    label:String(body.label||'Manual backup').slice(0,120),
    snapshot:clean({parties,products,transactions}),
  });
  await Backup.deleteMany({userId:uid,createdAt:{$lt:new Date(Date.now()-90*86400000)}});
  return NextResponse.json({ok:true,backup:{_id:backup._id,source:backup.source,label:backup.label,createdAt:backup.createdAt}},{status:201});
}

export async function PATCH(req:Request){
  const uid=await userId();
  if(!uid)return NextResponse.json({error:'Unauthorized'},{status:401});
  await connectDB();
  let body:any={}; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
  const id=String(body.id||''); if(!Types.ObjectId.isValid(id))return NextResponse.json({error:'Invalid backup id'},{status:400});
  const backup=await Backup.findOne({_id:id,userId:uid});
  if(!backup)return NextResponse.json({error:'Backup not found'},{status:404});
  const session=await mongooseStart();
  try{
    const snap:any=backup.snapshot;
    for(const raw of snap.parties||[]){const row={...raw};delete row._id;delete row.createdAt;delete row.updatedAt;await Party.updateOne({_id:raw._id,userId:uid},{$set:{...row,isDeleted:false},$unset:{deletedAt:1,deletedBy:1},$setOnInsert:{_id:raw._id}},{upsert:true,session});}
    for(const raw of snap.products||[]){const row={...raw};delete row._id;delete row.createdAt;delete row.updatedAt;await Product.updateOne({_id:raw._id,userId:uid},{$set:{...row,isDeleted:false},$unset:{deletedAt:1,deletedBy:1},$setOnInsert:{_id:raw._id}},{upsert:true,session});}
    for(const raw of snap.transactions||[]){const row={...raw};delete row._id;delete row.createdAt;delete row.updatedAt;await Transaction.updateOne({_id:raw._id,userId:uid},{$set:{...row,isDeleted:false},$unset:{deletedAt:1,deletedBy:1},$setOnInsert:{_id:raw._id}},{upsert:true,session});}
    await session.commitTransaction();
    return NextResponse.json({ok:true});
  }catch(e){await session.abortTransaction();return NextResponse.json({error:e instanceof Error?e.message:'Restore failed'},{status:400});}
  finally{await session.endSession();}
}

async function mongooseStart(){const mongoose=await import('mongoose');const s=await mongoose.startSession();s.startTransaction();return s;}
