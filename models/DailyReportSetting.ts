import mongoose,{Schema,Types} from 'mongoose';

export interface IDailyReportSetting extends mongoose.Document{
  _id:Types.ObjectId;
  userId:Types.ObjectId;
  enabled:boolean;
  sendTime:string;
  timezone:string;
  emailEnabled:boolean;
  inAppEnabled:boolean;
  lastSentDate?:string;
  createdAt:Date;
  updatedAt:Date;
}

const S=new Schema<IDailyReportSetting>({
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true,unique:true},
  enabled:{type:Boolean,default:false},
  sendTime:{type:String,default:'21:00',match:/^(?:[01]\d|2[0-3]):[0-5]\d$/},
  timezone:{type:String,default:'Asia/Dhaka',trim:true,maxlength:80},
  emailEnabled:{type:Boolean,default:true},
  inAppEnabled:{type:Boolean,default:true},
  lastSentDate:{type:String},
},{timestamps:true,versionKey:false});

export default (mongoose.models.DailyReportSetting as mongoose.Model<IDailyReportSetting>)||mongoose.model<IDailyReportSetting>('DailyReportSetting',S);
