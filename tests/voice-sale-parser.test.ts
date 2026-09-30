import { describe, expect, it } from 'vitest';
import { parseSaleCommand } from '@/lib/voice-v2/saleParser';

describe('Voice V2 sale parser', () => {
  it('parses named customer sale', () => {
    const command = parseSaleCommand('রহিমকে ২ কেজি চাল ৭০ টাকা দরে বিক্রি করলাম');
    expect(command).not.toBeNull();
    expect(command).toMatchObject({
      action: 'CREATE_SALE',
      entityName: 'চাল',
      query: 'রহিম',
      quantity: 2,
      unit: 'কেজি',
      unitPrice: 70,
      amount: 140,
      paidAmount: 140,
      partyType: 'CUSTOMER',
    });
  });

  it('parses anonymous cash sale without creating a customer', () => {
    const command = parseSaleCommand('২ কেজি চাল ৭০ টাকা দরে বিক্রি করলাম');
    expect(command).not.toBeNull();
    expect(command).toMatchObject({
      action: 'CREATE_SALE',
      entityName: 'চাল',
      query: null,
      quantity: 2,
      unit: 'কেজি',
      unitPrice: 70,
      amount: 140,
      paidAmount: 140,
      partyType: null,
    });
  });

  it('parses explicit walk-in customer sale', () => {
    const command = parseSaleCommand('একজন কাস্টমারের কাছে ২ কেজি চাল ৭০ টাকা দরে বিক্রি করলাম');
    expect(command).not.toBeNull();
    expect(command).toMatchObject({
      action: 'CREATE_SALE',
      entityName: 'চাল',
      query: null,
      amount: 140,
      paidAmount: 140,
    });
  });

  it('parses anonymous sale stated as a total amount', () => {
    const command = parseSaleCommand('২ কেজি চাল ১৪০ টাকায় বিক্রি করলাম');
    expect(command).not.toBeNull();
    expect(command).toMatchObject({
      action: 'CREATE_SALE',
      entityName: 'চাল',
      query: null,
      quantity: 2,
      unit: 'কেজি',
      unitPrice: 70,
      amount: 140,
      paidAmount: 140,
    });
  });

  it('does not invent a customer for an anonymous credit sale', () => {
    const command = parseSaleCommand('২ কেজি চাল ৭০ টাকা দরে বাকিতে বিক্রি করলাম');
    expect(command).not.toBeNull();
    expect(command).toMatchObject({
      action: 'CREATE_SALE',
      entityName: 'চাল',
      query: null,
      amount: 140,
      paidAmount: 0,
    });
  });

  it('preserves the existing named-sale behavior for Banglish', () => {
    const command = parseSaleCommand('Rahim ke 2 kg chal 70 taka dore bikri korlam');
    expect(command).not.toBeNull();
    expect(command).toMatchObject({
      action: 'CREATE_SALE',
      entityName: 'chal',
      query: 'Rahim',
      quantity: 2,
      unit: 'kg',
      unitPrice: 70,
      amount: 140,
      paidAmount: 140,
    });
  });
});
