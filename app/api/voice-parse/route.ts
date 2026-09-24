import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseVoiceV2, VoiceV2Error } from '@/services/voiceEngineV2';
import { z } from 'zod';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const Body=z.object({transcript:z.string().trim().min(1).max(5000)});
export async function POST(req:Request){try{const session=await auth();if(!session?.user?.id)return NextResponse.json({ok:false,code:'UNAUTHORIZED',error:'Please sign in.'},{status:401});const body=Body.safeParse(await req.json());if(!body.success)return NextResponse.json({ok:false,code:'INVALID_REQUEST',error:'Invalid transcript.'},{status:422});const intent=await parseVoiceV2(body.data.transcript);return NextResponse.json(intent);}catch(error){const e=error instanceof VoiceV2Error?error:new VoiceV2Error('VOICE_PARSE_FAILED','Voice command could not be understood.');console.error('[voice-v2/parse]',error);return NextResponse.json({ok:false,code:e.code,error:e.message,details:e.details||null},{status:e.code==='UNAUTHORIZED'?401:e.code==='AI_UNAVAILABLE'?502:422});}}