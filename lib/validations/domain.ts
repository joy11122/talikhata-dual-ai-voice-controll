import { z } from 'zod';

const ProductVariantSchema=z.object({
  _id:z.string().optional(),
  name:z.string().trim().min(1).max(120),
  sku:z.string().trim().max(80).optional(),
  barcode:z.string().trim().max(80).optional(),
  attributes:z.record(z.union([z.string(),z.number(),z.boolean()])).default({}),
  stockQuantity:z.coerce.number().finite().min(0).default(0),
  buyPrice:z.coerce.number().finite().min(0).default(0),
  sellPrice:z.coerce.number().finite().min(0).default(0),
});

export const PartyInputSchema=z.object({name:z.string().trim().min(2).max(150),phone:z.string().trim().max(30).nullable().optional(),partyType:z.enum(['CUSTOMER','SUPPLIER'])});

const ProductBaseSchema=z.object({
  name:z.string().trim().min(1).max(150),
  category:z.string().trim().max(100).optional(),
  brand:z.string().trim().max(100).optional(),
  sku:z.string().trim().max(80).optional(),
  barcode:z.string().trim().max(80).optional(),
  unit:z.string().trim().min(1).max(30),
  stockQuantity:z.coerce.number().finite().min(0),
  buyPrice:z.coerce.number().finite().min(0),
  sellPrice:z.coerce.number().finite().min(0),
  lowStockThreshold:z.coerce.number().finite().min(0),
  trackStock:z.coerce.boolean().default(true),
  attributes:z.record(z.union([z.string(),z.number(),z.boolean()])).default({}),
  variants:z.array(ProductVariantSchema).default([]),
});

const validateVariantSkus=(v:{variants?:Array<{sku?:string}>},ctx:z.RefinementCtx)=>{
  const seen=new Set<string>();
  for(const variant of v.variants??[]){
    const key=(variant.sku||'').trim().toLowerCase();
    if(key&&seen.has(key))ctx.addIssue({code:'custom',path:['variants'],message:'Variant SKU must be unique'});
    if(key)seen.add(key);
  }
};

export const ProductInputSchema=ProductBaseSchema.superRefine(validateVariantSkus);
export const ProductPatchSchema=ProductBaseSchema.partial().superRefine(validateVariantSkus);
export const PartyPatchSchema=PartyInputSchema.partial();

export const TransactionInputSchema=z.object({type:z.enum(['DUE_GIVEN','DUE_RECEIVED','STOCK_IN','STOCK_OUT','EXPENSE','SALE']),partyId:z.string().optional().nullable(),productId:z.string().optional().nullable(),variantId:z.string().optional().nullable(),amount:z.coerce.number().finite().min(0),paidAmount:z.coerce.number().finite().min(0).optional(),quantity:z.coerce.number().finite().min(0),unitPrice:z.coerce.number().finite().min(0).optional(),notes:z.string().trim().max(500).optional(),timestamp:z.coerce.date().optional()}).superRefine((v,ctx)=>{if(['DUE_GIVEN','DUE_RECEIVED'].includes(v.type)&&!v.partyId)ctx.addIssue({code:'custom',path:['partyId'],message:'Party is required'});if(['STOCK_IN','STOCK_OUT'].includes(v.type)&&(!v.productId||v.quantity<=0))ctx.addIssue({code:'custom',path:['productId'],message:'Product and positive quantity are required'});if(v.type==='SALE'&&(!v.productId||v.quantity<=0||v.amount<=0))ctx.addIssue({code:'custom',path:['productId'],message:'Sale requires product, positive quantity and amount'});if(v.type==='SALE'&&v.paidAmount!==undefined&&v.paidAmount>v.amount)ctx.addIssue({code:'custom',path:['paidAmount'],message:'Paid amount cannot exceed sale amount'});if(v.type==='EXPENSE'&&v.amount<=0)ctx.addIssue({code:'custom',path:['amount'],message:'Expense amount must be positive'});});
export type TransactionInput=z.infer<typeof TransactionInputSchema>;
