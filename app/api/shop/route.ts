import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import Shop from '@/models/Shop';
import {Types} from 'mongoose';
import {z} from 'zod';

const BUSINESS_TYPES=['GENERAL_RETAIL','GROCERY','CLOTHING','ELECTRONICS','PHARMACY','RESTAURANT','WHOLESALE','SERVICE','HARDWARE','OTHER'] as const;
const schema=z.object({
  shopName:z.string().trim().min(2).max(160),
  currency:z.string().trim().min(1).max(20),
  businessType:z.enum(BUSINESS_TYPES),
});

async function getUserId(){
  const s=await auth();
  return s?.user?.id||null;
}

export async function GET(){
  const id=await getUserId();
  if(!id)return NextResponse.json({error:'Unauthorized'},{status:401});
  await connectDB();
  const shop=await Shop.findOne({userId:new Types.ObjectId(id)}).lean();
  return NextResponse.json(shop);
}

export async function PATCH(req:Request){
  const id=await getUserId();
  if(!id)return NextResponse.json({error:'Unauthorized'},{status:401});
  let body:unknown;
  try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
  const parsed=schema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:parsed.error.flatten()},{status:422});
  await connectDB();
  const shop=await Shop.findOneAndUpdate(
    {userId:new Types.ObjectId(id)},
    {$set:parsed.data},
    {new:true,upsert:true,setDefaultsOnInsert:true}
  ).lean();
  return NextResponse.json(shop);
}
