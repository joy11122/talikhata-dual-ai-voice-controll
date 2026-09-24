import 'server-only';
import OpenAI from 'openai';
import { Types } from 'mongoose';
import { auth } from '@/auth';
import { connectDB } from '@/lib/db';
import Party from '@/models/Party';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import User from '@/models/User';
import AuditLog from '@/models/AuditLog';
import { createTransaction, reverseTransaction, TransactionServiceError } from './transactionService';
import { resolveParty, resolveProduct } from './entityResolver';
import { VoiceV2Schema, VoiceV2JsonSchema, type VoiceV2Command } from '@/lib/voice-v2/schema';
import { normalizeVoiceText, extractNumber } from '@/lib/voice/normalize';

export class VoiceV2Error extends Error { code:string; details?:unknown; constructor(code:string,message:string,details?:unknown){super(message);this.name='VoiceV2Error';this.code=code;this.details=details;} }
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const money=(v:unknown)=>Math.round(num(v)*100)/100;
const clean=(v:unknown)=>typeof v==='string'&&v.trim()?v.trim():null;
const norm=(s:string)=>normalizeVoiceText(s).toLowerCase().replace(/[।,!?;:]/g,' ').replace(/\s+/g,' ').trim();
const blank=(action:VoiceV2Command['action']):VoiceV2Command=>({action,entityType:'NONE',entityName:null,targetId:null,amount:null,quantity:null,unit:null,unitPrice:null,paidAmount:null,phone:null,notes:null,partyType:null,query:null,confirmRequired:false});

function partyName(t:string){
 const s=normalizeVoiceText(t).replace(/[।,!?;:]/g,' ').replace(/\s+/g,' ').trim();
 const ps=[
  /^(.+?)\s*(?:এর|র)\s*(?:কাছে\s*)?(?:কত|কতো)\s*(?:টাকা)?\s*(?:পাব|পাবে|পাও|বাকি|পাওনা)/iu,
  /^(.+?)\s*(?:এর|র)\s*(?:বাকি|পাওনা)\s*(?:কত|কতো)/iu,
  /^(.+?)\s*(?:কে)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:দিলাম|দিল|দিয়েছি|দিয়েছি|জমা|পরিশোধ|paid|pay|dilam|dilo|dil|diyechi)/iu,
  /^(.+?)\s+er\s+kache\s+\d[\d,]*(?:\.\d+)?\s*(?:taka|tk)?\s*(?:baki|due)\s*(?:dilam|dilo|dil|kore|dao)?$/i,
  /^(.+?)\s+ke\s+\d[\d,]*(?:\.\d+)?\s*(?:taka|tk)?\s*(?:dilam|dilo|dil|diyechi|paid|pay)?$/i,
  /^(.+?)\s*(?:কে)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:বাকি|পাওনা)\s*(?:দিলাম|দাও|করো)?$/iu
 ];
 for(const p of ps){const m=s.match(p);if(m?.[1])return m[1].replace(/(?:এর|র|কে|ে)$/u,'').replace(/\s+(?:er|r|ke|der|e)$/i,'').trim();}
 return null;
}
function localParse(t:string){
 const s=norm(t), amount=extractNumber(t), name=partyName(t);
 const balance=/(?:কত|কতো|বাকি|পাওনা|দেনা|balance|due|pabo|pabe|koto)/i.test(s);
 const payment=/(?:জমা|পরিশোধ|পেলাম|দিয়েছে|দিয়েছে|paid|payment|received|receive|dilam|dilo|dise|diyeche|diyechi)/i.test(s);
 const due=/(?:বাকি|পাওনা|due|baki)/i.test(s);
 if(name&&balance){const c=blank('READ_BALANCE');c.entityType='CUSTOMER';c.entityName=name;return c;}
 if(name&&amount&&payment){const c=blank('RECEIVE_PAYMENT');c.entityType='CUSTOMER';c.entityName=name;c.amount=amount;return c;}
 if(name&&amount&&due){const c=blank('CREATE_DUE');c.entityType='CUSTOMER';c.entityName=name;c.amount=amount;return c;}
 if(/(?:নতুন\s+)?(?:customer|কাস্টমার|গ্রাহক)\s*(?:যোগ|add|create|করো|করুন)/i.test(s)){
   const c=blank('CREATE_PARTY');c.entityType='CUSTOMER';c.partyType='CUSTOMER';
   const m=s.match(/(?:নামে|name)?\s*([a-zA-Z\u0980-\u09FF][a-zA-Z\u0980-\u09FF\s]{1,80}?)(?:\s+(?:নামে|name))?\s*(?:নতুন\s*)?(?:customer|কাস্টমার|গ্রাহক)\s*(?:যোগ|add|create|করো|করুন)/i);
   if(m?.[1])c.entityName=m[1].trim();return c;
 }
 if(/(?:customer|কাস্টমার|গ্রাহক)/i.test(s)&&/(?:list|তালিকা|সব|দেখাও)/i.test(s)){const c=blank('LIST_PARTIES');c.entityType='CUSTOMER';c.partyType='CUSTOMER';return c;}
 if(/(?:supplier|সরবরাহকারী|সাপ্লায়ার)/i.test(s)&&/(?:list|তালিকা|সব|দেখাও)/i.test(s)){const c=blank('LIST_PARTIES');c.entityType='SUPPLIER';c.partyType='SUPPLIER';return c;}
 if(/(?:product|পণ্য|item)/i.test(s)&&/(?:list|তালিকা|সব|দেখাও)/i.test(s))return blank('LIST_PRODUCTS');
 if(/(?:transaction|লেনদেন|হিসাব)/i.test(s)&&/(?:list|তালিকা|দেখাও)/i.test(s))return blank('LIST_TRANSACTIONS');
 return null;
}

