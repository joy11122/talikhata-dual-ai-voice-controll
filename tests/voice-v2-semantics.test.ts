import { describe, expect, it } from 'vitest';
import { parseVoiceV2 } from '@/services/voiceEngineV2';

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
    const command = await parseVoiceV2(text);

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
    const command = await parseVoiceV2(text);
    expect(command.action).toBe(action);
    expect(command.entityName).toBe(name);
    expect(command.amount).toBe(amount);
  });

  it.each([
    ['করিমের কাছ থেকে ১০০০ টাকার মাল বাকিতে নিলাম', 'CREATE_DUE', 'করিম', 1000],
    ['করিমকে ৫০০ টাকা দিতে হবে', 'CREATE_DUE', 'করিম', 500],
    ['Karim supplier ke 1000 taka due ache', 'CREATE_DUE', 'Karim', 1000],
    ['করিমের কাছ থেকে ৫০০ টাকা নিলাম', 'RECEIVE_PAYMENT', 'করিম', 500],
  ])('%s → supplier/payment direction', async (text, action, name, amount) => {
    const command = await parseVoiceV2(text);
    expect(command.action).toBe(action);
    expect(command.entityName).toBe(name);
    expect(command.amount).toBe(amount);
  });

  it.each([
    ['রহিমের বাকি কত', 'READ_BALANCE', 'রহিম'],
    ['Rahim er baki koto', 'READ_BALANCE', 'Rahim'],
  ])('%s → balance query', async (text, action, name) => {
    const command = await parseVoiceV2(text);

    expect(command.action).toBe(action);
    expect(command.entityName).toBe(name);
  });



  it.each([
    ['৭০ টাকা দরে বিশ কেজি গম যোগ করো', 'গম', 20, 'কেজি', 70],
    ['70 টাকা দরে 20 কেজি গম যোগ করো', 'গম', 20, 'কেজি', 70],
    ['20 কেজি গম 70 টাকা দরে যোগ করো', 'গম', 20, 'কেজি', 70],
  ])('%s → product add', async (text, name, quantity, unit, unitPrice) => {
    const command = await parseVoiceV2(text);

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
    const command = await parseVoiceV2(text);
    expect(command.action).toBe(action);
  });

  it.each([
    ['রহিমকে ১০০০ টাকার মাল বিক্রি করলাম, ৪০০ টাকা দিল', 'রহিম', 1000, 400],
    ['রহিমকে ১০০০ টাকার মাল বিক্রি করলাম ৪০০ টাকা বাকি', 'রহিম', 1000, 600],
  ])('%s → amount-only compound sale', async (text, party, total, paid) => {
    const command = await parseVoiceV2(text);
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
    const command = await parseVoiceV2(text);
    expect(command.action).toBe(action);
    expect(command.query).toBe(party);
    expect(command.entityName).toBe(product);
    expect(command.quantity).toBe(quantity);
    expect(command.unitPrice).toBe(unitPrice);
    expect(command.amount).toBe(amount);
  });

  it.each([
    ['করিমের কাছ থেকে ২০ কেজি চাল ৭০ টাকা দরে কিনলাম', 'CREATE_PURCHASE'],
    ['২০ কেজি চাল ১৪০০ টাকায় কিনলাম', 'CREATE_PURCHASE'],
    ['করিমের কাছ থেকে ২০ কেজি চাল বাকিতে কিনলাম', 'CREATE_PURCHASE'],
    ['করিমের কাছ থেকে ২০ কেজি চাল কিনলাম, ৫০০ টাকা দিলাম', 'CREATE_PURCHASE'],
    ['Karim er kach theke 20 kg chal 70 taka dore kinlam', 'CREATE_PURCHASE'],
    ['I bought 20 kg rice from Karim for 1400 taka', 'CREATE_PURCHASE'],
  ])('%s → purchase command', async (text, action) => {
    const command = await parseVoiceV2(text);
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
    const command = await parseVoiceV2(text);
    expect(command.action).toBe(action);
    expect(command.amount).toBe(amount);
  });

  it('supports Bengali word amounts in ledger commands', async () => {
    const command = await parseVoiceV2('রহিমকে পাঁচশ টাকা দিলাম');

    expect(command.action).toBe('CREATE_DUE');
    expect(command.entityName).toBe('রহিম');
    expect(command.amount).toBe(500);
  });
});
