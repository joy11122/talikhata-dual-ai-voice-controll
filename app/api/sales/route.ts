import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {createSale} from "@/services/businessService";
import {connectDB} from "@/lib/db";
import Transaction from "@/models/Transaction";
import {Types} from "mongoose";
import {z} from "zod";

const SaleSchema=z.object({
  partyId:z.string().nullable().optional(),
  productId:z.string().min(1),
  variantId:z.string().nullable().optional(),
  quantity:z.coerce.number().finite().positive(),
  unitPrice:z.coerce.number().finite().positive(),
  paidAmount:z.coerce.number().finite().min(0),
  notes:z.string().max(500).optional(),
});

export async function GET(req:Request){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  await connectDB();
  const u=new URL(req.url);
  const rows=await Transaction.find({userId:new Types.ObjectId(s.user.id),type:"SALE"})
    .sort({timestamp:-1})
    .limit(Math.min(Number(u.searchParams.get("limit")||100),200))
    .populate("partyId","name")
    .populate("productId","name unit variants")
    .lean();
  return NextResponse.json(rows);
}

export async function POST(req:Request){
  const s=await auth();
  if(!s?.user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const v=SaleSchema.parse(await req.json());
    const r=await createSale(s.user.id,v);
    return NextResponse.json({ok:true,result:r},{status:201});
  }catch(e:any){
    const status=e.code==="INSUFFICIENT_STOCK"?409:e.code==="PARTY_REQUIRED"||e.code==="VARIANT_REQUIRED"?422:400;
    return NextResponse.json({error:e.message,code:e.code},{status});
  }
}
