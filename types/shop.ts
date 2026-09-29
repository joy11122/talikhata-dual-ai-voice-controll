export const BUSINESS_TYPES = [
  'GENERAL_RETAIL','GROCERY','CLOTHING','ELECTRONICS','PHARMACY',
  'RESTAURANT','WHOLESALE','SERVICE','HARDWARE','OTHER',
] as const;

export type BusinessType=(typeof BUSINESS_TYPES)[number];

export interface Shop {
  _id:string;
  userId:string;
  shopName:string;
  currency:string;
  businessType:BusinessType;
}
