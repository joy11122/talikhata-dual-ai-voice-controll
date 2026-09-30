import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import Notification from '@/models/Notification';
import {Types} from 'mongoose';

export async function GET(){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  await connectDB();
  const items=await Notification.find({userId:new Types.ObjectId(s.user.id)}).sort({createdAt:-1}).limit(30).lean();
  return NextResponse.json(items);
}

export async function PATCH(req:Request){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await req.json().catch(()=>({}));
  await connectDB();
  if(body.id)await Notification.updateOne({_id:body.id,userId:new Types.ObjectId(s.user.id)},{$set:{read:true}});
  else await Notification.updateMany({userId:new Types.ObjectId(s.user.id),read:false},{$set:{read:true}});
  return NextResponse.json({ok:true});
}