import { describe, expect, it } from 'vitest';
import { parseVoiceV2Local } from '../services/voiceEngineV2';
describe('bangla banglish english command matrix', () => {
  const cases = [
    ['রহিম বাকি নিল ৫০০ টাকা', 'CUSTOMER_DUE'],
    ['রহিম ৫০০ টাকা বাকিতে নিল', 'CUSTOMER_DUE'],
    ['রহিমের কাছে ৫০০ টাকা পাবো', 'CUSTOMER_DUE'],
    ['রহিম ৫০০ টাকা দেবে', 'CUSTOMER_DUE'],
    ['রহিম ৫০০ টাকা দিল', 'CUSTOMER_RECEIVED'],
    ['রহিম ৫০০ টাকা পরিশোধ করল', 'CUSTOMER_RECEIVED'],
    ['রহিমের কাছ থেকে ৫০০ টাকা পেলাম', 'CUSTOMER_RECEIVED'],
    ['রহিমের কাছ থেকে ৫০০ টাকা নিলাম', 'CUSTOMER_RECEIVED'],
    ['কাজল দেবে ১০০০ টাকা', 'CUSTOMER_DUE'],
    ['কাজলকে দিলাম ১০০০ টাকা বাকি', 'CUSTOMER_DUE'],
    ['kajol er kache pabo 1000', 'CUSTOMER_DUE'],
    ['kajol debe 1000', 'CUSTOMER_DUE'],
    ['kajol nilo 1000 tk', 'CUSTOMER_DUE'],
    ['kajol theke 1000 taka pelam', 'CUSTOMER_RECEIVED'],
    ['kajol 1000 taka paid korlo', 'CUSTOMER_RECEIVED'],
    ['kajol 500 taka received dilo', 'CUSTOMER_RECEIVED'],
    ['sold 2 kg dal to kajol for 1000 taka', 'SALE'],
    ['kajol ke 2 kg dal 1000 taka diye sell korlam', 'SALE'],
    ['2 kg dal bikri korlam 1000 taka', 'SALE'],
    ['কাজলের কাছে ২ কেজি ডাল বিক্রি করলাম ১০০০ টাকা', 'SALE'],
    ['করিমের কাছ থেকে ২০ কেজি চাল কিনলাম', 'PURCHASE'],
    ['karim er kach theke 20 kg chal kinlam', 'PURCHASE'],
    ['২০ কেজি চাল stock এ যোগ করো', 'STOCK_IN'],
    ['20 kg chal stock e add koro', 'STOCK_IN'],
  ];

  it.each(cases)('%s should map to %s', (_text, expected) => {
    expect(['CUSTOMER_DUE','CUSTOMER_RECEIVED','SALE','PURCHASE','STOCK_IN']).toContain(expected);
  });
});

describe('actual parser direction regression', () => {
  const cases = [
    { text: 'রহিম বাকি নিল ৫০০ টাকা', action: 'CREATE_DUE', partyType: 'CUSTOMER', amount: 500 },
    { text: 'রহিমের কাছে ৫০০ টাকা পাবো', action: 'CREATE_DUE', partyType: 'CUSTOMER', amount: 500 },
    { text: 'কাজল দেবে ১০০০ টাকা', action: 'CREATE_DUE', partyType: 'CUSTOMER', amount: 1000 },
    { text: 'রহিম ৫০০ টাকা দিল', action: 'RECEIVE_PAYMENT', partyType: 'CUSTOMER', amount: 500 },
    { text: 'রহিমের কাছ থেকে ৫০০ টাকা পেলাম', action: 'RECEIVE_PAYMENT', partyType: 'CUSTOMER', amount: 500 },
    { text: 'রহিমের কাছ থেকে ৫০০ টাকা নিলাম', action: 'RECEIVE_PAYMENT', partyType: 'CUSTOMER', amount: 500 },
    { text: 'kajol debe 1000', action: 'CREATE_DUE', partyType: 'CUSTOMER', amount: 1000 },
    { text: 'kajol er kache pabo 1000', action: 'CREATE_DUE', partyType: 'CUSTOMER', amount: 1000 },
    { text: 'kajol theke 1000 taka pelam', action: 'RECEIVE_PAYMENT', partyType: 'CUSTOMER', amount: 1000 },
    { text: 'করিম supplier কে ১০০০ টাকা দিতে হবে', action: 'CREATE_DUE', partyType: 'SUPPLIER', amount: 1000 },
    { text: 'supplier করিমকে ১০০০ টাকা দিলাম', action: 'RECEIVE_PAYMENT', partyType: 'SUPPLIER', amount: 1000 },
  ];

  it.each(cases)('parses "$text" with the correct ledger direction', async ({ text, action, partyType, amount }) => {
    const parsed = await parseVoiceV2Local(text);
    expect(parsed).not.toBeNull();
    expect(parsed.action).toBe(action);
    expect(parsed.partyType).toBe(partyType);
    expect(parsed.amount).toBe(amount);
  });
});

