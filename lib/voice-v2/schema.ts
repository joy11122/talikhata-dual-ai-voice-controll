import { z } from 'zod';

const enumUpper = (value: unknown) =>
  typeof value === 'string' ? value.toUpperCase() : value;

export const VoiceV2Schema = z.object({
  action: z.preprocess(enumUpper, z.enum(['CREATE_PARTY','READ_PARTY','LIST_PARTIES','UPDATE_PARTY','DELETE_PARTY','CREATE_USER','READ_USER','LIST_USERS','UPDATE_USER','DELETE_USER','CREATE_PRODUCT','READ_PRODUCT','LIST_PRODUCTS','UPDATE_PRODUCT','DELETE_PRODUCT','CREATE_DUE','RECEIVE_PAYMENT','READ_BALANCE','CREATE_SALE','CREATE_PURCHASE','CREATE_EXPENSE','CREATE_INCOME','STOCK_IN','STOCK_OUT','LIST_TRANSACTIONS','DELETE_TRANSACTION'])),
  entityType: z.preprocess(enumUpper, z.enum(['CUSTOMER','SUPPLIER','PRODUCT','TRANSACTION','NONE'])),
  entityName: z.string().trim().max(200).nullable(),
  targetId: z.string().trim().max(100).nullable(),
  amount: z.number().finite().nonnegative().nullable(),
  quantity: z.number().finite().nonnegative().nullable(),
  unit: z.string().trim().max(50).nullable(),
  unitPrice: z.number().finite().nonnegative().nullable(),
  paidAmount: z.number().finite().nonnegative().nullable(),
  phone: z.string().trim().max(50).nullable(),
  notes: z.string().trim().max(500).nullable(),
  partyType: z.preprocess(enumUpper, z.enum(['CUSTOMER','SUPPLIER']).nullable()),
  query: z.string().trim().max(300).nullable(),
  confirmRequired: z.boolean()
});
export type VoiceV2Command=z.infer<typeof VoiceV2Schema>;
export const VoiceV2JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    command: {
      type: 'string',
      description: 'A single JSON object string containing the TaliKhata command. Include every field required by the command schema; use null for unknown values. Never invent database IDs or facts.',
    },
  },
  required: ['command'],
} as const;
