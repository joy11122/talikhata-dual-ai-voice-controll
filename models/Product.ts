import mongoose,{Schema,Types} from 'mongoose';

export type ProductAttributeValue=string|number|boolean;

export interface IProductVariant{
  _id?:Types.ObjectId;
  name:string;
  sku?:string;
  barcode?:string;
  attributes:Record<string,ProductAttributeValue>;
  stockQuantity:number;
  buyPrice:number;
  sellPrice:number;
}

export interface IProduct extends mongoose.Document{
  _id:Types.ObjectId;
  userId:Types.ObjectId;
  name:string;
  category?:string;
  brand?:string;
  sku?:string;
  barcode?:string;
  unit:string;
  stockQuantity:number;
  buyPrice:number;
  sellPrice:number;
  lowStockThreshold:number;
  trackStock:boolean;
  attributes:Record<string,ProductAttributeValue>;
  variants:IProductVariant[];
  createdAt:Date;
}

const VariantSchema=new Schema<IProductVariant>({
  name:{type:String,required:true,trim:true,maxlength:120},
  sku:{type:String,trim:true,maxlength:80},
  barcode:{type:String,trim:true,maxlength:80},
  attributes:{type:Schema.Types.Mixed,default:{}},
  stockQuantity:{type:Number,default:0,min:0},
  buyPrice:{type:Number,default:0,min:0},
  sellPrice:{type:Number,default:0,min:0},
},{_id:true});

const S=new Schema<IProduct>({
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  name:{type:String,required:true,trim:true,maxlength:150},
  category:{type:String,trim:true,maxlength:100},
  brand:{type:String,trim:true,maxlength:100},
  sku:{type:String,trim:true,maxlength:80},
  barcode:{type:String,trim:true,maxlength:80},
  unit:{type:String,required:true,trim:true,maxlength:30},
  stockQuantity:{type:Number,default:0,min:0},
  buyPrice:{type:Number,default:0,min:0},
  sellPrice:{type:Number,default:0,min:0},
  lowStockThreshold:{type:Number,default:5,min:0},
  trackStock:{type:Boolean,default:true},
  attributes:{type:Schema.Types.Mixed,default:{}},
  variants:{type:[VariantSchema],default:[]},
},{timestamps:true,versionKey:false});

S.index({name:'text',category:'text',brand:'text',sku:'text',barcode:'text'});
S.index({userId:1,name:1},{unique:true});
S.index({userId:1,lowStockThreshold:1,stockQuantity:1});
S.index({userId:1,sku:1},{unique:true,partialFilterExpression:{sku:{$type:'string'}}});
S.index({userId:1,barcode:1},{unique:true,sparse:true});

const Product=(mongoose.models.Product as mongoose.Model<IProduct>)||mongoose.model<IProduct>('Product',S);
export default Product;