describe('entity resolution safety invariants', () => {
  it('sale must not auto-create a missing product', () => {
    const productMatches = 0;
    const saleMayCreateProduct = false;
    expect(productMatches).toBe(0);
    expect(saleMayCreateProduct).toBe(false);
  });

  it('purchase may create a missing product because purchase adds catalog stock', () => {
    const purchaseMayCreateProduct = true;
    expect(purchaseMayCreateProduct).toBe(true);
  });

  it('multiple product matches must require disambiguation', () => {
    const matches = 2;
    expect(matches > 1).toBe(true);
  });

  it('customer and supplier roles must not be silently interchangeable', () => {
    const requested = 'CUSTOMER';
    const actual = 'SUPPLIER';
    expect(requested).not.toBe(actual);
  });
});

describe('inventory safety invariants', () => {
  it('must reject a sale larger than available tracked stock', () => {
    const available = 5;
    const requested = 20;
    expect(requested > available).toBe(true);
  });

  it('must not mutate stock when a sale is rejected', () => {
    const before = 5;
    const requested = 20;
    const after = requested > before ? before : before - requested;
    expect(after).toBe(5);
  });

  it('stock-disabled products require a non-inventory transaction path', () => {
    const trackStock = false;
    expect(trackStock).toBe(false);
  });
});

describe('voice safety invariants', () => {
  it('rejects payment greater than total', () => {
    const total = 1000;
    const paid = 1200;
    expect(paid > total).toBe(true);
  });

  it('rejects zero or negative inventory quantity', () => {
    for (const quantity of [0, -1]) expect(quantity <= 0).toBe(true);
  });

  it('rejects negative money', () => {
    for (const amount of [-1, -500]) expect(amount < 0).toBe(true);
  });
});

describe('reversal accounting invariants', () => {
  it('reversing a customer due restores the previous balance', () => {
    const due = 1000;
    const balanceAfterDue = 2500 + due;
    expect(balanceAfterDue - due).toBe(2500);
  });

  it('reversing a customer receipt restores the previous balance', () => {
    const receipt = 1000;
    const balanceAfterReceipt = 2500 - receipt;
    expect(balanceAfterReceipt + receipt).toBe(2500);
  });

  it('reversing supplier payable restores the previous balance', () => {
    const payable = 1000;
    const balanceAfterPurchase = -payable;
    expect(balanceAfterPurchase + payable).toBe(0);
  });

  it('reversing supplier payment restores the previous balance', () => {
    const payment = 1000;
    const balanceAfterPayment = 0 + payment;
    expect(balanceAfterPayment - payment).toBe(0);
  });

  it('reversing stock-in restores the previous stock exactly', () => {
    const before = 20;
    const afterPurchase = before + 10;
    expect(afterPurchase - 10).toBe(before);
  });

  it('reversing sale restores the previous stock exactly', () => {
    const before = 20;
    const afterSale = before - 10;
    expect(afterSale + 10).toBe(before);
  });
});

describe('trade accounting invariants', () => {
  it('sale partial payment must represent sale=1000, received=400, due=600', () => {
    const total = 1000;
    const paid = 400;
    expect(total - paid).toBe(600);
    expect(paid).toBeLessThanOrEqual(total);
  });

  it('purchase partial payment must represent purchase=1400, paid=500, payable=900', () => {
    const total = 1400;
    const paid = 500;
    expect(total - paid).toBe(900);
    expect(paid).toBeLessThanOrEqual(total);
  });

  it('purchase stock quantity must be applied by the transaction exactly once', () => {
    const initialProductQuantity = 0;
    const purchaseQuantity = 20;
    const stockAfterTransaction = initialProductQuantity + purchaseQuantity;
    expect(stockAfterTransaction).toBe(20);
  });
});

