import mongoose,{Schema,Types} from 'mongoose';

export type BackupSource='MANUAL'|'SCHEDULED';

export interface IBackup extends mongoose.Document{
  _id:Types.ObjectId; userId:Types.ObjectId; source:BackupSource; label:string;
  createdAt:Date; expiresAt?:Date;
  snapshot:{parties:unknown[];products:unknown[];transactions:unknown[]};
}

const S=new Schema<IBackup>({
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  source:{type:String,enum:['MANUAL','SCHEDULED'],required:true},
  label:{type:String,required:true,maxlength:120},
  snapshot:{type:Schema.Types.Mixed,required:true},
  expiresAt:{type:Date,index:true},
},{timestamps:true,versionKey:false});

S.index({userId:1,createdAt:-1});
const Backup=(mongoose.models.Backup as mongoose.Model<IBackup>)||mongoose.model<IBackup>('Backup',S);
export default Backup;
