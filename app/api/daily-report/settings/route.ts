import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import DailyReportSetting from '@/models/DailyReportSetting';
import User from '@/models/User';
import {Types} from 'mongoose';
import {z} from 'zod';

const schema=z.object({
  enabled:z.boolean(),
  sendTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  timezone:z.string().min(1).max(80),
  emailEnabled:z.boolean(),
  inAppEnabled:z.boolean(),
});

export async function GET(){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  await connectDB();
  const uid=new Types.ObjectId(s.user.id);
  const [setting,user]=await Promise.all([
    DailyReportSetting.findOne({userId:uid}).lean(),
    User.findById(uid).select('email timezone').lean(),
  ]);
  return NextResponse.json({
    enabled:setting?.enabled??false,
    sendTime:setting?.sendTime??'21:00',
    timezone:setting?.timezone||user?.timezone||'Asia/Dhaka',
    emailEnabled:setting?.emailEnabled??true,
    inAppEnabled:setting?.inAppEnabled??true,
    email:user?.email||'',
  });
}

export async function PATCH(req:Request){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  const parsed=schema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:'Invalid notification settings'},{status:400});
  await connectDB();
  const setting=await DailyReportSetting.findOneAndUpdate(
    {userId:new Types.ObjectId(s.user.id)},
    {$set:parsed.data},
    {upsert:true,new:true,setDefaultsOnInsert:true}
  ).lean();
  return NextResponse.json(setting);
}