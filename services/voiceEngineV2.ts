import 'server-only';
import OpenAI from 'openai';
import { Types } from 'mongoose';
import { auth } from '@/auth';
import { connectDB } from '@/lib/db';
import Party from '@/models/Party';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import AuditLog from '@/models/AuditLog';
import { createTransaction, reverseTransaction, TransactionServiceError } from './transactionService';
import { resolveParty, resolveProduct } from './entityResolver';
import { VoiceV2Schema, VoiceV2JsonSchema, type VoiceV2Command } from '@/lib/voice-v2/schema';
import { normalizeVoiceText, extractNumber, transliterateBanglish } from '@/lib/voice/normalize';

export class VoiceV2Error extends Error {
  code:string; details?:unknown;
  constructor(code:string,message:string,details?:unknown){super(message);this.name='VoiceV2Error';this.code=code;this.details=details;}
}

function n(v:unknown){return typeof v==='number'&&Number.isFinite(v)?v:0;}
function clean(v:unknown){return typeof v==='string'&&v.trim()?v.trim():null;}
function money(v:unknown){return Math.round(n(v)*100)/100;}
function text(s:string){return normalizeVoiceText(s).toLowerCase().replace(/[।,!?;:]/g,' ').replace(/\s+/g,' ').trim();}
function empty(action:VoiceV2Command['action']):VoiceV2Command{return {action,entityType:'NONE',entityName:null,targetId:null,amount:null,quantity:null,unit:null,unitPrice:null,paidAmount:null,phone:null,notes:null,partyType:null,query:null,confirmRequired:false};}

function extractName(t:string, kind:'party'|'product'='party'){
  const s=normalizeVoiceText(t).replace(/[।,!?;:]/g,' ').replace(/\s+/g,' ').trim();
  const patterns=kind==='party'?[
    /^(.+?)\s*(?:এর|র)\s*(?:কাছে\s*)?(?:কত|কতো)\s*(?:টাকা)?\s*(?:পাব|পাবে|পাও|বাকি|পাওনা)/iu,
    /^(.+?)\s*(?:এর|র)\s*(?:বাকি|পাওনা)\s*(?:কত|কতো)/iu,
    /^(.+?)\s*(?:কে|কে?)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:দিলাম|দিল|দিয়েছি|দিয়েছি|দিয়েছে|দিয়েছে|জমা|পরিশোধ|paid|pay|dilam|dilo|dil|diyechi)/iu,
    /^(.+?)\s+er\s+kache\s+\d[\d,]*(?:\.\d+)?\s*(?:taka|tk)?\s*(?:baki|due)\s*(?:dilam|dilo|dil|kore|dao)?$/i,
    /^(.+?)\s+ke\s+\d[\d,]*(?:\.\d+)?\s*(?:taka|tk)?\s*(?:dilam|dilo|dil|diyechi|paid|pay)?$/i,
    /^(.+?)\s*(?:কে|কে?)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:বাকি|পাওনা)\s*(?:দিলাম|দাও|করো)?$/iu
  ]:[
    /^(?:পণ্য|product|item)?\s*(.+?)\s*(?:স্টক|stock)\s*(?:দেখাও|দেখান|কত|how much)/iu,
    /^(.+?)\s*(?:স্টক|stock)\s*(?:যোগ|add|in|ঢোকাও|বের|out|কমাও)/iu
  ];
  for(const p of patterns){const m=s.match(p);if(m?.[1]){const v=m[1].replace(/(?:এর|র|কে|ে)$/u,'').replace(/\s+(?:er|r|ke|der|e)$/i,'').trim();if(v)return v;}}
  return null;
}

