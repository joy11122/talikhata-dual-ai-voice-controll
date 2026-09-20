import mongoose,{Schema,Types} from 'mongoose';
export interface ISession extends mongoose.Document {sessionToken:string;userId:Types.ObjectId;expires:Date}
const S=new Schema<ISession>({sessionToken:{type:String,required:true,unique:true},userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},expires:{type:Date,required:true}},{collection:'sessions'});export default (mongoose.models.Session as mongoose.Model<ISession>)||mongoose.model<ISession>('Session',S);
