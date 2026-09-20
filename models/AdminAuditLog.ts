import mongoose,{Schema,Types} from 'mongoose';
export type AdminAction='USER_STATUS_CHANGED'|'ADMIN_SEARCH'|'SYSTEM_CHECK';
export interface IAdminAuditLog extends mongoose.Document{adminId:Types.ObjectId;action:AdminAction;targetType?:string;targetId?:Types.ObjectId;metadata?:Record<string,unknown>;ipHash?:string;createdAt:Date}
const S=new Schema<IAdminAuditLog>({adminId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},action:{type:String,enum:['USER_STATUS_CHANGED','ADMIN_SEARCH','SYSTEM_CHECK'],required:true,index:true},targetType:{type:String,maxlength:80},targetId:{type:Schema.Types.ObjectId},metadata:{type:Schema.Types.Mixed},ipHash:{type:String,maxlength:128}},{timestamps:true,versionKey:false});
S.index({createdAt:-1});
export default (mongoose.models.AdminAuditLog as mongoose.Model<IAdminAuditLog>)||mongoose.model<IAdminAuditLog>('AdminAuditLog',S);
