import { describe, expect, it } from 'vitest';
import { PartyInputSchema, ProductInputSchema, TransactionInputSchema } from '@/lib/validations/domain';

describe('domain validation', () => {
  it('rejects a due transaction without a party', () => {
    const result = TransactionInputSchema.safeParse({ type: 'DUE_GIVEN', amount: 500, quantity: 0 });
    expect(result.success).toBe(false);
  });
  it('rejects sale paid amount greater than total', () => {
    const result = TransactionInputSchema.safeParse({ type: 'SALE', productId: '507f1f77bcf86cd799439011', amount: 500, paidAmount: 600, quantity: 1, unitPrice: 500 });
    expect(result.success).toBe(false);
  });
  it('accepts a valid party and product', () => {
    expect(PartyInputSchema.safeParse({ name: 'Rahim', partyType: 'CUSTOMER' }).success).toBe(true);
    expect(ProductInputSchema.safeParse({ name: 'Rice', unit: 'kg', stockQuantity: 10, buyPrice: 50, sellPrice: 60, lowStockThreshold: 2 }).success).toBe(true);
  });
});
