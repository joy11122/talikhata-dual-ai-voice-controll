export type VoiceIntentName = 'CREATE_TRANSACTION' | 'READ_BALANCE' | 'UPDATE_STOCK' | 'DELETE_ENTRY' | 'LIST_ITEMS' | 'CREATE_PARTY' | 'CREATE_PRODUCT';
export type VoiceEntityType = 'CUSTOMER' | 'SUPPLIER' | 'INVENTORY';
export type VoiceTransactionType = 'DUE_GIVEN' | 'DUE_RECEIVED' | 'STOCK_IN' | 'STOCK_OUT' | 'EXPENSE' | 'SALE';
export interface VoiceIntentResult { intent: VoiceIntentName; entity_type: VoiceEntityType; entity_name: string | null; amount: number | null; quantity: number | null; unit: string | null; transaction_type: VoiceTransactionType | null; notes: string | null; }
export interface VoiceMatch { id: string; name: string; phone?: string | null; balance?: number; unit?: string; stock?: number; }
