import { z } from 'zod';

export const VoiceV2Schema = z.object({
  action: z.enum([
    'CREATE_PARTY','READ_PARTY','LIST_PARTIES','UPDATE_PARTY','DELETE_PARTY',
    'CREATE_PRODUCT','READ_PRODUCT','LIST_PRODUCTS','UPDATE_PRODUCT','DELETE_PRODUCT',
    'CREATE_DUE','RECEIVE_PAYMENT','READ_BALANCE',
    'CREATE_SALE','CREATE_PURCHASE','CREATE_EXPENSE',
    'STOCK_IN','STOCK_OUT','LIST_TRANSACTIONS','DELETE_TRANSACTION'
  ]),
  entityType: z.enum(['CUSTOMER','SUPPLIER','PRODUCT','TRANSACTION','NONE']),
  entityName: z.string().trim().max(200).nullable(),
  targetId: z.string().trim().max(100).nullable(),
  amount: z.number().finite().nonnegative().nullable(),
  quantity: z.number().finite().nonnegative().nullable(),
  unit: z.string().trim().max(50).nullable(),
  unitPrice: z.number().finite().nonnegative().nullable(),
  paidAmount: z.number().finite().nonnegative().nullable(),
  phone: z.string().trim().max(50).nullable(),
  notes: z.string().trim().max(500).nullable(),
  partyType: z.enum(['CUSTOMER','SUPPLIER']).nullable(),
  query: z.string().trim().max(300).nullable(),
  confirmRequired: z.boolean().default(false)
});
export type VoiceV2Command=z.infer<typeof VoiceV2Schema>;

export const VoiceV2JsonSchema={
  type:'object',additionalProperties:false,
  properties:{
    action:{type:'string',enum:['CREATE_PARTY','READ_PARTY','LIST_PARTIES','UPDATE_PARTY','DELETE_PARTY','CREATE_PRODUCT','READ_PRODUCT','LIST_PRODUCTS','UPDATE_PRODUCT','DELETE_PRODUCT','CREATE_DUE','RECEIVE_PAYMENT','READ_BALANCE','CREATE_SALE','CREATE_PURCHASE','CREATE_EXPENSE','STOCK_IN','STOCK_OUT','LIST_TRANSACTIONS','DELETE_TRANSACTION']},
    entityType:{type:'string',enum:['CUSTOMER','SUPPLIER','PRODUCT','TRANSACTION','NONE']},
    entityName:{type:['string','null']},targetId:{type:['string','null']},
    amount:{type:['number','null']},quantity:{type:['number','null']},unit:{type:['string','null']},
    unitPrice:{type:['number','null']},paidAmount:{type:['number','null']},phone:{type:['string','null']},
    notes:{type:['string','null']},partyType:{type:['string','null'],enum:['CUSTOMER','SUPPLIER',null]},
    query:{type:['string','null']},confirmRequired:{type:'boolean'}
  },
  required:['action','entityType','entityName','targetId','amount','quantity','unit','unitPrice','paidAmount','phone','notes','partyType','query','confirmRequired']
} as const;
