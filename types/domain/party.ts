export type PartyType = 'CUSTOMER' | 'SUPPLIER';

export interface Party {
  _id: string;
  name: string;
  phone?: string | null;
  partyType: PartyType;
  currentBalance: number;
}