function localParse(transcript:string):VoiceV2Command|null{
  const s=text(transcript); const amount=extractNumber(transcript);
  const name=extractName(transcript,'party');
  const balance=/(?:কত|কতো|বাকি|পাওনা|দেনা|balance|due|pabo|pabe|koto)/i.test(s);
  const payment=/(?:জমা|পরিশোধ|পেলাম|দিয়েছে|দিয়েছে|দিলাম|paid|payment|received|receive|dilam|dilo|dise|diyeche|diyechi)/i.test(s);
  const due=/(?:বাকি|পাওনা|due|baki)/i.test(s);
  if(name&&balance){
    const c=empty('READ_BALANCE');c.entityType='CUSTOMER';c.entityName=name;return c;
  }
  if(name&&amount&&payment){
    const c=empty('RECEIVE_PAYMENT');c.entityType='CUSTOMER';c.entityName=name;c.amount=amount;return c;
  }
  if(name&&amount&&due){
    const c=empty('CREATE_DUE');c.entityType='CUSTOMER';c.entityName=name;c.amount=amount;return c;
  }
  if(/(?:নতুন|যোগ|add|create)\s+(?:customer|কাস্টমার|গ্রাহক)/i.test(s)){
    const c=empty('CREATE_PARTY');c.entityType='CUSTOMER';c.partyType='CUSTOMER';c.entityName=s.replace(/.*?(?:customer|কাস্টমার|গ্রাহক)\s*/i,'').trim()||null;return c;
  }
  if(/(?:customer|কাস্টমার|গ্রাহক).*(?:list|তালিকা|সব|দেখাও)/i.test(s)){const c=empty('LIST_PARTIES');c.entityType='CUSTOMER';c.partyType='CUSTOMER';return c;}
  if(/(?:supplier|সরবরাহকারী|সাপ্লায়ার).*(?:list|তালিকা|সব|দেখাও)/i.test(s)){const c=empty('LIST_PARTIES');c.entityType='SUPPLIER';c.partyType='SUPPLIER';return c;}
  if(/(?:product|পণ্য|item).*(?:list|তালিকা|সব|দেখাও)/i.test(s))return empty('LIST_PRODUCTS');
  if(/(?:transaction|লেনদেন|হিসাব).*(?:list|তালিকা|দেখাও)/i.test(s))return empty('LIST_TRANSACTIONS');
  return null;
}

const SYSTEM=`You are TaliKhata Voice Engine V2. Convert Bangla, Banglish, English and mixed shop speech into ONE safe structured command.
Never invent names, amounts, ids or products. Preserve spoken names in entityName. Use null when missing.
Balance: READ_BALANCE. Customer gives shop money: RECEIVE_PAYMENT. Shop gives customer credit: CREATE_DUE.
Create/update/delete customer or supplier with party actions. Product CRUD uses product actions. Stock uses STOCK_IN/STOCK_OUT.
Sales use CREATE_SALE; purchases use CREATE_PURCHASE; expenses use CREATE_EXPENSE.
For destructive actions DELETE_PARTY, DELETE_PRODUCT, DELETE_TRANSACTION set confirmRequired=true. For financial writes over ৳10000 set confirmRequired=true.
Do not answer prose. Return only the requested JSON schema.`;

