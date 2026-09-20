import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import User from '@/models/User';
import {Types} from 'mongoose';
import {z} from 'zod';
import AdminAuditLog from '@/models/AdminAuditLog';
const Schema=z.object({status:z.enum(['ACTIVE','SUSPENDED'])});
export async function PATCH(req:Request,{params}:{params:{id:string}}){const s=await auth();if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});if(s.user.role!=='ADMIN')return NextResponse.json({error:'Forbidden'},{status:403,headers:{'Cache-Control':'no-store'}});if(!Types.ObjectId.isValid(params.id))return NextResponse.json({error:'Invalid user id'},{status:400});if(params.id===s.user.id)return NextResponse.json({error:'You cannot change your own admin status'},{status:400});const parsed=Schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Invalid status'},{status:400});await connectDB();const user=await User.findById(params.id);if(!user)return NextResponse.json({error:'User not found'},{status:404});if(user.role==='ADMIN')return NextResponse.json({error:'Admin accounts are protected'},{status:400});const previousStatus=user.status; user.status=parsed.data.status;await user.save(); await AdminAuditLog.create({adminId:s.user.id,action:'USER_STATUS_CHANGED',targetType:'USER',targetId:user._id,metadata:{previousStatus,newStatus:user.status}});return NextResponse.json({user:{_id:String(user._id),status:user.status}});}
