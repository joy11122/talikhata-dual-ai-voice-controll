import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import User from '@/models/User';
import {Types} from 'mongoose';

export async function PATCH(req:Request){
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await req.json().catch(()=>null);
  if(!body||typeof body.image!=='string')return NextResponse.json({error:'Invalid profile image'},{status:400});
  const image=body.image.trim();
  if(image && !/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))return NextResponse.json({error:'Only JPEG, PNG or WebP images are allowed'},{status:400});
  if(image.length>700000)return NextResponse.json({error:'Profile photo is too large. Please choose a smaller image.'},{status:413});
  await connectDB();
  await User.updateOne({_id:new Types.ObjectId(session.user.id)},{$set:{image:image||undefined}});
  return NextResponse.json({ok:true,image:image||null});
}