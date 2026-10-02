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
    ['Rahim ke 500 taka dilam', 'CREATE_DUE', 'Rahim', 500],
  ])('%s → %s', async (text, action, name, amount) => {
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

  it('supports Bengali word amounts in ledger commands', async () => {
    const command = await parseVoiceV2('রহিমকে পাঁচশ টাকা দিলাম');

    expect(command.action).toBe('CREATE_DUE');
    expect(command.entityName).toBe('রহিম');
    expect(command.amount).toBe(500);
  });
});
