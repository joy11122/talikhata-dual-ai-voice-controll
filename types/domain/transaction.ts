import type { Party } from './party';
import type { Product } from './product';

export type TransactionType =
  | 'DUE_GIVEN'
  | 'DUE_RECEIVED'
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'EXPENSE'
  | 'SALE';

export interface Transaction {
  _id: string;
  type: TransactionType;
  amount: number;
  quantity: number;
  unitPrice?: number;
  paidAmount?: number;
  partyId?: Party | null;
  productId?: Product | null;
  notes?: string;
  timestamp: string;
}
