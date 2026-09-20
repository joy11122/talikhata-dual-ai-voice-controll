import mongoose,{Schema,Types} from 'mongoose';
export interface IShop extends mongoose.Document{_id:Types.ObjectId;userId:Types.ObjectId;shopName:string;currency:string;createdAt:Date}
const S=new Schema<IShop>({userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true,unique:true},shopName:{type:String,required:true,trim:true,maxlength:160},currency:{type:String,default:'BDT / ৳'}},{timestamps:true,versionKey:false});
const Shop=(mongoose.models.Shop as mongoose.Model<IShop>)||mongoose.model<IShop>('Shop',S);export default Shop;
