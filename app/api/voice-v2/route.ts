import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';
import { createAIClient, getAIProviders, getModel, shouldFallback } from '@/lib/ai/provider';
import { VOICE_V2_SYSTEM, VOICE_V2_TOOLS } from '@/lib/voice/v2Tools';
import { executeVoiceV2, VoiceV2Error } from '@/services/voiceEngineV2';

export const runtime='nodejs';
const Body=z.object({transcript:z.string().trim().min(1).max(5000),confirmed:z.boolean().optional(),tool:z.string().optional(),args:z.record(z.unknown()).optional()});

export async function POST(req:Request){
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({ok:false,error:'Unauthorized',code:'UNAUTHORIZED'},{status:401});
  const parsed=Body.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({ok:false,error:'Invalid voice request',issues:parsed.error.issues},{status:400});
  const {transcript,confirmed=false}=parsed.data;

  try{
    if(parsed.data.tool&&parsed.data.args){
      const result=await executeVoiceV2(parsed.data.tool,parsed.data.args,session.user.id,session.user.role||'USER',confirmed);
      return NextResponse.json({ok:true,tool:parsed.data.tool,args:parsed.data.args,result,provider:'server'});
    }

    const providers=getAIProviders();
    if(!providers.length)return NextResponse.json({ok:false,error:'OPENAI_API_KEY or OPENROUTER_API_KEY is required',code:'AI_NOT_CONFIGURED'},{status:503});
    let last:any=null;

    for(const provider of providers){
      try{
        const client=createAIClient(provider);
        const response=await client.chat.completions.create({
          model:getModel(provider),
          temperature:0,
          tool_choice:'auto',
          tools:VOICE_V2_TOOLS,
          messages:[{role:'system',content:VOICE_V2_SYSTEM},{role:'user',content:transcript}]
        });
        const message=response.choices[0]?.message;
        const call=message?.tool_calls?.[0];
        if(!call||call.type!=='function'){
          last=new Error('AI did not return a valid tool call');
          continue;
        }
        let args:any;
        try{args=JSON.parse(call.function.arguments||'{}');}catch{last=new Error('AI returned invalid tool arguments');continue;}
        try{
          const result=await executeVoiceV2(call.function.name,args,session.user.id,session.user.role||'USER',confirmed);
          return NextResponse.json({ok:true,tool:call.function.name,args,result,provider});
        }catch(error){
          if(error instanceof VoiceV2Error){
            if(error.code==='CONFIRMATION_REQUIRED')return NextResponse.json({ok:false,confirmationRequired:true,error:error.message,code:error.code,tool:call.function.name,args:error.details&&typeof error.details==='object'?(error.details as any).args:args});
            throw error;
          }
          throw error;
        }
      }catch(error){
        last=error;
        if(!shouldFallback(error))continue;
      }
    }
    return NextResponse.json({ok:false,error:last instanceof Error?last.message:'Voice AI failed',code:'AI_FAILED'},{status:502});
  }catch(error){
    if(error instanceof VoiceV2Error){
      const status=error.code==='FORBIDDEN'?403:error.code==='NOT_FOUND'||error.code==='AMBIGUOUS_ENTITY'||error.code==='DUPLICATE_ENTITY'?409:422;
      return NextResponse.json({ok:false,error:error.message,code:error.code,details:error.details},{status});
    }
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Voice execution failed',code:'VOICE_V2_ERROR'},{status:500});
  }
}