async function aiParse(transcript:string):Promise<VoiceV2Command>{
  const providers:[string,string,string][]=[];
  if(process.env.OPENAI_API_KEY)providers.push(['openai',process.env.OPENAI_API_KEY,process.env.OPENAI_VOICE_MODEL||'gpt-4.1-mini']);
  if(process.env.OPENROUTER_API_KEY)providers.push(['openrouter',process.env.OPENROUTER_API_KEY,process.env.OPENROUTER_VOICE_MODEL||'openai/gpt-4.1-mini']);
  if(!providers.length)throw new VoiceV2Error('AI_NOT_CONFIGURED','OPENAI_API_KEY or OPENROUTER_API_KEY is required');
  let last:unknown;
  for(const [provider,key,model] of providers){
    try{
      const client=new OpenAI({apiKey:key,baseURL:provider==='openrouter'?'https://openrouter.ai/api/v1':undefined,timeout:9000,maxRetries:0,defaultHeaders:provider==='openrouter'?{'HTTP-Referer':process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000','X-Title':'TaliKhata Voice V2'}:undefined});
      const r=await client.chat.completions.create({
        model,messages:[{role:'system',content:SYSTEM},{role:'user',content:transcript}],
        temperature:0,
        response_format:{type:'json_schema',json_schema:{name:'talikhata_voice_v2',strict:true,schema:VoiceV2JsonSchema}}
      } as any);
      const raw=r.choices[0]?.message?.content||'';
      const parsed=JSON.parse(raw);
      return VoiceV2Schema.parse(parsed);
    }catch(e){last=e;continue;}
  }
  throw new VoiceV2Error('AI_UNAVAILABLE','Voice AI provider failed. Please try again.',{cause:last instanceof Error?last.message:undefined});
}

export async function parseVoiceV2(transcript:string){
  const local=localParse(transcript);
  if(local)return local;
  const ai=await aiParse(transcript);
  return ai;
}

async function party(userId:string,name:string,session:any,type?:'CUSTOMER'|'SUPPLIER'){
  const matches=await resolveParty(userId,name,session);
  const filtered=type?matches.filter((x:any)=>x.partyType===type):matches;
  if(filtered.length===0)throw new VoiceV2Error('NOT_FOUND',`${type==='SUPPLIER'?'Supplier':'Customer'} "${name}" was not found`,{name});
  if(filtered.length>1)throw new VoiceV2Error('AMBIGUOUS_ENTITY',`Multiple parties matched "${name}"`,{matches:filtered.slice(0,10).map((x:any)=>({id:String(x._id),name:x.name,phone:x.phone||null,balance:x.currentBalance}))});
  return filtered[0];
}
async function product(userId:string,name:string,session:any){
  const matches=await resolveProduct(userId,name,session);
  if(!matches.length)throw new VoiceV2Error('NOT_FOUND',`Product "${name}" was not found`,{name});
  if(matches.length>1)throw new VoiceV2Error('AMBIGUOUS_ENTITY',`Multiple products matched "${name}"`,{matches:matches.slice(0,10).map((x:any)=>({id:String(x._id),name:x.name,stock:x.stockQuantity,unit:x.unit}))});
  return matches[0];
}
function requireConfirmation(c:VoiceV2Command,confirmed:boolean){if((c.confirmRequired||['DELETE_PARTY','DELETE_PRODUCT','DELETE_TRANSACTION'].includes(c.action))&&!confirmed)throw new VoiceV2Error('CONFIRMATION_REQUIRED','এই কাজটি করার আগে confirmation প্রয়োজন।');}

export async function executeVoiceV2(command:VoiceV2Command,userId:string,transcript='',confirmed=false,commandId?:string){
  const sessionUser=await auth();if(!sessionUser?.user?.id||sessionUser.user.id!==userId)throw new VoiceV2Error('UNAUTHORIZED','Unauthorized');
  if(!Types.ObjectId.isValid(userId))throw new VoiceV2Error('UNAUTHORIZED','Invalid user');
  const c=VoiceV2Schema.parse(command);requireConfirmation(c,confirmed);await connectDB();
  if(commandId){const old=await AuditLog.findOne({userId:new Types.ObjectId(userId),commandId,status:'SUCCESS'}).lean();if(old?.result)return old.result;}
  const uid=new Types.ObjectId(userId);
  try{
    if(c.action==='READ_BALANCE'||c.action==='READ_PARTY'||c.action==='LIST_PARTIES'||c.action==='READ_PRODUCT'||c.action==='LIST_PRODUCTS'||c.action==='LIST_TRANSACTIONS'){
      if(c.action==='READ_BALANCE'){if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Customer name is required');const p=await party(userId,c.entityName,null,'CUSTOMER');return {type:'READ_BALANCE',party:{id:String(p._id),name:p.name,phone:p.phone||null},balance:money(p.currentBalance),receivable:money(Math.max(0,n(p.currentBalance))),payable:money(Math.max(0,-n(p.currentBalance)))};}
      if(c.action==='READ_PARTY'){if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Customer or supplier name is required');const p=await party(userId,c.entityName,null,c.partyType||undefined);return {type:'READ_PARTY',party:p};}
      if(c.action==='LIST_PARTIES'){const q:any={userId:uid};if(c.partyType)q.partyType=c.partyType;const rows=await Party.find(q).sort({name:1}).limit(200).lean();return {type:'LIST_PARTIES',items:rows.map((p:any)=>({id:String(p._id),name:p.name,phone:p.phone||null,partyType:p.partyType,balance:p.currentBalance}))};}
      if(c.action==='READ_PRODUCT'){if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Product name is required');const p=await product(userId,c.entityName,null);return {type:'READ_PRODUCT',product:p};}
      if(c.action==='LIST_PRODUCTS'){const rows=await Product.find({userId:uid}).sort({name:1}).limit(200).lean();return {type:'LIST_PRODUCTS',items:rows};}
      const rows=await Transaction.find({userId:uid,isDeleted:{$ne:true}}).sort({timestamp:-1}).limit(100).lean();return {type:'LIST_TRANSACTIONS',items:rows};
    }

    const s=await Party.startSession();let result:any;
    try{
      await s.withTransaction(async()=>{
        if(c.action==='CREATE_PARTY'){
          if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Party name is required');
          const pt=c.partyType||'CUSTOMER';const dup=await Party.findOne({userId:uid,name:new RegExp('^'+c.entityName.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&')+'$','i')}).session(s);if(dup)throw new VoiceV2Error('DUPLICATE_ENTITY',`A party named "${c.entityName}" already exists`,{matches:[{id:String(dup._id),name:dup.name,phone:dup.phone||null,balance:dup.currentBalance}]});
          const [p]=await Party.create([{userId:uid,name:c.entityName,phone:c.phone||undefined,partyType:pt,currentBalance:0}],{session:s});result={type:'CREATE_PARTY',id:String(p._id),name:p.name,phone:p.phone||null,partyType:p.partyType,balance:0};
        }else if(c.action==='UPDATE_PARTY'){
          if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Party name is required');
          const p=await party(userId,c.entityName,s,c.partyType||undefined);const set:any={};if(c.phone)set.phone=c.phone;if(c.notes)set.notes=c.notes;if(c.query)set.name=c.query;
          if(!Object.keys(set).length)throw new VoiceV2Error('INVALID_UPDATE','No party fields to update');const row=await Party.findOneAndUpdate({_id:p._id,userId:uid},{$set:set},{new:true,session:s}).lean();result={type:'UPDATE_PARTY',party:row};
        }else if(c.action==='DELETE_PARTY'){
          if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Party name is required');const p=await party(userId,c.entityName,s,c.partyType||undefined);if(await Transaction.exists({userId:uid,partyId:p._id}).session(s))throw new VoiceV2Error('DELETE_BLOCKED','Transaction history exists for this party. It cannot be deleted safely.');await Party.deleteOne({_id:p._id,userId:uid},{session:s});result={type:'DELETE_PARTY',id:String(p._id),name:p.name};
        }else if(c.action==='CREATE_PRODUCT'){
          if(!c.entityName||!c.unit)throw new VoiceV2Error('INVALID_PRODUCT','Product name and unit are required');const dup=await Product.findOne({userId:uid,name:new RegExp('^'+c.entityName.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&')+'$','i')}).session(s);if(dup)throw new VoiceV2Error('DUPLICATE_ENTITY',`Product "${c.entityName}" already exists`);
          const [p]=await Product.create([{userId:uid,name:c.entityName,unit:c.unit,stockQuantity:n(c.quantity),buyPrice:n(c.unitPrice),sellPrice:0,lowStockThreshold:5}],{session:s});result={type:'CREATE_PRODUCT',id:String(p._id),name:p.name,unit:p.unit,stock:p.stockQuantity,buyPrice:p.buyPrice,sellPrice:p.sellPrice};
        }else if(c.action==='UPDATE_PRODUCT'){
          if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Product name is required');const p=await product(userId,c.entityName,s);const set:any={};if(c.unit)set.unit=c.unit;if(c.unitPrice!==null)set.buyPrice=n(c.unitPrice);if(c.query)set.name=c.query;if(!Object.keys(set).length)throw new VoiceV2Error('INVALID_UPDATE','No product fields to update');const row=await Product.findOneAndUpdate({_id:p._id,userId:uid},{$set:set},{new:true,session:s}).lean();result={type:'UPDATE_PRODUCT',product:row};
        }else if(c.action==='DELETE_PRODUCT'){
          if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Product name is required');const p=await product(userId,c.entityName,s);if(await Transaction.exists({userId:uid,productId:p._id}).session(s))throw new VoiceV2Error('DELETE_BLOCKED','Transaction history exists for this product. It cannot be deleted safely.');await Product.deleteOne({_id:p._id,userId:uid},{session:s});result={type:'DELETE_PRODUCT',id:String(p._id),name:p.name};
        }else if(c.action==='CREATE_DUE'||c.action==='RECEIVE_PAYMENT'){
          if(!c.entityName||!c.amount||c.amount<=0)throw new VoiceV2Error('INVALID_TRANSACTION','Customer and positive amount are required');const p=await party(userId,c.entityName,s,'CUSTOMER');const tx=await createTransaction({type:c.action==='CREATE_DUE'?'DUE_GIVEN':'DUE_RECEIVED',partyId:String(p._id),amount:c.amount,quantity:0,notes:c.notes||undefined},userId,s);result={type:c.action,amount:c.amount,party:{id:String(p._id),name:p.name},transaction:tx};
        }else if(c.action==='STOCK_IN'||c.action==='STOCK_OUT'){
          if(!c.entityName||!c.quantity||c.quantity<=0)throw new VoiceV2Error('INVALID_STOCK','Product and positive quantity are required');const p=await product(userId,c.entityName,s);const tx=await createTransaction({type:c.action==='STOCK_IN'?'STOCK_IN':'STOCK_OUT',productId:String(p._id),amount:money(n(c.quantity)*n(c.unitPrice)),quantity:c.quantity,unitPrice:c.unitPrice??undefined,notes:c.notes||undefined},userId,s);const fresh=await Product.findById(p._id).session(s).lean();result={type:c.action,product:{id:String(p._id),name:p.name,unit:p.unit},quantity:c.quantity,stock:n(fresh?.stockQuantity),transaction:tx};
        }else if(c.action==='CREATE_EXPENSE'){
          if(!c.amount||c.amount<=0)throw new VoiceV2Error('INVALID_EXPENSE','Positive expense amount is required');const tx=await createTransaction({type:'EXPENSE',amount:c.amount,quantity:0,notes:c.notes||transcript},userId,s);result={type:'CREATE_EXPENSE',amount:c.amount,transaction:tx};
        }else if(c.action==='CREATE_SALE'||c.action==='CREATE_PURCHASE'){
          if(!c.entityName||!c.quantity||c.quantity<=0||!c.unitPrice||c.unitPrice<=0)throw new VoiceV2Error('INVALID_TRADE','Product, quantity and unit price are required');
          const p=await product(userId,c.entityName,s);const type=c.action==='CREATE_SALE'?'SALE':'STOCK_IN';let partyId:string|undefined;
          if(c.partyType){const pp=await party(userId,c.query||'',s,c.partyType);partyId=String(pp._id);}
          const total=money(c.quantity*c.unitPrice);const paid=n(c.paidAmount);const tx=await createTransaction({type,partyId,productId:String(p._id),amount:total,quantity:c.quantity,unitPrice:c.unitPrice,paidAmount:paid,notes:c.notes||undefined},userId,s);result={type:c.action,product:p.name,total,paidAmount:paid,due:Math.max(0,total-paid),transaction:tx};
        }else if(c.action==='DELETE_TRANSACTION'){
          if(!c.targetId)throw new VoiceV2Error('MISSING_ENTITY','Transaction id is required');result={type:'DELETE_TRANSACTION',reversal:await reverseTransaction(c.targetId,userId,s)};
        }else throw new VoiceV2Error('UNSUPPORTED_ACTION',`Unsupported action: ${c.action}`);
      },{readConcern:{level:'local'},writeConcern:{w:'majority'},maxCommitTimeMS:10000});
    }finally{await s.endSession();}
    if(commandId)await AuditLog.create({userId:uid,voiceTranscript:transcript,parsedIntent:c,status:'SUCCESS',commandId,result}).catch(()=>{});
    return result;
  }catch(e){
    if(e instanceof VoiceV2Error)throw e;
    if(e instanceof TransactionServiceError)throw new VoiceV2Error(e.code,e.message,e.details);
    const msg=e instanceof Error?e.message:'Unknown voice execution error';throw new VoiceV2Error('EXECUTION_FAILED',msg);
  }
}