const SYSTEM=`You are TaliKhata Voice Engine V2. Parse Bangla, Banglish, English and mixed shop commands. Return ONLY structured JSON. Never invent names, amounts, IDs or products. Preserve entityName as spoken. Customer credit=CREATE_DUE. Customer pays shop=RECEIVE_PAYMENT. Balance=READ_BALANCE. Party CRUD uses CREATE_PARTY/READ_PARTY/LIST_PARTIES/UPDATE_PARTY/DELETE_PARTY. User CRUD is admin-only and uses CREATE_USER/READ_USER/LIST_USERS/UPDATE_USER/DELETE_USER. Product CRUD uses CREATE_PRODUCT/READ_PRODUCT/LIST_PRODUCTS/UPDATE_PRODUCT/DELETE_PRODUCT. Inventory uses STOCK_IN/STOCK_OUT. Sales=CREATE_SALE, purchases=CREATE_PURCHASE, expenses=CREATE_EXPENSE. Destructive actions require confirmation. Financial writes above 10000 require confirmation.`;

async function aiParse(t:string):Promise<VoiceV2Command>{
 const providers:[string,string,string][]=[];
 if(process.env.OPENAI_API_KEY)providers.push(['openai',process.env.OPENAI_API_KEY,process.env.OPENAI_VOICE_MODEL||'gpt-4.1-mini']);
 if(process.env.OPENROUTER_API_KEY)providers.push(['openrouter',process.env.OPENROUTER_API_KEY,process.env.OPENROUTER_VOICE_MODEL||'openai/gpt-4.1-mini']);
 if(!providers.length)throw new VoiceV2Error('AI_NOT_CONFIGURED','OPENAI_API_KEY or OPENROUTER_API_KEY is required');
 let last='';
 for(const [provider,key,model] of providers){
  try{
   const client=new OpenAI({apiKey:key,baseURL:provider==='openrouter'?'https://openrouter.ai/api/v1':undefined,timeout:9000,maxRetries:0,defaultHeaders:provider==='openrouter'?{'HTTP-Referer':process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000','X-Title':'TaliKhata Voice V2'}:undefined});
   const payload={model,messages:[{role:'system',content:SYSTEM},{role:'user',content:t}],temperature:0};
   let r:any;
   try{
    r=await client.chat.completions.create({...payload,response_format:{type:'json_schema',json_schema:{name:'talikhata_voice_v2',strict:true,schema:VoiceV2JsonSchema}}} as any);
   }catch(structuredError){
    r=await client.chat.completions.create({...payload,response_format:{type:'json_object'}} as any);
   }
   const raw=r.choices[0]?.message?.content||'';
   return VoiceV2Schema.parse(JSON.parse(raw));
  }catch(e){last=e instanceof Error?e.message:'provider failed';}
 }
 throw new VoiceV2Error('AI_UNAVAILABLE','Voice AI providers are temporarily unavailable. Please try again.',{cause:last});
}
export async function parseVoiceV2(t:string){return localParse(t)??await aiParse(t);}

async function findParty(uid:string,name:string,session:any,type?:'CUSTOMER'|'SUPPLIER'){
 const all=await resolveParty(uid,name,session), rows=type?all.filter((p:any)=>p.partyType===type):all;
 if(!rows.length)throw new VoiceV2Error('NOT_FOUND',`${type==='SUPPLIER'?'Supplier':'Customer'} "${name}" was not found`,{name});
 if(rows.length>1)throw new VoiceV2Error('AMBIGUOUS_ENTITY',`Multiple parties matched "${name}"`,{matches:rows.slice(0,10).map((p:any)=>({id:String(p._id),name:p.name,phone:p.phone||null,balance:p.currentBalance}))});
 return rows[0];
}
async function requireAdmin(userId:string){const u=await User.findById(userId).select('role status').lean();if(!u||u.status!=='ACTIVE'||u.role!=='ADMIN')throw new VoiceV2Error('FORBIDDEN','Admin permission is required for user management.');return u;}
async function findProduct(uid:string,name:string,session:any){const rows=await resolveProduct(uid,name,session);if(!rows.length)throw new VoiceV2Error('NOT_FOUND',`Product "${name}" was not found`,{name});if(rows.length>1)throw new VoiceV2Error('AMBIGUOUS_ENTITY',`Multiple products matched "${name}"`,{matches:rows.slice(0,10).map((p:any)=>({id:String(p._id),name:p.name,stock:p.stockQuantity,unit:p.unit}))});return rows[0];}
function confirm(c:VoiceV2Command,yes:boolean){if((c.confirmRequired||['DELETE_PARTY','DELETE_PRODUCT','DELETE_TRANSACTION'].includes(c.action))&&!yes)throw new VoiceV2Error('CONFIRMATION_REQUIRED','এই কাজটি করার আগে confirmation প্রয়োজন।');}

export async function executeVoiceV2(c0:VoiceV2Command,userId:string,transcript='',confirmed=false,commandId?:string){
 const sUser=await auth();if(!sUser?.user?.id||sUser.user.id!==userId)throw new VoiceV2Error('UNAUTHORIZED','Unauthorized');
 if(!Types.ObjectId.isValid(userId))throw new VoiceV2Error('UNAUTHORIZED','Invalid user');
 const c=VoiceV2Schema.parse(c0);confirm(c,confirmed);await connectDB();const uid=new Types.ObjectId(userId);
 if(commandId){const old=await AuditLog.findOne({userId:uid,commandId,status:'SUCCESS'}).lean();if(old?.result)return old.result;}
 if(c.action==='READ_BALANCE'){if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Customer name is required');const p=await findParty(userId,c.entityName,null,'CUSTOMER');const b=money(p.currentBalance);return {type:'READ_BALANCE',party:{id:String(p._id),name:p.name,phone:p.phone||null},balance:b,receivable:Math.max(0,b),payable:Math.max(0,-b)};}
 if(['READ_PARTY','READ_PRODUCT','LIST_PARTIES','LIST_PRODUCTS','LIST_TRANSACTIONS','READ_USER','LIST_USERS'].includes(c.action)){
  if(c.action==='READ_PARTY'){if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Party name is required');return {type:'READ_PARTY',party:await findParty(userId,c.entityName,null,c.partyType||undefined)};}
  if(c.action==='READ_PRODUCT'){if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Product name is required');return {type:'READ_PRODUCT',product:await findProduct(userId,c.entityName,null)};}
  if(c.action==='READ_USER'){await requireAdmin(userId);const u=await User.findOne(c.query?{email:c.query.toLowerCase(),_id:{$ne:uid}}:{_id:c.targetId&&Types.ObjectId.isValid(c.targetId)?new Types.ObjectId(c.targetId):uid}).select('-password').lean();if(!u)throw new VoiceV2Error('NOT_FOUND','User was not found');return {type:'READ_USER',user:u};}
  if(c.action==='LIST_USERS'){await requireAdmin(userId);const rows=await User.find({}).select('-password').sort({createdAt:-1}).limit(200).lean();return {type:'LIST_USERS',items:rows};}
  if(c.action==='LIST_PARTIES'){const q:any={userId:uid};if(c.partyType)q.partyType=c.partyType;const rows=await Party.find(q).sort({name:1}).limit(200).lean();return {type:'LIST_PARTIES',items:rows.map((p:any)=>({id:String(p._id),name:p.name,phone:p.phone||null,partyType:p.partyType,balance:p.currentBalance}))};}
  if(c.action==='LIST_PRODUCTS'){return {type:'LIST_PRODUCTS',items:await Product.find({userId:uid}).sort({name:1}).limit(200).lean()};}
  return {type:'LIST_TRANSACTIONS',items:await Transaction.find({userId:uid,isDeleted:{$ne:true}}).sort({timestamp:-1}).limit(100).lean()};
 }
 const session=await Party.startSession();let result:any;
 try{
  await session.withTransaction(async()=>{
   if(c.action==='CREATE_USER'||c.action==='UPDATE_USER'||c.action==='DELETE_USER'){
    await requireAdmin(userId);
    if(c.action==='CREATE_USER'){
      const email=clean(c.query)?.toLowerCase();if(!c.entityName||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new VoiceV2Error('INVALID_USER','Name and valid email are required');
      const dup=await User.findOne({email}).session(session);if(dup)throw new VoiceV2Error('DUPLICATE_ENTITY','A user with this email already exists');
      const [u]=await User.create([{name:c.entityName,email,phone:c.phone||undefined,role:c.partyType==='SUPPLIER'?'USER':'USER',status:'ACTIVE'}],{session});result={type:'CREATE_USER',user:{id:String(u._id),name:u.name,email:u.email,phone:u.phone||null,role:u.role,status:u.status}};
    }else{
      const target=c.query?.toLowerCase();const filter:any=target?{email:target}:{_id:c.targetId&&Types.ObjectId.isValid(c.targetId)?new Types.ObjectId(c.targetId):null};if(!filter._id&&!filter.email)throw new VoiceV2Error('MISSING_ENTITY','User email or id is required');
      const u=await User.findOne(filter).session(session);if(!u)throw new VoiceV2Error('NOT_FOUND','User was not found');if(String(u._id)===userId&&c.action==='DELETE_USER')throw new VoiceV2Error('DELETE_BLOCKED','You cannot delete your own account by voice.');
      if(c.action==='UPDATE_USER'){const set:any={};if(c.entityName)set.name=c.entityName;if(c.phone)set.phone=c.phone;if(c.notes&&['ACTIVE','SUSPENDED'].includes(c.notes))set.status=c.notes;if(c.partyType==='CUSTOMER')set.role='USER';if(!Object.keys(set).length)throw new VoiceV2Error('INVALID_UPDATE','No user fields to update');const updated=await User.findOneAndUpdate({_id:u._id},{$set:set},{new:true,session}).select('-password').lean();result={type:'UPDATE_USER',user:updated};}
      else{const hasData=await Promise.all([Party.exists({userId:u._id}).session(session),Product.exists({userId:u._id}).session(session),Transaction.exists({userId:u._id}).session(session)]);if(hasData.some(Boolean))throw new VoiceV2Error('DELETE_BLOCKED','This user owns ledger data and cannot be deleted safely.');await User.deleteOne({_id:u._id},{session});result={type:'DELETE_USER',id:String(u._id),email:u.email};}
    }
   }else if(c.action==='CREATE_PARTY'){
    if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Party name is required');
    const pt=c.partyType||'CUSTOMER';const dup=await Party.findOne({userId:uid,name:new RegExp('^'+c.entityName.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&')+'$','i')}).session(session);if(dup)throw new VoiceV2Error('DUPLICATE_ENTITY',`A party named "${c.entityName}" already exists`,{matches:[{id:String(dup._id),name:dup.name,phone:dup.phone||null,balance:dup.currentBalance}]});
    const [p]=await Party.create([{userId:uid,name:c.entityName,phone:c.phone||undefined,partyType:pt,currentBalance:0}],{session});result={type:'CREATE_PARTY',id:String(p._id),name:p.name,phone:p.phone||null,partyType:p.partyType,balance:0};
   }else if(c.action==='UPDATE_PARTY'){
    if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Party name is required');const p=await findParty(userId,c.entityName,session,c.partyType||undefined);const set:any={};if(c.phone)set.phone=c.phone;if(c.query)set.name=c.query;if(!Object.keys(set).length)throw new VoiceV2Error('INVALID_UPDATE','No party fields to update');result={type:'UPDATE_PARTY',party:await Party.findOneAndUpdate({_id:p._id,userId:uid},{$set:set},{new:true,session}).lean()};
   }else if(c.action==='DELETE_PARTY'){
    if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Party name is required');const p=await findParty(userId,c.entityName,session,c.partyType||undefined);if(await Transaction.exists({userId:uid,partyId:p._id}).session(session))throw new VoiceV2Error('DELETE_BLOCKED','This party has transaction history and cannot be deleted safely.');await Party.deleteOne({_id:p._id,userId:uid},{session});result={type:'DELETE_PARTY',id:String(p._id),name:p.name};
   }else if(c.action==='CREATE_PRODUCT'){
    if(!c.entityName||!c.unit)throw new VoiceV2Error('INVALID_PRODUCT','Product name and unit are required');const dup=await Product.findOne({userId:uid,name:new RegExp('^'+c.entityName.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&')+'$','i')}).session(session);if(dup)throw new VoiceV2Error('DUPLICATE_ENTITY',`Product "${c.entityName}" already exists`);const [p]=await Product.create([{userId:uid,name:c.entityName,unit:c.unit,stockQuantity:num(c.quantity),buyPrice:num(c.unitPrice),sellPrice:0,lowStockThreshold:5}],{session});result={type:'CREATE_PRODUCT',id:String(p._id),name:p.name,unit:p.unit,stock:p.stockQuantity,buyPrice:p.buyPrice,sellPrice:p.sellPrice};
   }else if(c.action==='UPDATE_PRODUCT'){
    if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Product name is required');const p=await findProduct(userId,c.entityName,session);const set:any={};if(c.unit)set.unit=c.unit;if(c.unitPrice!==null)set.buyPrice=num(c.unitPrice);if(c.query)set.name=c.query;if(!Object.keys(set).length)throw new VoiceV2Error('INVALID_UPDATE','No product fields to update');result={type:'UPDATE_PRODUCT',product:await Product.findOneAndUpdate({_id:p._id,userId:uid},{$set:set},{new:true,session}).lean()};
   }else if(c.action==='DELETE_PRODUCT'){
    if(!c.entityName)throw new VoiceV2Error('MISSING_ENTITY','Product name is required');const p=await findProduct(userId,c.entityName,session);if(await Transaction.exists({userId:uid,productId:p._id}).session(session))throw new VoiceV2Error('DELETE_BLOCKED','This product has transaction history and cannot be deleted safely.');await Product.deleteOne({_id:p._id,userId:uid},{session});result={type:'DELETE_PRODUCT',id:String(p._id),name:p.name};
   }else if(c.action==='CREATE_DUE'||c.action==='RECEIVE_PAYMENT'){
    if(!c.entityName||!c.amount||c.amount<=0)throw new VoiceV2Error('INVALID_TRANSACTION','Customer and positive amount are required');const p=await findParty(userId,c.entityName,session,'CUSTOMER');const tx=await createTransaction({type:c.action==='CREATE_DUE'?'DUE_GIVEN':'DUE_RECEIVED',partyId:String(p._id),amount:c.amount,quantity:0,notes:c.notes||undefined},userId,session);result={type:c.action,amount:c.amount,party:{id:String(p._id),name:p.name},transaction:tx};
   }else if(c.action==='STOCK_IN'||c.action==='STOCK_OUT'){
    if(!c.entityName||!c.quantity||c.quantity<=0)throw new VoiceV2Error('INVALID_STOCK','Product and positive quantity are required');const p=await findProduct(userId,c.entityName,session);const tx=await createTransaction({type:c.action==='STOCK_IN'?'STOCK_IN':'STOCK_OUT',productId:String(p._id),amount:money(num(c.quantity)*num(c.unitPrice)),quantity:c.quantity,unitPrice:c.unitPrice??undefined,notes:c.notes||undefined},userId,session);const fresh=await Product.findById(p._id).session(session).lean();result={type:c.action,product:{id:String(p._id),name:p.name,unit:p.unit},quantity:c.quantity,stock:num(fresh?.stockQuantity),transaction:tx};
   }else if(c.action==='CREATE_SALE'||c.action==='CREATE_PURCHASE'){
    if(!c.entityName||!c.quantity||c.quantity<=0||!c.unitPrice||c.unitPrice<=0)throw new VoiceV2Error('INVALID_TRADE','Product, quantity and unit price are required');
    const p=await findProduct(userId,c.entityName,session);
    const total=money(c.quantity*c.unitPrice),paid=num(c.paidAmount);
    if(paid>total)throw new VoiceV2Error('INVALID_PAYMENT','Paid amount cannot exceed total amount');
    if(c.action==='CREATE_SALE'){
      let partyId:string|undefined;
      if(c.query){const customer=await findParty(userId,c.query,session,'CUSTOMER');partyId=String(customer._id);}
      const tx=await createTransaction({type:'SALE',partyId,productId:String(p._id),amount:total,quantity:c.quantity,unitPrice:c.unitPrice,paidAmount:paid,notes:c.notes||undefined},userId,session);
      result={type:'CREATE_SALE',product:p.name,total,paidAmount:paid,due:money(total-paid),transaction:tx};
    }else{
      if(!c.query)throw new VoiceV2Error('PARTY_REQUIRED','Supplier name is required for a purchase');
      const supplier=await findParty(userId,c.query,session,'SUPPLIER');
      const tx=await createTransaction({type:'STOCK_IN',partyId:String(supplier._id),productId:String(p._id),amount:total,quantity:c.quantity,unitPrice:c.unitPrice,paidAmount:paid,notes:c.notes||undefined},userId,session);
      const due=money(total-paid);
      if(due>0)await Party.updateOne({_id:supplier._id,userId:uid},{$inc:{currentBalance:-due}},{session});
      result={type:'CREATE_PURCHASE',product:p.name,supplier:supplier.name,total,paidAmount:paid,due,transaction:tx};
    }
   }else if(c.action==='CREATE_EXPENSE'){
    if(!c.amount||c.amount<=0)throw new VoiceV2Error('INVALID_EXPENSE','Positive expense amount is required');const tx=await createTransaction({type:'EXPENSE',amount:c.amount,quantity:0,notes:c.notes||transcript},userId,session);result={type:'CREATE_EXPENSE',amount:c.amount,transaction:tx};
   }else if(c.action==='DELETE_TRANSACTION'){
    if(!c.targetId||!Types.ObjectId.isValid(c.targetId))throw new VoiceV2Error('MISSING_ENTITY','Valid transaction id is required');result={type:'DELETE_TRANSACTION',reversal:await reverseTransaction(c.targetId,userId,session)};
   }else throw new VoiceV2Error('UNSUPPORTED_ACTION',`Action ${c.action} is not implemented yet.`);
  },{readConcern:{level:'local'},writeConcern:{w:'majority'},maxCommitTimeMS:10000});
 }catch(e){if(e instanceof VoiceV2Error)throw e;if(e instanceof TransactionServiceError)throw new VoiceV2Error(e.code,e.message,e.details);throw e;}finally{await session.endSession();}
 if(commandId)await AuditLog.create({userId:uid,voiceTranscript:transcript,parsedIntent:c,status:'SUCCESS',commandId,result}).catch(()=>{});
 return result;
}
