import { z } from 'zod';
export const VoiceIntentSchema=z.object({
 intent:z.enum(['CREATE_TRANSACTION','READ_BALANCE','UPDATE_STOCK','DELETE_ENTRY','LIST_ITEMS','CREATE_PRODUCT','CREATE_PARTY']),
 entity_type:z.enum(['CUSTOMER','SUPPLIER','INVENTORY']),
 entity_name:z.string().trim().max(200).nullable(),
 amount:z.number().finite().nonnegative().nullable(),
 quantity:z.number().finite().nonnegative().nullable(),
 unit:z.string().trim().max(30).nullable(),
 transaction_type:z.enum(['DUE_GIVEN','DUE_RECEIVED','STOCK_IN','STOCK_OUT','EXPENSE','SALE']).nullable(),
 notes:z.string().trim().max(500).nullable(),
 phone:z.string().trim().max(30).nullable().optional(),
 buy_price:z.number().finite().nonnegative().nullable().optional(),
 sell_price:z.number().finite().nonnegative().nullable().optional(),
 low_stock_threshold:z.number().finite().nonnegative().nullable().optional(),
 party_type:z.enum(['CUSTOMER','SUPPLIER']).nullable().optional(),
 items:z.array(z.object({product_name:z.string().trim().min(1).max(200),quantity:z.number().finite().positive(),unit:z.string().trim().max(30).nullable().optional(),unit_price:z.number().finite().nonnegative().nullable().optional()})).max(50).optional(),
 paid_amount:z.number().finite().nonnegative().nullable().optional(),
}).strict().superRefine((v,ctx)=>{
 if(v.intent==='CREATE_TRANSACTION'){if(v.transaction_type==='SALE' && !v.entity_name && !(v.items&&v.items.length))ctx.addIssue({code:'custom',path:['items'],message:'Product or items are required for a sale'});if(v.transaction_type==='SALE' && v.items?.some(i=>!i.quantity))ctx.addIssue({code:'custom',path:['items'],message:'Sale quantities must be positive'});if(!v.transaction_type)ctx.addIssue({code:'custom',path:['transaction_type'],message:'transaction_type is required'});if(v.transaction_type!=='EXPENSE'&&v.transaction_type!=='SALE'&&!v.entity_name)ctx.addIssue({code:'custom',path:['entity_name'],message:'Entity is required'});if(v.transaction_type!=='SALE' && (!v.amount||v.amount<=0))ctx.addIssue({code:'custom',path:['amount'],message:'Amount must be positive'});if(v.transaction_type==='SALE' && v.amount!==null && v.amount<=0)ctx.addIssue({code:'custom',path:['amount'],message:'Sale amount must be positive when supplied'});if(v.paid_amount!==undefined&&v.paid_amount!==null&&v.amount!==null&&v.paid_amount>v.amount)ctx.addIssue({code:'custom',path:['paid_amount'],message:'Paid amount cannot exceed total'});}
 if(v.intent==='UPDATE_STOCK'&&(!v.entity_name||!v.quantity||v.quantity<=0))ctx.addIssue({code:'custom',path:['quantity'],message:'Product and positive quantity are required'});
 if(v.intent==='CREATE_PRODUCT'&&(!v.entity_name||!v.unit))ctx.addIssue({code:'custom',path:['entity_name'],message:'Product name and unit are required'});
 if(v.intent==='CREATE_PARTY'&&!v.entity_name)ctx.addIssue({code:'custom',path:['entity_name'],message:'Party name is required'});
});
export type VoiceIntent=z.infer<typeof VoiceIntentSchema>;
export const VoiceParseRequest=z.object({transcript:z.string().trim().min(1).max(4000)});