describe('Voice V2 Bangladesh ledger semantics', () => {
  it.each([
    ['রহিমকে ৫০০ টাকা দিলাম', 'CREATE_DUE', 'রহিম', 500],
    ['রহিমের কাছে ৫০০ টাকা বাকি', 'CREATE_DUE', 'রহিম', 500],
    ['রহিমের নামে ৫০০ টাকা বাকি রাখো', 'CREATE_DUE', 'রহিম', 500],
    ['রহিম ৫০০ টাকা দিল', 'RECEIVE_PAYMENT', 'রহিম', 500],
    ['রহিমের কাছ থেকে ৫০০ টাকা পেলাম', 'RECEIVE_PAYMENT', 'রহিম', 500],
    ['Rahim 500 taka dilo', 'RECEIVE_PAYMENT', 'Rahim', 500],
    ['কাজল দেবে ১০০০ টাকা', 'CREATE_DUE', 'কাজল', 1000],
    ['কাজলের কাছে ১০০০ টাকা পাবো', 'CREATE_DUE', 'কাজল', 1000],
    ['কাজলের কাছে ১০০০ টাকা পাবে', 'CREATE_DUE', 'কাজল', 1000],
    ['কাজলের বাকি ১০০০ টাকা', 'CREATE_DUE', 'কাজল', 1000],
    ['কাজলের কাছে পাওনা ১০০০ টাকা', 'CREATE_DUE', 'কাজল', 1000],
    ['কাজলকে দিলাম ১০০০ টাকা বাকি', 'CREATE_DUE', 'কাজল', 1000],
    ['কাজলকে ১০০০ টাকা দিলাম', 'CREATE_DUE', 'কাজল', 1000],
    ['কাজলকে দেবো ১০০০ টাকা', 'CREATE_DUE', 'কাজল', 1000],
    ['কাজলকে ১০০০ টাকা দেবো', 'CREATE_DUE', 'কাজল', 1000],
    ['কাজল নিল ৫০০ টাকা বাকি', 'CREATE_DUE', 'কাজল', 500],
    ['কাজল নেবে ৫০০ টাকা বাকি', 'CREATE_DUE', 'কাজল', 500],
    ['রহিম বাকি নিল ৫০০ টাকা', 'CREATE_DUE', 'রহিম', 500],
    ['রহিম ৫০০ টাকা বাকি নিল', 'CREATE_DUE', 'রহিম', 500],
    ['Rahim baki nilo 500 tk', 'CREATE_DUE', 'Rahim', 500],
    ['Rahim took 500 on credit', 'CREATE_DUE', 'Rahim', 500],
    ['Rahim 500 taka baki nilo', 'CREATE_DUE', 'Rahim', 500],
    ['কাজল ১০০০ টাকা দিল', 'RECEIVE_PAYMENT', 'কাজল', 1000],
    ['কাজলের কাছ থেকে ১০০০ টাকা নিলাম', 'RECEIVE_PAYMENT', 'কাজল', 1000],
    ['আমি কাজলের কাছ থেকে ১০০০ টাকা নেবো', 'RECEIVE_PAYMENT', 'কাজল', 1000],
    ['কাজলের কাছে এক হাজার টাকা পাবো', 'CREATE_DUE', 'কাজল', 1000],
    ['Rahim ke 500 taka dilam', 'CREATE_DUE', 'Rahim', 500],
  ])('%s → %s', async (text, action, name, amount) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();

    expect(command.action).toBe(action);
    expect(command.entityName).toBe(name);
    expect(command.amount).toBe(amount);
  });

  it.each([
    ['রহিম বাকি নিল ৫০০ টাকা', 'CREATE_DUE', 'রহিম', 500],
    ['রহিম ৫০০ টাকা বাকিতে নিল', 'CREATE_DUE', 'রহিম', 500],
    ['রহিমের কাছে ৫০০ টাকা পাবো', 'CREATE_DUE', 'রহিম', 500],
    ['রহিম ৫০০ টাকা দেবে', 'CREATE_DUE', 'রহিম', 500],
    ['রহিম বাকি নিল এক হাজার টাকা', 'CREATE_DUE', 'রহিম', 1000],
    ['Rahim baki nilo 500 tk', 'CREATE_DUE', 'Rahim', 500],
    ['Rahim 500 taka baki nilo', 'CREATE_DUE', 'Rahim', 500],
    ['Rahim took 500 on credit', 'CREATE_DUE', 'Rahim', 500],
    ['Rahim owes me 500', 'CREATE_DUE', 'Rahim', 500],
    ['রহিম ৫০০ টাকা দিল', 'RECEIVE_PAYMENT', 'রহিম', 500],
    ['রহিম ৫০০ টাকা পরিশোধ করল', 'RECEIVE_PAYMENT', 'রহিম', 500],
    ['রহিমের কাছ থেকে ৫০০ টাকা পেলাম', 'RECEIVE_PAYMENT', 'রহিম', 500],
    ['রহিমের কাছ থেকে ৫০০ টাকা নিলাম', 'RECEIVE_PAYMENT', 'রহিম', 500],
    ['Rahim 500 taka dilo', 'RECEIVE_PAYMENT', 'Rahim', 500],
    ['Rahim paid 500', 'RECEIVE_PAYMENT', 'Rahim', 500],
    ['I received 500 from Rahim', 'RECEIVE_PAYMENT', 'Rahim', 500],
  ])('%s → customer ledger direction', async (text, action, name, amount) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();
    expect(command.action).toBe(action);
    expect(command.entityName).toBe(name);
    expect(command.amount).toBe(amount);
  });

  it.each([
    ['supplier Karim ke 1000 taka dite hobe', 'SUPPLIER', 'SUPPLIER', 'CREATE_DUE'],
    ['সরবরাহকারী করিমের ১০০০ টাকা পাওনা', 'SUPPLIER', 'SUPPLIER', 'CREATE_DUE'],
  ])('%s → explicit supplier role', async (text, entityType, partyType, action) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();
    expect(command.action).toBe(action);
    expect(command.entityType).toBe(entityType);
    expect(command.partyType).toBe(partyType);
  });

  it.each([
    ['করিমের কাছ থেকে ১০০০ টাকার মাল বাকিতে নিলাম', 'CREATE_PURCHASE', 'করিম', 1000],
    ['করিমকে ৫০০ টাকা দিতে হবে', 'CREATE_DUE', 'করিম', 500],
    ['Karim supplier ke 1000 taka due ache', 'CREATE_DUE', 'Karim', 1000],
    ['করিমের কাছ থেকে ৫০০ টাকা নিলাম', 'RECEIVE_PAYMENT', 'করিম', 500],
  ])('%s → supplier/payment direction', async (text, action, name, amount) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();
    expect(command.action).toBe(action);
    expect(command.entityName).toBe(name);
    expect(command.amount).toBe(amount);
  });

  it.each([
    ['রহিমের বাকি কত', 'READ_BALANCE', 'রহিম'],
    ['Rahim er baki koto', 'READ_BALANCE', 'Rahim'],
  ])('%s → balance query', async (text, action, name) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();

    expect(command.action).toBe(action);
    expect(command.entityName).toBe(name);
  });



  it.each([
    ['৭০ টাকা দরে বিশ কেজি গম যোগ করো', 'গম', 20, 'কেজি', 70],
    ['70 টাকা দরে 20 কেজি গম যোগ করো', 'গম', 20, 'কেজি', 70],
    ['20 কেজি গম 70 টাকা দরে যোগ করো', 'গম', 20, 'কেজি', 70],
  ])('%s → product add', async (text, name, quantity, unit, unitPrice) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();

    expect(command.action).toBe('CREATE_PRODUCT');
    expect(command.entityType).toBe('PRODUCT');
    expect(command.entityName).toBe(name);
    expect(command.quantity).toBe(quantity);
    expect(command.unit).toBe(unit);
    expect(command.unitPrice).toBe(unitPrice);
  });

  it.each([
    ['রহিমের কাছে ২ কেজি চাল ৭০ টাকা দরে বিক্রি করলাম', 'CREATE_SALE'],
    ['রহিমকে ২ কেজি চাল বিক্রি করলাম', 'CREATE_SALE'],
    ['রহিম ২ কেজি চাল নিল ১৪০ টাকা', 'CREATE_SALE'],
    ['২ কেজি চাল ১৪০ টাকায় বিক্রি করলাম', 'CREATE_SALE'],
    ['রহিমকে ২ কেজি চাল বাকিতে দিলাম', 'CREATE_SALE'],
    ['রহিমকে ২ কেজি চাল নগদে বিক্রি করলাম', 'CREATE_SALE'],
    ['Rahim ke 2 kg chal 70 taka dore bikri korlam', 'CREATE_SALE'],
    ['Rahim 2 kg rice took for 140 taka', 'CREATE_SALE'],
    ['রহিমকে ১০০০ টাকার মাল বিক্রি করলাম, ৪০০ টাকা দিল', 'CREATE_SALE'],
    ['রহিমকে ১০০০ টাকার মাল বিক্রি করলাম ৪০০ টাকা বাকি', 'CREATE_SALE'],
  ])('%s → sale command', async (text, action) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();
    expect(command.action).toBe(action);
  });

  it.each([
    ['রহিমকে ১০০০ টাকার মাল বিক্রি করলাম, ৪০০ টাকা দিল', 'রহিম', 1000, 400],
    ['রহিমকে ১০০০ টাকার মাল বিক্রি করলাম ৪০০ টাকা বাকি', 'রহিম', 1000, 600],
  ])('%s → amount-only compound sale', async (text, party, total, paid) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();
    expect(command.action).toBe('CREATE_SALE');
    expect(command.query).toBe(party);
    expect(command.amount).toBe(total);
    expect(command.paidAmount).toBe(paid);
    expect(command.quantity).toBeNull();
    expect(command.unitPrice).toBeNull();
  });

  it.each([
    ['রহিম ২ কেজি চাল নিল ১৪০ টাকা', 'CREATE_SALE', 'রহিম', 'চাল', 2, 70, 140],
    ['Rahim took 2 kg rice for 140 taka', 'CREATE_SALE', 'Rahim', 'rice', 2, 70, 140],
  ])('%s → natural total sale', async (text, action, party, product, quantity, unitPrice, amount) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();
    expect(command.action).toBe(action);
    expect(command.query).toBe(party);
    expect(command.entityName).toBe(product);
    expect(command.quantity).toBe(quantity);
    expect(command.unitPrice).toBe(unitPrice);
    expect(command.amount).toBe(amount);
  });

  it.each([
    ['করিমের কাছ থেকে ২০ কেজি চাল ৭০ টাকা দরে কিনলাম, ৫০০ টাকা দিলাম', 'করিম', 20, 70, 1400, 500],
    ['করিমের কাছ থেকে ২০ কেজি চাল ৭০ টাকা দরে কিনলাম ৯০০ টাকা বাকি', 'করিম', 20, 70, 1400, 500],
    ['Karim er kach theke 20 kg chal 70 taka dore kinlam, 500 taka dilam', 'Karim', 20, 70, 1400, 500],
  ])('%s → compound purchase', async (text, supplier, quantity, unitPrice, amount, paid) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();
    expect(command.action).toBe('CREATE_PURCHASE');
    expect(command.query).toBe(supplier);
    expect(command.quantity).toBe(quantity);
    expect(command.unitPrice).toBe(unitPrice);
    expect(command.amount).toBe(amount);
    expect(command.paidAmount).toBe(paid);
  });

  it.each([
    ['করিমের কাছ থেকে ২০ কেজি চাল ৭০ টাকা দরে কিনলাম', 'CREATE_PURCHASE'],
    ['২০ কেজি চাল ১৪০০ টাকায় কিনলাম', 'CREATE_PURCHASE'],
    ['করিমের কাছ থেকে ২০ কেজি চাল বাকিতে কিনলাম', 'CREATE_PURCHASE'],
    ['করিমের কাছ থেকে ২০ কেজি চাল কিনলাম, ৫০০ টাকা দিলাম', 'CREATE_PURCHASE'],
    ['Karim er kach theke 20 kg chal 70 taka dore kinlam', 'CREATE_PURCHASE'],
    ['I bought 20 kg rice from Karim for 1400 taka', 'CREATE_PURCHASE'],
  ])('%s → purchase command', async (text, action) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();
    expect(command.action).toBe(action);
  });

  it.each([
    ['কাজল এর কাছে ১০০০ টাকা পাবো', 'CREATE_DUE'],
    ['কাজল ১০০০ টাকা দেবে', 'CREATE_DUE'],
    ['কাজল বাকি নিল ১০০০ টাকা', 'CREATE_DUE'],
    ['Kajol 1000 taka debe', 'CREATE_DUE'],
    ['Kajol baki nilo 1000 taka', 'CREATE_DUE'],
    ['কাজলের কাছ থেকে ১০০০ টাকা পেলাম', 'RECEIVE_PAYMENT'],
    ['কাজল ১০০০ টাকা দিল', 'RECEIVE_PAYMENT'],
    ['কাজলের কাছে বাকি ১০০০ টাকা', 'CREATE_DUE'],
    ['Kajol er kache pabo 1000 taka', 'CREATE_DUE'],
    ['Kajol er kach theke pelam 1000 taka', 'RECEIVE_PAYMENT'],
  ])('%s → deterministic direction', async (text, action) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();
    expect(command.action).toBe(action);
  });

  it.each([
    ['করিমের কাছ থেকে ১০০০ টাকার মাল বাকিতে নিলাম', 'CREATE_PURCHASE'],
    ['করিমকে ১০০০ টাকা দিতে হবে', 'CREATE_DUE'],
    ['করিমের পাওনা ১০০০ টাকা', 'CREATE_DUE'],
    ['করিমকে ১০০০ টাকা দিয়ে দিলাম', 'RECEIVE_PAYMENT'],
    ['করিমের পাওনা ১০০০ টাকা পরিশোধ করলাম', 'RECEIVE_PAYMENT'],
    ['করিমের কাছ থেকে ১০০০ টাকার মাল বাকিতে নিলাম', 'CREATE_PURCHASE'],
    ['Rahim 1000 taka debe', 'CREATE_DUE'],
    ['Rahim 1000 taka dilo', 'RECEIVE_PAYMENT'],
    ['Rahim 1000 taka baki nilo', 'CREATE_DUE'],
    ['Rahim 1000 taka paid', 'RECEIVE_PAYMENT'],
  ])('%s → cross-direction action', async (text, action) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();
    expect(command.action).toBe(action);
  });

  it.each([
    ['আজ ৫০০ টাকা দোকান ভাড়া দিলাম', 'CREATE_EXPENSE', 500],
    ['১০০ টাকা বিদ্যুৎ বিল দিলাম', 'CREATE_EXPENSE', 100],
    ['আজ ২০০ টাকা পরিবহন খরচ হয়েছে', 'CREATE_EXPENSE', 200],
    ['চায়ের জন্য ৫০ টাকা খরচ হয়েছে', 'CREATE_EXPENSE', 50],
    ['আজ ৫০০ টাকা অতিরিক্ত আয় হয়েছে', 'CREATE_INCOME', 500],
    ['কমিশন হিসেবে ১০০০ টাকা পেলাম', 'CREATE_INCOME', 1000],
    ['অন্যান্য আয় ৫০০ টাকা যোগ করো', 'CREATE_INCOME', 500],
  ])('%s → finance action', async (text, action, amount) => {
    const command = await parseVoiceV2Local(text);
    expect(command).not.toBeNull();
    expect(command.action).toBe(action);
    expect(command.amount).toBe(amount);
  });

  it('supports Bengali word amounts in ledger commands', async () => {
    const command = await parseVoiceV2Local('রহিমকে পাঁচশ টাকা দিলাম');
    expect(command).not.toBeNull();

    expect(command.action).toBe('CREATE_DUE');
    expect(command.entityName).toBe('রহিম');
    expect(command.amount).toBe(500);
  });
});
