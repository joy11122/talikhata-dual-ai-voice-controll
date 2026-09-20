import mongoose,{Schema,Types} from 'mongoose';
export type PartyType='CUSTOMER'|'SUPPLIER';export interface IParty extends mongoose.Document{_id:Types.ObjectId;userId:Types.ObjectId;name:string;phone?:string;partyType:PartyType;currentBalance:number;createdAt:Date}
const S=new Schema<IParty>({userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},name:{type:String,required:true,trim:true,maxlength:150},phone:{type:String,trim:true,maxlength:30},partyType:{type:String,enum:['CUSTOMER','SUPPLIER'],required:true},currentBalance:{type:Number,default:0}},{timestamps:true,versionKey:false});S.index({name:'text'});S.index({userId:1,name:1},{unique:true});
const Party=(mongoose.models.Party as mongoose.Model<IParty>)||mongoose.model<IParty>('Party',S);export default Party;
