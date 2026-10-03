import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import {Types} from 'mongoose';
import {ProductInputSchema} from '@/lib/validations/domain';

const escapeRegex=(value:string)=>value.replace(/[.*+?^{}()|[\\]\\]/g,'\\$&');

export async function GET(req:Request){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  await connectDB();
  const url=new URL(req.url);
  const q=url.searchParams.get('q');
  const filter:any={userId:new Types.ObjectId(s.user.id),isDeleted:false};
  if(q){
    const rx=new RegExp(escapeRegex(q),'i');
    filter.$or=[{name:rx},{category:rx},{brand:rx},{sku:rx},{barcode:rx}];
  }
  return NextResponse.json(await Product.find(filter).sort({name:1}).lean());
}

export async function POST(req:Request){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  let body:unknown;
  try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
  const p=ProductInputSchema.safeParse(body);
  if(!p.success)return NextResponse.json({error:p.error.flatten()},{status:422});
  await connectDB();
  const uid=new Types.ObjectId(s.user.id);
  const data={...p.data};
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
  if(data.variants.length){
    data.stockQuantity=data.variants.reduce((sum,v)=>sum+v.stockQuantity,0);
    if(!data.sellPrice)data.sellPrice=data.variants[0]?.sellPrice||0;
    if(!data.buyPrice)data.buyPrice=data.variants[0]?.buyPrice||0;
  }
  const duplicate=await Product.findOne({userId:uid,isDeleted:false,name:new RegExp('^'+escapeRegex(data.name)+'$','i')});
  if(duplicate)return NextResponse.json({error:'Product already exists'},{status:409});
  if(data.sku){
    const duplicateSku=await Product.findOne({userId:uid,isDeleted:false,sku:data.sku});
    if(duplicateSku)return NextResponse.json({error:'SKU already exists'},{status:409});
  }
  if(data.barcode){
    const duplicateBarcode=await Product.findOne({userId:uid,isDeleted:false,barcode:data.barcode});
    if(duplicateBarcode)return NextResponse.json({error:'Barcode already exists'},{status:409});
  }
  const session=await Product.startSession();
  try{
    let created:any;
    await session.withTransaction(async()=>{
      const [product]=await Product.create([{...data,userId:uid}],{session});
      if(product.trackStock&&product.stockQuantity>0&&!product.variants.length){
        await Transaction.create([{userId:uid,productId:product._id,type:'STOCK_IN',amount:product.stockQuantity*product.buyPrice,quantity:product.stockQuantity,unitPrice:product.buyPrice||undefined,notes:'Opening stock'}],{session});
      }else if(product.trackStock&&product.stockQuantity>0&&product.variants.length){
        await Transaction.create([{userId:uid,productId:product._id,type:'STOCK_IN',amount:product.stockQuantity*product.buyPrice,quantity:product.stockQuantity,unitPrice:product.buyPrice||undefined,notes:'Opening stock (variants)'}],{session});
      }
      created=product.toObject();
    });
    return NextResponse.json(created,{status:201});
  }finally{await session.endSession()}
}
