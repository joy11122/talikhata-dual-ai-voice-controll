import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';
import { parseVoiceV2, executeVoiceV2, VoiceV2Error } from '@/services/voiceEngineV2';
import { VoiceV2Schema, type VoiceV2Command } from '@/lib/voice-v2/schema';

export const runtime='nodejs';
const Body=z.object({
  transcript:z.string().trim().min(1).max(5000),
  confirmed:z.boolean().optional(),
  command:VoiceV2Schema.optional()
});

export async function POST(req:Request){
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({ok:false,error:'Unauthorized',code:'UNAUTHORIZED'},{status:401});
  const body=Body.safeParse(await req.json().catch(()=>null));
  if(!body.success)return NextResponse.json({ok:false,error:'Invalid voice request',issues:body.error.issues},{status:400});
  try{
    const command:VoiceV2Command=body.data.command??await parseVoiceV2(body.data.transcript);
    const result=await executeVoiceV2(command,session.user.id,body.data.transcript,body.data.confirmed===true,crypto.randomUUID());
    return NextResponse.json({ok:true,command,result});
  }catch(error){
    if(error instanceof VoiceV2Error){
      return NextResponse.json({
        ok:false,error:error.message,code:error.code,details:error.details,
        confirmationRequired:error.code==='CONFIRMATION_REQUIRED'
      },{status:error.code==='UNAUTHORIZED'?401:error.code==='FORBIDDEN'?403:error.code==='NOT_FOUND'||error.code==='AMBIGUOUS_ENTITY'||error.code==='DUPLICATE_ENTITY'?409:422});
    }
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Voice Engine V2 failed',code:'VOICE_V2_ERROR'},{status:500});
  }
}