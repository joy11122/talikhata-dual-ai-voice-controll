import mongoose,{Schema,Types} from 'mongoose';

export const BUSINESS_TYPES = [
  'GENERAL_RETAIL',
  'GROCERY',
  'CLOTHING',
  'ELECTRONICS',
  'PHARMACY',
  'RESTAURANT',
  'WHOLESALE',
  'SERVICE',
  'HARDWARE',
  'OTHER',
] as const;

export type BusinessType=(typeof BUSINESS_TYPES)[number];

export interface IShop extends mongoose.Document{
  _id:Types.ObjectId;
  userId:Types.ObjectId;
  shopName:string;
  currency:string;
  businessType:BusinessType;
  address?:string;
  createdAt:Date;
}

const S=new Schema<IShop>({
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true,unique:true},
  shopName:{type:String,required:true,trim:true,maxlength:160},
  currency:{type:String,default:'BDT / ৳'},
  businessType:{type:String,enum:BUSINESS_TYPES,default:'GENERAL_RETAIL',index:true},
  address:{type:String,trim:true,maxlength:240},
},{timestamps:true,versionKey:false});

const Shop=(mongoose.models.Shop as mongoose.Model<IShop>)||mongoose.model<IShop>('Shop',S);
export default Shop;
