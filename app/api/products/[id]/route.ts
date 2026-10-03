import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import {Types} from 'mongoose';
import {ProductPatchSchema} from '@/lib/validations/domain';

const escapeRegex=(value:string)=>value.replace(/[.*+?^{}()|[\\]\\]/g,'\\$&');

export async function GET(_:Request,{params}:{params:{id:string}}){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!Types.ObjectId.isValid(params.id))return NextResponse.json({error:'Invalid id'},{status:400});
  await connectDB();
  const uid=new Types.ObjectId(s.user.id);
  const row=await Product.findOne({_id:new Types.ObjectId(params.id),userId:uid,isDeleted:false}).lean();
  if(!row)return NextResponse.json({error:'Not found'},{status:404});
  const transactions=await Transaction.find({userId:uid,productId:row._id}).sort({timestamp:-1}).limit(100).lean();
  return NextResponse.json({product:row,transactions});
}

export async function PATCH(req:Request,{params}:{params:{id:string}}){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!Types.ObjectId.isValid(params.id))return NextResponse.json({error:'Invalid id'},{status:400});
  let body:unknown;
  try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
  const parsed=ProductPatchSchema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:parsed.error.flatten()},{status:422});
  await connectDB();
  const uid=new Types.ObjectId(s.user.id);
  const id=new Types.ObjectId(params.id);
  const existing=await Product.findOne({_id:id,userId:uid});
  if(!existing)return NextResponse.json({error:'Not found'},{status:404});
  const linked=await Transaction.exists({userId:uid,productId:id});
  if(linked&&parsed.data.stockQuantity!==undefined&&parsed.data.stockQuantity!==existing.stockQuantity&&!parsed.data.variants){
    return NextResponse.json({error:'Stock quantity cannot be edited directly after transaction history exists. Use stock-in or stock-out transactions.'},{status:409});
  }
  if(parsed.data.name){
    const dup=await Product.findOne({_id:{$ne:id},userId:uid,name:new RegExp('^'+escapeRegex(parsed.data.name)+'$','i')});
    if(dup)return NextResponse.json({error:'Product already exists'},{status:409});
  }
  if(parsed.data.sku){
    const dup=await Product.findOne({_id:{$ne:id},userId:uid,sku:parsed.data.sku});
    if(dup)return NextResponse.json({error:'SKU already exists'},{status:409});
  }
  if(parsed.data.barcode){
    const dup=await Product.findOne({_id:{$ne:id},userId:uid,barcode:parsed.data.barcode});
    if(dup)return NextResponse.json({error:'Barcode already exists'},{status:409});
  }
  const data:any={...parsed.data};
  if(Array.isArray(data.variants)){
    const variantKeys=new Set<string>();
    for(const variant of data.variants){
      const sku=variant.sku?.trim().toLowerCase();
      const barcode=variant.barcode?.trim();
      if(sku){
        if(variantKeys.has('sku:'+sku))return NextResponse.json({error:'Variant SKU must be unique within this product'},{status:409});
        variantKeys.add('sku:'+sku);
      }
      if(barcode){
        if(variantKeys.has('barcode:'+barcode))return NextResponse.json({error:'Variant barcode must be unique within this product'},{status:409});
        variantKeys.add('barcode:'+barcode);
      }
    }
    if(linked){
      const incoming=data.variants.map((v:any)=>({id:v._id||'',stock:Number(v.stockQuantity||0)}));
      const existingVariants=(existing.variants||[]).map((v:any)=>({id:String(v._id),stock:Number(v.stockQuantity||0)}));
      if(incoming.length!==existingVariants.length || incoming.some((v:any)=>!existingVariants.some((e:any)=>e.id===v.id&&e.stock===v.stock))){
        return NextResponse.json({error:'Variant stock cannot be edited directly after transaction history exists. Use stock-in or stock-out transactions.'},{status:409});
      }
    }
  }
  if(Array.isArray(data.variants)&&data.variants.length){
    data.stockQuantity=data.variants.reduce((sum:number,v:any)=>sum+Number(v.stockQuantity||0),0);
    if(data.sellPrice===undefined)data.sellPrice=data.variants[0]?.sellPrice||0;
    if(data.buyPrice===undefined)data.buyPrice=data.variants[0]?.buyPrice||0;
  }
  const row=await Product.findOneAndUpdate({_id:id,userId:uid,isDeleted:false},{$set:data},{new:true,runValidators:true}).lean();
  return row?NextResponse.json(row):NextResponse.json({error:'Not found'},{status:404});
}

export async function DELETE(_:Request,{params}:{params:{id:string}}){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!Types.ObjectId.isValid(params.id))return NextResponse.json({error:'Invalid id'},{status:400});
  await connectDB();
  const uid=new Types.ObjectId(s.user.id);
  const row=await Product.findOne({_id:new Types.ObjectId(params.id),userId:uid});
  if(!row)return NextResponse.json({error:'Not found'},{status:404});
  const linked=await Transaction.countDocuments({userId:uid,productId:row._id,isDeleted:false});
  if(linked)return NextResponse.json({error:'Cannot delete a product with transaction history. Keep it for inventory integrity.'},{status:409});
  await Product.updateOne({_id:row._id,userId:uid},{$set:{isDeleted:true,deletedAt:new Date(),deletedBy:uid}});
  return NextResponse.json({ok:true});
}
