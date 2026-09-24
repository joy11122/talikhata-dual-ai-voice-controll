import { Types } from 'mongoose';
import { connectDB } from '@/lib/db';
import Party from '@/models/Party';
import Product from '@/models/Product';
import User from '@/models/User';
import Transaction from '@/models/Transaction';
import { resolveParty, resolveProduct } from '@/services/entityResolver';
import { createTransaction, reverseTransaction } from '@/services/transactionService';

export class VoiceV2Error extends Error {
  constructor(public code:string,message:string,public details?:unknown){super(message);}
}
const oid=(id:string)=>{if(!Types.ObjectId.isValid(id))throw new VoiceV2Error('INVALID_ID','Invalid id');return new Types.ObjectId(id);};
const num=(v:any,d=0)=>typeof v==='number'&&Number.isFinite(v)?v:d;
async function party(userId:string,name:string,type?:'CUSTOMER'|'SUPPLIER'){
  const xs=await resolveParty(userId,name); const ys=type?xs.filter((x:any)=>x.partyType===type):xs;
  if(!ys.length)throw new VoiceV2Error('NOT_FOUND','Party "'+name+'" was not found');
  if(ys.length>1)throw new VoiceV2Error('AMBIGUOUS_ENTITY','Multiple parties matched "'+name+'"',{matches:ys.slice(0,10).map((x:any)=>({id:String(x._id),name:x.name,phone:x.phone,balance:x.currentBalance,partyType:x.partyType}))});
  return ys[0];
}
async function product(userId:string,name:string){
  const xs=await resolveProduct(userId,name);
  if(!xs.length)throw new VoiceV2Error('NOT_FOUND','Product "'+name+'" was not found');
  if(xs.length>1)throw new VoiceV2Error('AMBIGUOUS_ENTITY','Multiple products matched "'+name+'"',{matches:xs.slice(0,10).map((x:any)=>({id:String(x._id),name:x.name,stock:x.stockQuantity,unit:x.unit}))});
  return xs[0];
}
export async function executeVoiceV2(name:string,args:any,userId:string,role:string,confirmed=false){
  await connectDB(); const uid=oid(userId);
  const destructive=['delete_party','delete_product','delete_transaction','delete_user'];
  if(destructive.includes(name)&&!confirmed)throw new VoiceV2Error('CONFIRMATION_REQUIRED','এই কাজটি করার আগে confirmation প্রয়োজন।',{tool:name,args});
  if(name.endsWith('_user')||name==='list_users'||name==='create_user'||name==='update_user')if(role!=='ADMIN')throw new VoiceV2Error('FORBIDDEN','User management requires admin permission.');
  switch(name){
    case 'create_party':{const existing=await Party.findOne({userId:uid,name:args.name,partyType:args.partyType});if(existing)throw new VoiceV2Error('DUPLICATE_ENTITY','Party "'+args.name+'" already exists');const p=await Party.create({userId:uid,name:args.name.trim(),phone:args.phone||undefined,partyType:args.partyType,currentBalance:0});return {type:name,id:String(p._id),name:p.name,partyType:p.partyType};}
    case 'get_party':
    case 'get_balance':{const p=await party(userId,args.name,args.partyType||undefined);const balance=num(p.currentBalance);return {type:name,party:{id:String(p._id),name:p.name,phone:p.phone||null,partyType:p.partyType},balance,receivable:Math.max(0,balance),payable:Math.max(0,-balance)};}
    case 'list_parties':return {type:name,items:await Party.find({userId:uid,...(args.partyType?{partyType:args.partyType}:{})}).sort({name:1}).limit(500).lean().then(xs=>xs.map((p:any)=>({id:String(p._id),name:p.name,phone:p.phone||null,partyType:p.partyType,balance:num(p.currentBalance)})))};
    case 'update_party':{const p=await party(userId,args.name);if(args.newName){const dup=await Party.findOne({userId:uid,name:args.newName,partyType:args.partyType||p.partyType,_id:{$ne:p._id}});if(dup)throw new VoiceV2Error('DUPLICATE_ENTITY','Another party already has that name.');p.name=args.newName;}if(args.phone!==null)p.phone=args.phone||undefined;if(args.partyType)p.partyType=args.partyType;await p.save();return {type:name,id:String(p._id),name:p.name,phone:p.phone||null,partyType:p.partyType};}
    case 'delete_party':{const p=await party(userId,args.name);const count=await Transaction.countDocuments({userId:uid,partyId:p._id,isDeleted:false});if(count)throw new VoiceV2Error('DELETE_BLOCKED','Cannot delete "'+p.name+'" because it has transaction history.');await Party.deleteOne({_id:p._id,userId:uid});return {type:name,deletedId:String(p._id),name:p.name};}
    case 'create_product':{const dup=await Product.findOne({userId:uid,name:args.name});if(dup)throw new VoiceV2Error('DUPLICATE_ENTITY','Product "'+args.name+'" already exists');const p=await Product.create({userId:uid,name:args.name.trim(),unit:args.unit||'pcs',stockQuantity:Math.max(0,num(args.stockQuantity)),buyPrice:Math.max(0,num(args.buyPrice)),sellPrice:Math.max(0,num(args.sellPrice)),lowStockThreshold:Math.max(0,num(args.lowStockThreshold,5))});return {type:name,id:String(p._id),name:p.name,stock:p.stockQuantity,unit:p.unit};}
    case 'get_product':{const p=await product(userId,args.name);return {type:name,product:{id:String(p._id),name:p.name,unit:p.unit,stock:p.stockQuantity,buyPrice:p.buyPrice,sellPrice:p.sellPrice}};}
    case 'list_products':return {type:name,items:await Product.find({userId:uid}).sort({name:1}).limit(500).lean().then(xs=>xs.map((p:any)=>({id:String(p._id),name:p.name,unit:p.unit,stock:p.stockQuantity,buyPrice:p.buyPrice,sellPrice:p.sellPrice})))};
    case 'update_product':{const p=await product(userId,args.name);if(args.newName!==null&&args.newName!==undefined)p.name=args.newName;if(args.unit!==null&&args.unit!==undefined)p.unit=args.unit;if(args.stockQuantity!==null&&args.stockQuantity!==undefined)p.stockQuantity=Math.max(0,args.stockQuantity);if(args.buyPrice!==null&&args.buyPrice!==undefined)p.buyPrice=Math.max(0,args.buyPrice);if(args.sellPrice!==null&&args.sellPrice!==undefined)p.sellPrice=Math.max(0,args.sellPrice);if(args.lowStockThreshold!==null&&args.lowStockThreshold!==undefined)p.lowStockThreshold=Math.max(0,args.lowStockThreshold);await p.save();return {type:name,id:String(p._id),name:p.name,unit:p.unit,stock:p.stockQuantity,buyPrice:p.buyPrice,sellPrice:p.sellPrice};}
    case 'delete_product':{const p=await product(userId,args.name);const count=await Transaction.countDocuments({userId:uid,productId:p._id,isDeleted:false});if(count)throw new VoiceV2Error('DELETE_BLOCKED','Cannot delete "'+p.name+'" because it has transaction history.');await Product.deleteOne({_id:p._id,userId:uid});return {type:name,deletedId:String(p._id),name:p.name};}
    case 'create_transaction':{let partyId:string|undefined,productId:string|undefined;if(args.partyName){const p=await party(userId,args.partyName,args.type==='SALE'||args.type.startsWith('DUE_')?'CUSTOMER':undefined);partyId=String(p._id);}if(args.productName){const p=await product(userId,args.productName);productId=String(p._id);}const tx=await createTransaction({type:args.type,partyId,productId,amount:Math.max(0,num(args.amount)),paidAmount:Math.max(0,num(args.paidAmount)),quantity:Math.max(0,num(args.quantity)),unitPrice:args.unitPrice===null?undefined:Math.max(0,num(args.unitPrice)),notes:args.notes||undefined},userId);return {type:name,...tx};}
    case 'search_transactions':{const q=String(args.query||'').trim();const filter:any={userId:uid,isDeleted:false};if(q){const ps=await resolveParty(userId,q);if(ps.length===1)filter.partyId=ps[0]._id;else filter.notes={$regex:q.replace(/[^\p{L}\p{N}\s]/gu,''),'i'};}const xs=await Transaction.find(filter).sort({timestamp:-1}).limit(Math.min(100,Math.max(1,num(args.limit,20)))).lean();return {type:name,items:xs.map((t:any)=>({id:String(t._id),type:t.type,amount:t.amount,quantity:t.quantity,timestamp:t.timestamp,partyId:t.partyId?String(t.partyId):null,productId:t.productId?String(t.productId):null,notes:t.notes||null}))};}
    case 'delete_transaction':{let t:any=null;if(args.id)t=await Transaction.findOne({_id:oid(args.id),userId:uid,isDeleted:false});else{const f:any={userId:uid,isDeleted:false};if(args.partyName){const p=await party(userId,args.partyName);f.partyId=p._id;}if(args.amount!==null&&args.amount!==undefined)f.amount=args.amount;t=await Transaction.findOne(f).sort({timestamp:-1});}if(!t)throw new VoiceV2Error('NOT_FOUND','Transaction not found.');return reverseTransaction(String(t._id),userId).then(r=>({type:name,...r}));}
    case 'list_users':return {type:name,items:await User.find().sort({createdAt:-1}).limit(500).select('name email phone role status createdAt').lean().then(xs=>xs.map((u:any)=>({_id:String(u._id),name:u.name,email:u.email,phone:u.phone||null,role:u.role,status:u.status})))};
    case 'create_user':{const email=String(args.email).trim().toLowerCase();if(await User.findOne({email}))throw new VoiceV2Error('DUPLICATE_ENTITY','A user with that email already exists.');const u=await User.create({name:args.name.trim(),email,phone:args.phone||undefined,role:args.role,status:args.status});return {type:name,user:{id:String(u._id),name:u.name,email:u.email,phone:u.phone||null,role:u.role,status:u.status}};}
    case 'update_user':{const u=await User.findOne({email:String(args.email).trim().toLowerCase()});if(!u)throw new VoiceV2Error('NOT_FOUND','User not found.');if(String(u._id)===userId)throw new VoiceV2Error('PROTECTED','You cannot modify the current admin through voice.');if(args.name!==null)u.name=args.name||u.name;if(args.phone!==null)u.phone=args.phone||undefined;if(args.status!==null)u.status=args.status||u.status;if(args.role!==null)u.role=args.role||u.role;await u.save();return {type:name,user:{id:String(u._id),name:u.name,email:u.email,phone:u.phone||null,role:u.role,status:u.status}};}
    case 'delete_user':{const u=await User.findOne({email:String(args.email).trim().toLowerCase()});if(!u)throw new VoiceV2Error('NOT_FOUND','User not found.');if(String(u._id)===userId)throw new VoiceV2Error('PROTECTED','You cannot delete yourself.');await User.deleteOne({_id:u._id});return {type:name,deletedId:String(u._id),email:u.email};}
    default:throw new VoiceV2Error('UNSUPPORTED_TOOL','Unsupported voice tool: '+name);
  }
}