import { normalizeVoiceText } from '@/lib/voice/normalize';
import type { VoiceV2Command } from './schema';

const money = (value: unknown): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.round(n * 100) / 100;
};

const blank = (action: VoiceV2Command['action']): VoiceV2Command => ({
  action,
  entityType: 'NONE',
  entityName: null,
  targetId: null,
  amount: null,
  quantity: null,
  unit: null,
  unitPrice: null,
  paidAmount: null,
  phone: null,
  notes: null,
  partyType: null,
  query: null,
  confirmRequired: false,
});

export function parseSaleCommand(text: string): VoiceV2Command | null {
  let value = normalizeVoiceText(text)
    .replace(/[।,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // A walk-in/anonymous sale may omit the customer entirely.
  // Strip common phrases that explicitly say the buyer is unnamed/unknown.
  const anonymousBuyer =
    /(?:নাম\s*(?:জানা|জানি)\s*নেই|কাস্টমারের\s*নাম\s*(?:জানা|জানি)\s*নেই|অজানা\s*কাস্টমার|অজানা\s*ক্রেতা|একজন\s*কাস্টমার|একজন\s*ক্রেতা|walk[ -]?in\s*customer|unknown\s*customer)/iu.test(value);

  value = value
    .replace(/^(?:আজ\s+)?(?:নাম\s*(?:জানা|জানি)\s*নেই|কাস্টমারের\s*নাম\s*(?:জানা|জানি)\s*নেই)[,.]?\s*/iu, '')
    .replace(/^(?:আজ\s+)?(?:একজন\s*কাস্টমারের\s*কাছে|একজন\s*কাস্টমার\s*কে|একজন\s*ক্রেতার\s*কাছে|অজানা\s*কাস্টমারের\s*কাছে|অজানা\s*ক্রেতার\s*কাছে|walk[ -]?in\s*customer|unknown\s*customer)\s*/iu, '');

  const units = '(কেজি|kg|কিলো|কিলোগ্রাম|গ্রাম|gram|g|লিটার|liter|litre|ml|মিটার|meter|টা|টি|piece|pieces|pcs|বোতল|প্যাকেট|packet|box|unit|ইউনিট)';
  const saleVerb = '(?:বিক্রি|বেচা|বেচে|sell|sold)';
  const ending = '(?:করলাম|করেছি|করল|করলেন|করো|করুন|করেছে|করেছিলাম|দিলাম|দিয়েছি|দিয়ে ফেলেছি|করছি|করলাম)?';
  const credit = /(?:বাকি|বাকিতে|ক্রেডিট|credit|due)/iu.test(value);

  // Named customer: "রহিমকে ২ কেজি চাল ৭০ টাকা দরে বিক্রি করলাম"
  const namedPattern = new RegExp(
    '^(?:আজ\\s+)?(.+?)\\s*(?:কে|ke)\\s+(\\d[\\d,]*(?:\\.\\d+)?)\\s*' +
      units +
      '\\s+(.+?)\\s+(\\d[\\d,]*(?:\\.\\d+)?)\\s*' +
      '(?:টাকা|tk|taka)?\\s*(?:দরে|দাম(?:এ)?|rate|per)\\s+' +
      saleVerb + '\\s*' + ending + '$',
    'iu',
  );

  const named = value.match(namedPattern);
  if (named) {
    const party = named[1]
      .replace(/^(?:ভাই|স্যার|সাহেব|মিস্টার|মিসেস)\\s+/iu, '')
      .replace(/\\s+(?:ভাই|স্যার|সাহেব|sir|vai|bhai)$/iu, '')
      .trim();

    const quantity = Number(named[2].replace(/,/g, ''));
    const unit = named[3];
    const product = named[4]
      .replace(/^(?:নতুন\\s+)/iu, '')
      .replace(/\\s+(?:পণ্য|product|item|মাল)$/iu, '')
      .trim();
    const unitPrice = Number(named[5].replace(/,/g, ''));

    if (party && product && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(unitPrice) && unitPrice > 0) {
      const command = blank('CREATE_SALE');
      command.entityType = 'PRODUCT';
      command.entityName = product;
      command.quantity = quantity;
      command.unit = unit;
      command.unitPrice = unitPrice;
      command.query = party;
      command.partyType = 'CUSTOMER';
      command.amount = money(quantity * unitPrice);
      command.paidAmount = credit ? 0 : command.amount;
      return command;
    }
  }

  // Anonymous/walk-in: "২ কেজি চাল ৭০ টাকা দরে বিক্রি করলাম"
  // and "একজন কাস্টমারের কাছে ২ কেজি চাল ৭০ টাকা দরে বিক্রি করলাম"
  const anonymousRatePattern = new RegExp(
    '^(?:নগদে\\s+)?(\\d[\\d,]*(?:\\.\\d+)?)\\s*' +
      units +
      '\\s+(.+?)\\s+(\\d[\\d,]*(?:\\.\\d+)?)\\s*' +
      '(?:টাকা|tk|taka)?\\s*(?:দরে|দাম(?:এ)?|rate|per)\\s+' +
      saleVerb + '\\s*' + ending + '$',
    'iu',
  );

  const anonymousRate = value.match(anonymousRatePattern);
  if (anonymousRate) {
    const quantity = Number(anonymousRate[1].replace(/,/g, ''));
    const unit = anonymousRate[2 - 0] ? anonymousRate[2] : '';
    // Regex capture order is quantity, unit, product, price.
    const product = anonymousRate[3]
      .replace(/^(?:নতুন\\s+)/iu, '')
      .replace(/\\s+(?:পণ্য|product|item|মাল)$/iu, '')
      .trim();
    const unitPrice = Number(anonymousRate[4].replace(/,/g, ''));

    if (product && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(unitPrice) && unitPrice > 0) {
      const command = blank('CREATE_SALE');
      command.entityType = 'PRODUCT';
      command.entityName = product;
      command.quantity = quantity;
      command.unit = unit;
      command.unitPrice = unitPrice;
      command.query = null;
      command.partyType = null;
      command.amount = money(quantity * unitPrice);
      command.paidAmount = credit ? 0 : command.amount;
      return command;
    }
  }

  // Anonymous/walk-in with a total amount:
  // "২ কেজি চাল ১৪০ টাকায় বিক্রি করলাম"
  const anonymousTotalPattern = new RegExp(
    '^(?:নগদে\\s+)?(\\d[\\d,]*(?:\\.\\d+)?)\\s*' +
      units +
      '\\s+(.+?)\\s+(\\d[\\d,]*(?:\\.\\d+)?)\\s*' +
      '(?:টাকায়|টাকাতে|টাকা|tk|taka)\\s+' +
      saleVerb + '\\s*' + ending + '$',
    'iu',
  );

  const anonymousTotal = value.match(anonymousTotalPattern);
  if (anonymousTotal) {
    const quantity = Number(anonymousTotal[1].replace(/,/g, ''));
    const unit = anonymousTotal[2];
    const product = anonymousTotal[3]
      .replace(/^(?:নতুন\\s+)/iu, '')
      .replace(/\\s+(?:পণ্য|product|item|মাল)$/iu, '')
      .trim();
    const total = Number(anonymousTotal[4].replace(/,/g, ''));

    if (product && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(total) && total > 0) {
      const command = blank('CREATE_SALE');
      command.entityType = 'PRODUCT';
      command.entityName = product;
      command.quantity = quantity;
      command.unit = unit;
      command.unitPrice = money(total / quantity);
      command.query = null;
      command.partyType = null;
      command.amount = money(total);
      command.paidAmount = credit ? 0 : command.amount;
      return command;
    }
  }

  return null;
}

