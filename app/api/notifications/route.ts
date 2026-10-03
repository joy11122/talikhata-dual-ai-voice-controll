import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {connectDB} from '@/lib/db';
import Notification from '@/models/Notification';
import {Types} from 'mongoose';
import Product from '@/models/Product';
import Party from '@/models/Party';

export async function GET(){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  await connectDB();
  const uid=new Types.ObjectId(s.user.id);
  const products=await Product.find({userId:uid,isDeleted:false,trackStock:true,$expr:{$lte:['$stockQuantity','$lowStockThreshold']}}).select('_id name stockQuantity lowStockThreshold unit').lean();
  for(const product of products){
    const type=Number(product.stockQuantity)<=0?'OUT_OF_STOCK':'LOW_STOCK';
    const existing=await Notification.findOne({userId:uid,type,'metadata.productId':String(product._id),createdAt:{$gte:new Date(Date.now()-24*60*60*1000)}}).lean();
    if(!existing)await Notification.create({userId:uid,type,title:type==='OUT_OF_STOCK'?'পণ্য Stock শেষ':'পণ্য Low Stock',message:type==='OUT_OF_STOCK'?`${product.name} এর stock শেষ হয়ে গেছে। এখনই restock করুন।`:`${product.name} এর stock ${product.stockQuantity} ${product.unit} — threshold ${product.lowStockThreshold} ${product.unit}।`,metadata:{productId:String(product._id),stock:product.stockQuantity,threshold:product.lowStockThreshold}});
  }
  const dueCustomers=await Party.find({userId:uid,isDeleted:false,partyType:'CUSTOMER',currentBalance:{$gt:0}}).select('name currentBalance').sort({currentBalance:-1}).limit(5).lean();
  const dueTotal=dueCustomers.reduce((sum,p)=>sum+Number(p.currentBalance||0),0);
  const todayKey=new Date().toISOString().slice(0,10);
  if(dueCustomers.length&&!await Notification.findOne({userId:uid,type:'DUE_SUMMARY','metadata.date':todayKey}).lean()){
    const lines=dueCustomers.map(p=>`${p.name}: ৳${Number(p.currentBalance).toLocaleString('en-BD')}`).join(' • ');
    await Notification.create({userId:uid,type:'DUE_SUMMARY',title:'Customer due reminder',message:`মোট top due ৳${dueTotal.toLocaleString('en-BD')}। ${lines}`,metadata:{date:todayKey,total:dueTotal}});
  }
  const items=await Notification.find({userId:uid}).sort({createdAt:-1}).limit(30).lean();
  return NextResponse.json(items);
}

export async function PATCH(req:Request){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await req.json().catch(()=>({}));
  await connectDB();
  if(body.id)await Notification.updateOne({_id:body.id,userId:new Types.ObjectId(s.user.id)},{$set:{read:true}});
  else await Notification.updateMany({userId:new Types.ObjectId(s.user.id),read:false},{$set:{read:true}});
  return NextResponse.json({ok:true});
}