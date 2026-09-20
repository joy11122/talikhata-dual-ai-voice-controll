import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import User from '@/models/User';
export async function GET(){const s=await auth();if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});if(s.user.role!=='ADMIN')return NextResponse.json({error:'Forbidden'},{status:403,headers:{'Cache-Control':'no-store'}});await connectDB();const users=await User.find().sort({createdAt:-1}).limit(500).select('name email role status createdAt').lean();return NextResponse.json({users});}
