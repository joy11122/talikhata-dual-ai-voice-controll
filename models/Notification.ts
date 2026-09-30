import mongoose,{Schema,Types} from 'mongoose';

export interface INotification extends mongoose.Document{
  _id:Types.ObjectId;
  userId:Types.ObjectId;
  type:string;
  title:string;
  message:string;
  read:boolean;
  metadata?:Record<string,unknown>;
  createdAt:Date;
}

const S=new Schema<INotification>({
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  type:{type:String,required:true,index:true},
  title:{type:String,required:true,maxlength:160},
  message:{type:String,required:true,maxlength:2000},
  read:{type:Boolean,default:false,index:true},
  metadata:{type:Schema.Types.Mixed},
},{timestamps:{createdAt:true,updatedAt:false},versionKey:false});
S.index({userId:1,createdAt:-1});
export default (mongoose.models.Notification as mongoose.Model<INotification>)||mongoose.model<INotification>('Notification',S);
