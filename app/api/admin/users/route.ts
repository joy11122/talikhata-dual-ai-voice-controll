import {NextResponse} from 'next/server';
import {getAdminSession} from '@/lib/adminAuth';
import {connectDB} from '@/lib/db';
import User from '@/models/User';
export async function GET(){const {session:s,admin}=await getAdminSession();if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});if(!admin)return NextResponse.json({error:'Forbidden'},{status:403,headers:{'Cache-Control':'no-store'}});await connectDB();const users=await User.find().sort({createdAt:-1}).limit(500).select('name email role status createdAt').lean();return NextResponse.json({users});}
