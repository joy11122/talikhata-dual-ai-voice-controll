
import 'server-only';

import OpenAI from 'openai';
import { Types } from 'mongoose';

import { auth } from '@/auth';
import { connectDB } from '@/lib/db';

import Party from '@/models/Party';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import User from '@/models/User';
import AuditLog from '@/models/AuditLog';

import {
  createTransaction,
  reverseTransaction,
  TransactionServiceError,
} from './transactionService';

import {
  resolveParty,
  resolveProduct,
} from './entityResolver';

import {
  VoiceV2Schema,
  VoiceV2JsonSchema,
  type VoiceV2Command,
} from '@/lib/voice-v2/schema';

import {
  normalizeVoiceText,
  extractNumber,
} from '@/lib/voice/normalize';
import { parseSaleCommand } from '@/lib/voice-v2/saleParser';

/* -------------------------------------------------------------------------- */
/* Error                                                                      */
/* -------------------------------------------------------------------------- */

export class VoiceV2Error extends Error {
  code: string;
  details?: unknown;

  constructor(
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'VoiceV2Error';
    this.code = code;
    this.details = details;
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : 0;

const money = (value: unknown): number =>
  Math.round(num(value) * 100) / 100;

const clean = (value: unknown): string | null =>
  typeof value === 'string' && value.trim()
    ? value.trim()
    : null;

const norm = (value: string): string =>
  normalizeVoiceText(value)
    .toLowerCase()
    .replace(/[।,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/* -------------------------------------------------------------------------- */
/* Blank command                                                              */
/* -------------------------------------------------------------------------- */

const blank = (
  action: VoiceV2Command['action'],
): VoiceV2Command => ({
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

function extractCreatePartyName(text: string): { name: string; partyType: 'CUSTOMER' | 'SUPPLIER' } | null {
  const value = normalizeVoiceText(text)
    .replace(/[।,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const partyCreateVerb = '(?:যোগ করো|যোগ কর|যোগ করুন|যোগ করেন|যোগ|এড করো|এড কর|এড করুন|এড করেন|অ্যাড করো|অ্যাড কর|অ্যাড করুন|অ্যাড করেন|add|add koro|add kor|add korun|add করো|add কর|add করুন|create|create koro|create kor|create korun|ক্রিয়েট কর|ক্রিয়েট করো|ক্রিয়েট করুন|ক্রিয়েট|ক্রিয়েট কর|ক্রিয়েট করো|ক্রিয়েট করুন|ক্রিয়েট|তৈরি করো|তৈরি কর|তৈরি করুন|তৈরি|বানাও|বানিয়ে দাও|বানিয়ে দাও|হিসেবে যোগ করো|হিসেবে যোগ কর|হিসেবে রাখো|লিস্টে রাখো|তালিকায় যোগ করো|তালিকায় যোগ করো|অ্যাকাউন্ট খুলে দাও|অ্যাকাউন্ট খোলো|রেজিস্টার করো|register|register koro|register kor|make customer|open account|jog koro|jog kor|jog korun)';
  const patterns = [
    new RegExp('^(.*?)\\s+(?:name|নামে)\\s+নতুন\\s+(customer|কাস্টমার|গ্রাহক|supplier|সাপ্লায়ার|সরবরাহকারী)\\s+' + partyCreateVerb + '$', 'iu'),
    new RegExp('^(.*?)\\s+(?:name|নামে)\\s+(customer|কাস্টমার|গ্রাহক|supplier|সাপ্লায়ার|সরবরাহকারী)\\s+' + partyCreateVerb + '$', 'iu'),
    new RegExp('^(.*?)\\s+নতুন\\s+(customer|কাস্টমার|গ্রাহক|supplier|সাপ্লায়ার|সরবরাহকারী)\\s+' + partyCreateVerb + '$', 'iu'),
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const name = match[1]?.trim();
    const type = match[2] || '';
    if (!name) continue;
    return {
      name,
      partyType: /^(supplier|সাপ্লায়ার|সরবরাহকারী)$/iu.test(type) ? 'SUPPLIER' : 'CUSTOMER',
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Party name extraction                                                      */
/* -------------------------------------------------------------------------- */

function partyName(text: string): string | null {
  const value = normalizeVoiceText(text)
    .replace(/[।,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanName = (raw: string) =>
    raw
      .replace(/^(?:ভাই|স্যার|সাহেব|মিস্টার|মিসেস)\s+/iu, '')
      .replace(/\s+(?:ভাই|স্যার|সাহেব|sir|vai|bhai)$/iu, '')
      .replace(/(?:এর|র|কে|দের|ে)$/u, '')
      .replace(/\s+(?:er|r|ke|der|e)$/i, '')
      .trim();

  const patterns = [
    /^(.+?)\s*(?:এর|র)\s*(?:কাছে)?\s*(?:কত|কতো)\s*(?:টাকা)?\s*(?:পাব|পাবে|পাও|বাকি|পাওনা|দেনা)/iu,
    /^(.+?)\s*(?:এর|র)\s*(?:কাছে)?\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:বাকি|পাওনা|দেনা|due|baki)(?:\s*(?:আছে|রয়েছে|রয়েছে|হয়েছে|হয়েছে))?/iu,
    /^(.+?)\s*কে\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:বাকি\s*)?(?:দিলাম|দিল|দিয়েছি|দিয়েছি|দেব|দিব|রাখলাম|রাখি|dilam|dilo|dil|diyechi|dibo)/iu,
    /^(.+?)\s+\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:দিল|দিলো|দিয়েছে|দিয়েছে|পাঠিয়েছে|পরিশোধ করেছে|dilo|dil|diyeche|paid)/iu,
    /^(.+?)\s*(?:এর|র)\s*(?:কাছ থেকে|কাছথেকে|থেকে)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:পেলাম|পেয়েছি|পেয়েছি|নিলাম|নিয়েছি|নিয়েছি|আদায় করলাম|আদায় করলাম|received|nilam)/iu,
    /^(.+?)\s+er\s+kache\s+\d[\d,]*(?:\.\d+)?\s*(?:taka|tk)?\s*(?:baki|due)(?:\s+.*)?$/i,
    /^(.+?)\s+er\s+baki\s*(?:koto|how much|ache)?$/i,
    /^(.+?)\s+ke\s+\d[\d,]*(?:\.\d+)?\s*(?:taka|tk)?\s*(?:baki\s*)?(?:dilam|dilo|dil|diyechi|dib|dibo|rakhlam|paid)?$/i,
    /^(.+?)\s+\d[\d,]*(?:\.\d+)?\s*(?:taka|tk)?\s*(?:dil|dilo|diyeche|paid)$/i,
    /^(.+?)\s+er\s+kach\s+theke\s+\d[\d,]*(?:\.\d+)?\s*(?:taka|tk)?\s*(?:pelam|peyechi|nilam|received)$/i,
    /^(.+?)\s*(?:এর|র)\s*(?:খাতায়|খাতায়|অ্যাকাউন্টে|account\s*e)\s*\d[\d,]*(?:\.\d+)?/iu,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      const name = cleanName(match[1]);
      if (name && !/^(?:কত|কতো|টাকা|taka|tk)$/iu.test(name)) {
        return name;
      }
    }
  }

  return null;
}



function parseCreateProductCommand(text: string): VoiceV2Command | null {
  const value = normalizeVoiceText(text)
    .replace(/[।,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const createVerb = '(?:যোগ করো|যোগ করুন|যোগ|add|create|বানাও|তৈরি করো|করো|করুন)';
  const productWord = '(?:পণ্য|product|item|মাল)';
  const price = '(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:টাকা|tk|taka)?\\s*(?:দরে|দাম(?:এ)?|rate|per)?';
  const unitPattern = '(কেজি|kg|কিলো|কিলোগ্রাম|টা|টি|piece|pieces|pcs|লিটার|liter|litre|মিটার|meter|গ্রাম|gram|g|ml|বোতল|প্যাকেট|packet|box|unit|ইউনিট)';

  const patterns: RegExp[] = [
    new RegExp('^(?:নতুন\\s+)?(.+?)\\s+' + price + '\\s+' + productWord + '(?:\\s+(?:হিসেবে|হিসাবে|as))?\\s+' + createVerb + '$', 'iu'),
    new RegExp('^(?:নতুন\\s+)?' + productWord + '\\s+(.+?)\\s+' + price + '\\s*' + createVerb + '$', 'iu'),
    new RegExp('^(?:নতুন\\s+)?(\\d[\\d,]*(?:\\.\\d+)?)\\s*' + unitPattern + '\\s+(.+?)\\s+' + price + '\\s+' + productWord + '(?:\\s+(?:হিসেবে|হিসাবে|as))?\\s+' + createVerb + '$', 'iu'),
    new RegExp('^(?:নতুন\\s+)?(.+?)\\s+' + productWord + '(?:\\s+(?:হিসেবে|হিসাবে|as))?\\s+' + createVerb + '$', 'iu'),
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;

    const groups = match.slice(1);
    const numeric = groups.find((g) => /^\\d[\\d,]*(?:\\.\\d+)?$/.test(g || ''));
    const unit = groups.find((g) => new RegExp('^' + unitPattern + '$', 'iu').test(g || '')) || null;
    const candidates = groups.filter((g) => g && g !== numeric && g !== unit);
    let name = candidates[0]?.trim() || '';

    name = name
      .replace(/^নতুন\\s+/iu, '')
      .replace(/^\\d[\\d,]*(?:\\.\\d+)?\\s*(?:কেজি|kg|কিলো|কিলোগ্রাম|টা|টি|piece|pieces|pcs|লিটার|liter|litre|মিটার|meter|গ্রাম|gram|g|ml|বোতল|প্যাকেট|packet|box|unit|ইউনিট)\\s+/iu, '')
      .replace(/\\s+(?:দরে|দাম(?:এ)?|rate|per)\\s*$/iu, '')
      .trim();

    if (!name || /^(?:পণ্য|product|item|মাল)$/iu.test(name)) continue;

    const command = blank('CREATE_PRODUCT');
    command.entityType = 'PRODUCT';
    command.entityName = name;
    command.unit = unit || 'unit';
    command.unitPrice = numeric ? Number(numeric.replace(/,/g, '')) : null;

    const quantityMatch = value.match(new RegExp('^(?:নতুন\\s+)?(\\d[\\d,]*(?:\\.\\d+)?)\\s*' + unitPattern + '\\s+', 'iu'));
    if (quantityMatch) {
      command.quantity = Number(quantityMatch[1].replace(/,/g, ''));
    }

    return command;
  }

  return null;
}

function replaceSpokenNumberWords(text: string): string {
  const words: Record<string, number> = {
    'শূন্য': 0, 'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5, 'ছয়': 6, 'ছয়': 6,
    'সাত': 7, 'আট': 8, 'নয়': 9, 'নয়': 9, 'দশ': 10, 'এগারো': 11, 'বারো': 12,
    'তেরো': 13, 'চৌদ্দ': 14, 'পনেরো': 15, 'ষোল': 16, 'সতেরো': 17, 'আঠারো': 18,
    'উনিশ': 19, 'বিশ': 20, 'একুশ': 21, 'বাইশ': 22, 'তেইশ': 23, 'চব্বিশ': 24,
    'পঁচিশ': 25, 'ছাব্বিশ': 26, 'সাতাশ': 27, 'আটাশ': 28, 'উনত্রিশ': 29,
    'ত্রিশ': 30, 'চল্লিশ': 40, 'পঞ্চাশ': 50, 'ষাট': 60, 'সত্তর': 70, 'আশি': 80,
    'নব্বই': 90, 'একশ': 100, 'একশো': 100, 'দুইশ': 200, 'দুইশো': 200,
    'তিনশ': 300, 'তিনশো': 300, 'চারশ': 400, 'চারশো': 400, 'পাঁচশ': 500,
    'পাঁচশো': 500, 'ছয়শ': 600, 'ছয়শ': 600, 'সাতশ': 700, 'সাতশো': 700,
    'আটশ': 800, 'আটশো': 800, 'নয়শ': 900, 'নয়শ': 900,
  };

  return text.split(/(\s+)/).map((token) => {
    const key = token.trim();
    return key && Object.prototype.hasOwnProperty.call(words, key)
      ? String(words[key])
      : token;
  }).join('');
}

function parseNaturalPurchaseCommand(text: string): VoiceV2Command | null {
  const value = replaceSpokenNumberWords(
    normalizeVoiceText(text).replace(/[।!?;:]/g, ' ').replace(/\s+/g, ' ').trim(),
  );
  const n = '(\\d[\\d,]*(?:\\.\\d+)?)';
  const units = '(কেজি|kg|কিলো|কিলোগ্রাম|গ্রাম|gram|g|লিটার|liter|litre|l|পিস|পিছ|টা|টি|piece|pieces|pcs|unit|ইউনিট)';
  const supplier = '(.+?)\\s+(?:এর\\s+কাছ\\s+থেকে|এর\\s+কাছথেকে|এর\\s+থেকে|er\\s+kach\\s+theke|er\\s+theke)\\s+';
  const buy = '(?:কিনলাম|কিনেছি|কিনেছে|কেনা হলো|ক্রয় করলাম|ক্রয় করেছি|bought|buy|purchased|purchase|kinlam|kinechi)';
  const rate = '(?:টাকা|taka|tk)?\\s*(?:দরে|ধরে|প্রতি|দর|rate|per|dore|dhore|proti)';
  const paid = '(?:দিলাম|দিল|দিয়েছি|দিয়েছি|দিয়েছে|দিয়েছে|paid|pay|dilam|dil|diyechi|diyeche)';
  const due = '(?:বাকি|বাকিতে|due|credit)';
  const patterns = [
    new RegExp('^'+supplier+n+'\\s*'+units+'\\s+(.+?)\\s+'+n+'\\s*'+rate+'\\s*'+buy+'(?:\\s*[, ]+)(?:'+n+')\\s*(?:টাকা|taka|tk)?\\s+'+paid+'$','iu'),
    new RegExp('^'+supplier+n+'\\s*'+units+'\\s+(.+?)\\s+'+n+'\\s*'+rate+'\\s*'+buy+'\\s+(?:'+n+')\\s*(?:টাকা|taka|tk)?\\s+'+due+'$','iu'),
  ];
  for(const pattern of patterns){
    const m=value.match(pattern); if(!m) continue;
    const supplierName=m[1]?.trim();
    const quantity=Number(m[2].replace(/,/g,''));
    const unit=m[3];
    const product=m[4]?.trim();
    const unitPrice=Number(m[5].replace(/,/g,''));
    const finalAmount=Number(m[6].replace(/,/g,''));
    const total=money(quantity*unitPrice);
    if(!supplierName||!product||!unit||quantity<=0||unitPrice<=0||total<=0) continue;
    const isPaid=/\s(?:দিলাম|দিল|দিয়েছি|দিয়েছি|দিয়েছে|দিয়েছে|paid|pay|dilam|dil|diyechi|diyeche)$/iu.test(value);
    const command=blank('CREATE_PURCHASE');
    command.entityType='PRODUCT'; command.entityName=product; command.query=supplierName;
    command.partyType='SUPPLIER'; command.quantity=quantity; command.unit=unit; command.unitPrice=unitPrice;
    command.amount=total; command.paidAmount=money(isPaid?finalAmount:total-finalAmount);
    if(command.paidAmount! < 0 || command.paidAmount! > total) return null;
    return command;
  }
  return null;
}

function parseInventoryPurchaseCommand(text: string): VoiceV2Command | null {
  const value = replaceSpokenNumberWords(
    normalizeVoiceText(text)
      .replace(/[।,!?;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

  const units = '(কেজি|kg|কিলো|কিলোগ্রাম|গ্রাম|gram|g|লিটার|liter|litre|l|পিস|পিছ|পিসে|টা|টি|piece|pieces|pcs|unit|ইউনিট|ডজন|dozen)';
  const number = '(\\d[\\d,]*(?:\\.\\d+)?)';
  const purchaseWords = '(?:কিনলাম|কিনেছি|কিনেছে|কেনা হলো|কেনা করলাম|ক্রয় করলাম|ক্রয় করেছি|ক্রয়|purchase|purchased|bought|buy|kinlam|kinechi)';
  const addWords = '(?:যোগ করো|যোগ কর|যোগ করুন|যোগ করেন|যোগ|এড করো|এড কর|এড করুন|এড করেন|এড|অ্যাড করো|অ্যাড কর|অ্যাড করুন|অ্যাড করেন|অ্যাড|ঢুকাও|ঢুকাও তো|ঢোকাও|ঢুকিয়ে দাও|ঢুকিয়ে দাও|ঢোকান|ঢুকান|স্টকে রাখো|স্টকে দাও|স্টকে ঢোকাও|স্টকে যোগ করো|স্টক করো|স্টক কর|স্টক করুন|মজুদ করো|মজুদ করুন|মাল হিসেবে রাখো|মাল যোগ করো|মাল ঢোকাও|পণ্য হিসেবে রাখো|পণ্য হিসেবে যোগ করো|পণ্য হিসেবে নাও|পণ্য বানাও|পণ্য তৈরি করো|হিসাবের মধ্যে রাখো|গুদামে রাখো|দাও|দিয়ে রাখো|add করো|add কর|add করুন|add করেন|add|add it|add this|add product|add to stock|add to inventory|create|create product|create an item|put|put in stock|stock in|stock-in|stock it|stock to inventory|record purchase|record as purchase|enter product|enter into stock|jog koro|jog korun|jog kor|jog korun|ed koro|ed kor|ed korun|add koro|add kor|add korun|dhukao|dhukao to|dhokao|dhukiye dao|dhukie dao|stock e dao|stock e rakho|stock e dhukao|stock e jog koro|ponno hisebe rakho|ponno hisebe add koro|mal hisebe rakho|mal jog koro|kine rakho|kine nao|purchase hisebe rakho|mjud koro|mjud korun|dhukiye dao)';
  const rateWords = '(?:দরে|ধরে|দাম(?:এ|তে)?|প্রতি|দর|dore|dhore|dam|dame|proti|per|rate|at)';

  const purchasePatterns = [
    {
      pattern: new RegExp('^' + number + '\\s*' + units + '\\s+(.+?)\\s+' + number + '\\s*(?:টাকা|taka|tk)?\\s*' + rateWords + '\\s*' + purchaseWords + '$', 'iu'),
      quantityIndex: 1, nameIndex: 3, priceIndex: 4,
    },
    {
      pattern: new RegExp('^' + number + '\\s*(?:টাকা|taka|tk)?\\s*' + rateWords + '\\s+' + number + '\\s*' + units + '\\s+(.+?)\\s*' + purchaseWords + '$', 'iu'),
      quantityIndex: 2, nameIndex: 4, priceIndex: 1,
    },
    {
      pattern: new RegExp('^(?:আজ|today)\\s+(.+?)\\s+' + number + '\\s*' + units + '\\s+' + number + '\\s*(?:টাকা|taka|tk)?\\s*' + rateWords + '\\s*' + purchaseWords + '$', 'iu'),
      quantityIndex: 2, nameIndex: 1, priceIndex: 3,
    },
  ];

  for (const { pattern, quantityIndex, nameIndex, priceIndex } of purchasePatterns) {
    const m = value.match(pattern);
    if (!m) continue;
    const quantity = Number((m[quantityIndex] || '').replace(/,/g, ''));
    const unit = value.match(new RegExp(units, 'iu'))?.[1] || null;
    const unitPrice = Number((m[priceIndex] || '').replace(/,/g, ''));
    const name = (m[nameIndex] || '').replace(/^(?:আজ|today)\s+/iu, '').trim();
    if (!name || !unit || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) continue;

    const command = blank('STOCK_IN');
    command.entityType = 'PRODUCT';
    command.entityName = name;
    command.quantity = quantity;
    command.unit = unit;
    command.unitPrice = unitPrice;
    return command;
  }

  const addPatterns = [
    new RegExp('^' + number + '\\s*(?:টাকা|taka|tk)?\\s*' + rateWords + '\\s+' + number + '\\s*' + units + '\\s+(.+?)\\s+' + addWords + '$', 'iu'),
    new RegExp('^' + number + '\\s*' + units + '\\s+(.+?)\\s+' + number + '\\s*(?:টাকা|taka|tk)?\\s*' + rateWords + '\\s+' + addWords + '$', 'iu'),
    new RegExp('^(.+?)\\s+' + number + '\\s*' + units + '\\s+' + number + '\\s*(?:টাকা|taka|tk)?\\s*' + rateWords + '\\s+' + addWords + '$', 'iu'),
    new RegExp('^(.+?)\\s+' + number + '\\s*' + units + '\\s+' + addWords + '\\s+' + number + '\\s*(?:টাকা|taka|tk)?\\s*' + rateWords + '$', 'iu'),
  ];

  for (const pattern of addPatterns) {
    const m = value.match(pattern);
    if (!m) continue;
    const nums = [...value.matchAll(new RegExp(number, 'g'))].map(x => Number(x[1].replace(/,/g, '')));
    const unit = value.match(new RegExp(units, 'iu'))?.[1] || null;
    if (nums.length < 2 || !unit) continue;
    const candidates = m.slice(1).filter(Boolean);
    const name = candidates.find(x => !new RegExp('^' + number + '$').test(x.trim()) && !new RegExp('^' + units + '$','iu').test(x.trim()))?.trim() || '';
    if (!name) continue;
    const command = blank('CREATE_PRODUCT');
    command.entityType = 'PRODUCT';
    command.entityName = name;
    const firstNumberIsPrice = new RegExp('^' + number + '\\s*(?:টাকা|taka|tk)?\\s*' + rateWords, 'iu').test(value);
    command.quantity = firstNumberIsPrice ? nums[1] : nums[0];
    command.unit = unit;
    command.unitPrice = firstNumberIsPrice ? nums[0] : nums[1];
    return command;
  }

  return null;
}
/* -------------------------------------------------------------------------- */
/* Deterministic shop-finance parser                                         */
/* -------------------------------------------------------------------------- */

function parseShopFinanceCommand(text: string): VoiceV2Command | null {
  const value = replaceSpokenNumberWords(norm(text));
  const amount = extractNumber(text);
  if (amount === null || amount <= 0) return null;

  const result = (action: VoiceV2Command['action'], name: string | null = null): VoiceV2Command => {
    const command = blank(action);
    command.entityType = name ? (/supplier|সরবরাহকারী|সাপ্লায়ার|করিম/iu.test(value) ? 'SUPPLIER' : 'CUSTOMER') : 'NONE';
    command.entityName = name ? name.trim().replace(/(?:এর|ের|র|কে|দের|ে)$/u, '').replace(/\s+(?:er|r|ke|der|e)$/i, '').trim() : null;
    command.partyType = command.entityType === 'SUPPLIER' ? 'SUPPLIER' : command.entityType === 'CUSTOMER' ? 'CUSTOMER' : null;
    command.amount = amount;
    return command;
  };

  // Supplier payable/payment: keep this before the customer-only ledger parser.
  let m = value.match(/^(.+?)\s+(?:কে|কে\s+|er\s+kache\s+)?(?:দিতে হবে|দিতে হবে|পাওনা)\s*[^\d০-৯]*$/iu)
    || value.match(/^(.+?)\s+(?:কে|ke)\s*[^\d০-৯]*(?:দিতে হবে|pay করতে হবে|pay|dewa hobe)$/iu);
  if (m?.[1] && /(?:supplier|সরবরাহকারী|সাপ্লায়ার)/iu.test(value)) {
    return result('CREATE_DUE', m[1]);
  }

  // Explicit supplier wording makes the party direction unambiguous.
  if (/(?:supplier|সরবরাহকারী|সাপ্লায়ার|supplier\s+er)/iu.test(value)) {
    const name = value.match(/(?:supplier|সরবরাহকারী|সাপ্লায়ার)\s+(.+?)(?:\s+(?:দিতে|pay|কে|এর|র))/iu)?.[1] || null;
    if (name && /(?:দিতে|pay|পাওনা|বাকি|due)/iu.test(value)) {
      const command = result('CREATE_DUE', name);
      command.entityType = 'SUPPLIER';
      command.partyType = 'SUPPLIER';
      return command;
    }
  }

  // Expenses.
  if (/(?:খরচ|ব্যয়|ব্যয়|ভাড়া|ভাড়া|বিদ্যুৎ|বিল|পরিবহন|চা|খাবার|বেতন|মজুরি|expense|spent|cost|rent|electricity|transport|tea|salary|wage)/iu.test(value)) {
    const command = result('CREATE_EXPENSE');
    command.notes = text.trim();
    return command;
  }

  // Other income, explicitly excluding ordinary customer payment wording.
  if (/(?:অতিরিক্ত আয়|অতিরিক্ত আয়|অন্যান্য আয়|অন্যান্য আয়|কমিশন|other income|extra income|commission)/iu.test(value)
      && !/(?:কাস্টমার|customer|কাছ থেকে|received|payment|পেলাম|পেয়েছি)/iu.test(value)) {
    const command = result('CREATE_INCOME');
    command.notes = text.trim();
    return command;
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Deterministic ledger direction parser                                      */
/* -------------------------------------------------------------------------- */

function parseLedgerDirectionCommand(text: string): VoiceV2Command | null {
  const value = norm(text);
  const amount = extractNumber(text);
  if (amount === null || amount <= 0) return null;

  const numberPattern = '(?:\\d[\\d,]*(?:\\.\\d+)?|[০-৯]+|(?:[^\\d\\s]+)(?:\\s+[^\\d\\s]+){0,3})';

  const command = (action: VoiceV2Command['action'], rawName: string): VoiceV2Command => {
    const name = rawName
      .trim()
      .replace(/^(?:আমি|আমরা|i|we)\\s+/iu, '')
      .replace(/\\s+(?:আমাকে|আমার কাছে|me|to me)$/iu, '')
      .replace(/(?:এর|ের|র|কে|দের)$/u, '')
      .replace(/ে$/u, '')
      .replace(/\\s+(?:er|r|ke|der)$/i, '')
      .trim();

    const result = blank(action);
    result.entityType = 'CUSTOMER';
    result.entityName = name;
    result.partyType = 'CUSTOMER';
    result.amount = amount;
    return result;
  };

  let match = value.match(new RegExp(
    '^(.+?)\\s*(?:এর|ের|র)?\\s*(?:কাছ থেকে|কাছথেকে|থেকে)\\s*' +
    numberPattern +
    '\\s*(?:টাকা|tk|taka)?\\s*(?:পেলাম|পেয়েছি|পেয়েছি|নিলাম|নিয়েছি|নিয়েছি|আদায় করলাম|আদায় করলাম|received|got|nilam|pelam|peyechi)$',
    'iu',
  ));
  if (match?.[1]) return command('RECEIVE_PAYMENT', match[1]);

  match = value.match(new RegExp(
    '^(.+?)(?:\\s+(?:আমাকে|আমার কাছে|me|to me))?\\s*' +
    numberPattern +
    '\\s*(?:টাকা|tk|taka)?\\s*(?:দিল|দিলো|দিয়েছে|দিয়েছে|জমা দিল|জমা দিয়েছে|জমা দিয়েছে|পরিশোধ করল|পরিশোধ করেছে|paid|received|dilo|diyeche)$',
    'iu',
  ));
  if (match?.[1]) return command('RECEIVE_PAYMENT', match[1]);

  match = value.match(new RegExp(
    '^(.+?)\\s*(?:আমাকে|আমার কাছে)?\\s*দেবে\\s*' + numberPattern +
    '\\s*(?:টাকা|tk|taka)?$',
    'iu',
  ))
    || value.match(new RegExp(
      '^(.+?)\\s*' + numberPattern + '\\s*(?:টাকা|tk|taka)?\\s*দেবে$',
      'iu',
    ))
    || value.match(new RegExp(
      '^(.+?)\\s*(?:এর|ের|র)\\s*(?:কাছে)\\s*(?:পাবো|পাব|পাবে|পাও|pabo|pabe)\\s*' +
      numberPattern + '\\s*(?:টাকা|tk|taka)?$',
      'iu',
    ))
    || value.match(new RegExp(
      '^(.+?)\\s*(?:এর|ের|র)\\s*(?:কাছে)\\s*' + numberPattern +
      '\\s*(?:টাকা|tk|taka)?\\s*(?:পাবো|পাব|পাবে|পাও|pabo|pabe)$',
      'iu',
    ));
  if (match?.[1]) return command('CREATE_DUE', match[1]);

  match = value.match(new RegExp(
    '^(.+?)\\s*(?:এর|ের|র)\\s*(?:কাছে\\s*)?(?:বাকি|পাওনা|দেনা|due|baki)\\s*' +
    numberPattern + '\\s*(?:টাকা|tk|taka)?$',
    'iu',
  ))
    || value.match(new RegExp(
      '^(.+?)\\s*(?:এর|ের|র)\\s*(?:কাছে\\s*)?' + numberPattern +
      '\\s*(?:টাকা|tk|taka)?\\s*(?:বাকি|পাওনা|দেনা|due|baki)$',
      'iu',
    ));
  if (match?.[1]) return command('CREATE_DUE', match[1]);

  match = value.match(new RegExp(
    '^(.+?)\\s*(?:কে|ke)\\s*(?:দিলাম|দিল|দিয়েছি|দিয়েছি|দেবো|দেব|দিবো|দিব|dilam|dil|diyechi|debo|deb|dibo)\\s*' +
    numberPattern + '\\s*(?:টাকা|tk|taka)?(?:\\s+.*)?$',
    'iu',
  ))
    || value.match(new RegExp(
      '^(.+?)\\s*(?:কে|ke)\\s*' + numberPattern +
      '\\s*(?:টাকা|tk|taka)?\\s*(?:বাকি\\s*)?(?:দিলাম|দিল|দিয়েছি|দিয়েছি|দেবো|দেব|দিবো|দিব|dilam|dil|diyechi|debo|deb|dibo)(?:\\s+.*)?$',
      'iu',
    ));
  if (match?.[1]) return command('CREATE_DUE', match[1]);

  match = value.match(new RegExp(
    '^(.+?)\\s+(?:বাকি|বাকিতে|ধারে|উধারে|due|baki|bakite|dhare|credit)\\s*' +
    numberPattern + '\\s*(?:টাকা|tk|taka)?\\s*(?:নিল|নিলো|নিয়েছে|নিয়েছে|নেবে|নিবে|নেবো|নিবো|নিলাম|nil|nilo|niyeche|niyechi|nibe|nebe|nebo|nibo|nilam|took|take|taken)$',
    'iu',
  ))
    || value.match(new RegExp(
      '^(.+?)\\s*' + numberPattern + '\\s*(?:টাকা|tk|taka)?\\s*(?:বাকি|বাকিতে|ধারে|উধারে|due|baki|bakite|dhare|credit)\\s*(?:নিল|নিলো|নিয়েছে|নিয়েছে|নেবে|নিবে|নেবো|নিবো|নিলাম|nil|nilo|niyeche|niyechi|nibe|nebe|nebo|nibo|nilam|took|take|taken)$',
      'iu',
    ))
    || value.match(new RegExp(
      '^(.+?)\\s*(?:নিল|নিলো|নিয়েছে|নিয়েছে|নেবে|নিবে|নেবো|নিবো|নিলাম|nil|nilo|niyeche|niyechi|nibe|nebe|nebo|nibo|nilam|took|take|taken)\\s*' +
      numberPattern + '\\s*(?:টাকা|tk|taka)?\\s*(?:বাকি|বাকিতে|ধারে|উধারে|due|baki|bakite|dhare|credit)$',
      'iu',
    ));
  if (match?.[1]) return command('CREATE_DUE', match[1]);

  match = value.match(new RegExp(
    '^(?:আমি|আমরা|i|we)\\s+(.+?)\\s*(?:এর|ের|র)?\\s*(?:কাছ থেকে|কাছথেকে|থেকে)\\s*' +
    numberPattern + '\\s*(?:টাকা|tk|taka)?\\s*(?:নেবো|নেব|নিবো|নিব|পাবো|পাব|nebo|nibo|pabo)$',
    'iu',
  ));
  if (match?.[1]) return command('RECEIVE_PAYMENT', match[1]);

  return null;
}

/* -------------------------------------------------------------------------- */
/* Local parser                                                               */
/* -------------------------------------------------------------------------- */

function localParse(text: string): VoiceV2Command | null {
  const inventory = parseInventoryPurchaseCommand(text);
  if (inventory) return inventory;

  const createProduct = parseCreateProductCommand(text);
  if (createProduct) return createProduct;

  const sale = parseSaleCommand(text);
  if (sale) return sale;

  const shopFinance = parseShopFinanceCommand(text);
  if (shopFinance) return shopFinance;

  // Resolve high-confidence party-money direction before generic heuristics or AI.
  const ledgerDirection = parseLedgerDirectionCommand(text);
  if (ledgerDirection) return ledgerDirection;

  const value = norm(text);
  const amount = extractNumber(text);
  const name = partyName(text);

  const createParty = extractCreatePartyName(text);
  if (createParty) {
    const command = blank('CREATE_PARTY');
    command.entityType = createParty.partyType;
    command.entityName = createParty.name;
    command.partyType = createParty.partyType;
    return command;
  }

  // Defensive local fallback: create-party commands must never reach a paid AI
  // provider just because a speech transcript used a slightly different ending.
  const createPartyFallback = value.match(
    /^(.*?)\\s+(?:name|নামে)\\s+নতুন\\s+(customer|কাস্টমার|গ্রাহক|supplier|সাপ্লায়ার|সরবরাহকারী)\\s+(?:যোগ|add|create)(?:\\s+(?:কর|করো|করুন|করতে|দাও|দাওনা))?$/iu,
  );
  if (createPartyFallback?.[1]?.trim()) {
    const partyType =
      /^(supplier|সাপ্লায়ার|সরবরাহকারী)$/iu.test(createPartyFallback[2] || '')
        ? 'SUPPLIER'
        : 'CUSTOMER';
    const command = blank('CREATE_PARTY');
    command.entityType = partyType;
    command.entityName = createPartyFallback[1].trim();
    command.partyType = partyType;
    return command;
  }

  const list = /(?:list|তালিকা|সব|সকল|দেখাও|দেখান|দেখতে চাই|show|dao|দাও|লিস্ট)/i.test(value);

  if (/(?:customer|কাস্টমার|গ্রাহক|party|পার্টি)/i.test(value) && list) {
    const command = blank('LIST_PARTIES');
    command.entityType = 'CUSTOMER';
    command.partyType = 'CUSTOMER';
    return command;
  }

  if (/(?:supplier|সরবরাহকারী|সাপ্লায়ার|সাপ্লাইয়ার)/i.test(value) && list) {
    const command = blank('LIST_PARTIES');
    command.entityType = 'SUPPLIER';
    command.partyType = 'SUPPLIER';
    return command;
  }

  if (/(?:product|পণ্য|item|আইটেম|মাল)/i.test(value) && list) {
    return blank('LIST_PRODUCTS');
  }

  if (/(?:transaction|লেনদেন|হিসাব|খাতা|ট্রানজেকশন)/i.test(value) && list) {
    return blank('LIST_TRANSACTIONS');
  }

  const customerOwes =
    /(?:বাকি|পাওনা|দেনা|due|baki|credit|খাতায়|খাতায়|হিসাবে|বাড়াও|বাড়াও|যোগ করো|যোগ করুন|রাখলাম|রাখো)/iu.test(value);

  const customerPaid =
    /(?:কাছ থেকে|কাছথেকে|থেকে).*?(?:পেলাম|পেয়েছি|পেয়েছি|নিলাম|নিয়েছি|নিয়েছি|আদায়|আদায়|পরিশোধ|জমা)|(?:পেলাম|পেয়েছি|পেয়েছি|দিল|দিয়েছে|দিয়েছে|পরিশোধ করেছে|জমা দিল|জমা দিয়েছে|জমা দিয়েছে|paid|received|payment|pelam|peyechi|nilam|diyeche)/iu.test(value);

  const moneyGivenToParty =
    /(?:কে|ke)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:দিলাম|দিল|দিয়েছি|দিয়েছি|দেব|দিব|রাখলাম|রাখো|dilam|dil|dilo|diyechi|dibo)/iu.test(value);

  const balanceQuery =
    /(?:কত|কতো|বাকি কত|পাওনা কত|দেনা কত|হিসাব|খাতার হিসাব|balance|due|pabo|pabe|koto|hisab|how much|kototuku)/i.test(value);

  if (name && balanceQuery && !amount) {
    const command = blank('READ_BALANCE');
    command.entityType = 'CUSTOMER';
    command.entityName = name;
    command.partyType = 'CUSTOMER';
    return command;
  }

  if (name && amount && customerPaid && !moneyGivenToParty) {
    const command = blank('RECEIVE_PAYMENT');
    command.entityType = 'CUSTOMER';
    command.entityName = name;
    command.partyType = 'CUSTOMER';
    command.amount = amount;
    return command;
  }

  if (name && amount && (moneyGivenToParty || customerOwes)) {
    const command = blank('CREATE_DUE');
    command.entityType = 'CUSTOMER';
    command.entityName = name;
    command.partyType = 'CUSTOMER';
    command.amount = amount;
    return command;
  }

  if (name && amount && /(?:দিলাম|দিল|দিয়েছি|দিয়েছি|dilam|dil|dilo|diyechi)/iu.test(value)) {
    const command = blank('CREATE_DUE');
    command.entityType = 'CUSTOMER';
    command.entityName = name;
    command.partyType = 'CUSTOMER';
    command.amount = amount;
    return command;
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Semantic post-normalization                                                */
/* -------------------------------------------------------------------------- */

/**
 * Correct only high-confidence party-payment direction after the LLM.
 * This prevents a provider from confusing "Rahim gave me 500" with
 * "I gave Rahim 500", which is the most expensive class of voice error.
 */
function normalizeLedgerSemantics(
  command: VoiceV2Command,
  text: string,
): VoiceV2Command {
  const value = norm(text);
  const name = partyName(text);
  const amount = extractNumber(text);
  if (!name || amount === null) return command;

  if (command.partyType === 'SUPPLIER' || command.entityType === 'SUPPLIER') {
    return { ...command, entityType: 'SUPPLIER', partyType: 'SUPPLIER', entityName: command.entityName || name, amount };
  }

  const outgoingToParty =
    /(?:কে|ke)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:দিলাম|দিল|দিয়েছি|দিয়েছি|দেব|দিব|রাখলাম|dilam|dil|dilo|diyechi|dibo)/iu.test(value);
  const incomingFromParty =
    /(?:কাছ থেকে|কাছথেকে|থেকে)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:পেলাম|পেয়েছি|পেয়েছি|নিলাম|নিয়েছি|নিয়েছি|আদায়|আদায়|পরিশোধ|জমা)/iu.test(value) ||
    /^(?:.+?)\s+(\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:দিল|দিলো|দিয়েছে|দিয়েছে|পরিশোধ করেছে|paid|received)$/iu.test(value);

  if (outgoingToParty && ['RECEIVE_PAYMENT', 'CREATE_DUE'].includes(command.action)) {
    return { ...command, action: 'CREATE_DUE', entityType: 'CUSTOMER', partyType: 'CUSTOMER', entityName: command.entityName || name, amount };
  }
  if (incomingFromParty && ['CREATE_DUE', 'RECEIVE_PAYMENT'].includes(command.action)) {
    return { ...command, action: 'RECEIVE_PAYMENT', entityType: 'CUSTOMER', partyType: 'CUSTOMER', entityName: command.entityName || name, amount };
  }
  return command;
}

/* -------------------------------------------------------------------------- */
/* AI system prompt                                                           */
/* -------------------------------------------------------------------------- */

const SYSTEM = [
  'You are TaliKhata Voice Engine V2 for a Bangladesh shop ledger.',
  'Understand Bangla, Banglish, English, mixed speech, Bengali/Arabic digits and colloquial wording.',
  'Extract intent and preserve names exactly; remove Bengali/Banglish case endings such as কে, এর, র, er, ke when they are grammatical suffixes.',
  'Return exactly one emit_voice_command tool call. Never invent names, IDs, amounts, quantities, prices, phone numbers or database facts.',
  'Party: CREATE_PARTY, READ_PARTY, LIST_PARTIES, UPDATE_PARTY, DELETE_PARTY. Destructive actions require confirmation.',
  'Ledger: CREATE_DUE means a customer owes the shop or the shop owes a supplier; RECEIVE_PAYMENT means money received from a customer/supplier. Direction and party type matter. Supplier payable/payment must use partyType SUPPLIER.',
  'READ_BALANCE answers how much a named party owes/is owed. CREATE_SALE/PURCHASE/EXPENSE and STOCK_IN/OUT represent the corresponding shop operations.',
  'Products: CREATE_PRODUCT, READ_PRODUCT, LIST_PRODUCTS, UPDATE_PRODUCT, DELETE_PRODUCT. Transactions: LIST_TRANSACTIONS or DELETE_TRANSACTION.',
  'Users are admin-only: CREATE_USER, READ_USER, LIST_USERS, UPDATE_USER, DELETE_USER. Never expose or invent passwords.',
  'If required information is genuinely missing, leave it null. Use query for supported filters that do not have a dedicated field.',
  'Financial writes above 10000 and destructive operations require confirmation.'
].join('\\n');

/* -------------------------------------------------------------------------- */
/* OpenAI tool                                                                */
/* -------------------------------------------------------------------------- */

const VOICE_V2_TOOL = {
  type: 'function' as const,

  function: {
    name: 'emit_voice_command',

    description:
      'Return the single validated TaliKhata command requested by the user.',

    parameters: VoiceV2JsonSchema,
  },
};

/* -------------------------------------------------------------------------- */
/* Provider types                                                             */
/* -------------------------------------------------------------------------- */

type VoiceProvider = {
  name: 'openai' | 'openrouter';
  apiKey: string;
  model: string;
  baseURL?: string;
};

/* -------------------------------------------------------------------------- */
/* Provider configuration                                                      */
/* -------------------------------------------------------------------------- */

function getProviders(): VoiceProvider[] {
  const providers: VoiceProvider[] = [];

  const openAIKey = process.env.OPENAI_API_KEY?.trim();

  if (openAIKey) {
    providers.push({
      name: 'openai',
      apiKey: openAIKey,
      model:
        process.env.OPENAI_VOICE_MODEL?.trim() ||
        'gpt-4.1-mini',
    });
  }

  const openRouterKey =
    process.env.OPENROUTER_API_KEY?.trim();

  if (openRouterKey) {
    providers.push({
      name: 'openrouter',
      apiKey: openRouterKey,
      model:
        process.env.OPENROUTER_VOICE_MODEL?.trim() ||
        'openai/gpt-4.1-mini',
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  return providers;
}

/* -------------------------------------------------------------------------- */
/* Tool-call extraction                                                       */
/* -------------------------------------------------------------------------- */

function getToolArguments(response: OpenAI.Chat.Completions.ChatCompletion): string {
  const toolCalls = response.choices[0]?.message?.tool_calls;

  if (!toolCalls?.length) {
    throw new Error(
      'Provider returned no tool calls.',
    );
  }

  const functionCall = toolCalls.find(
    (
      call,
    ): call is Extract<
      OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
      { type: 'function' }
    > => call.type === 'function',
  );

  if (!functionCall?.function?.arguments) {
    throw new Error(
      'Provider returned no function arguments.',
    );
  }

  return functionCall.function.arguments;
}

/* -------------------------------------------------------------------------- */
/* AI parser                                                                  */
/* -------------------------------------------------------------------------- */

async function aiParse(
  text: string,
): Promise<VoiceV2Command> {
  const providers = getProviders();

  if (!providers.length) {
    throw new VoiceV2Error(
      'AI_NOT_CONFIGURED',
      'No voice AI provider is configured. Add OPENAI_API_KEY or OPENROUTER_API_KEY to .env.local.',
      {
        providers: [],
      },
    );
  }

  const errors: Array<{
    provider: string;
    model: string;
    message: string;
  }> = [];

  for (const provider of providers) {
    try {
      console.info(
        `[VoiceV2] Trying ${provider.name} with ${provider.model}`,
      );

      const client = new OpenAI({
        apiKey: provider.apiKey,

        baseURL: provider.baseURL,

        timeout: 10_000,

        maxRetries: 0,

        defaultHeaders:
          provider.name === 'openrouter'
            ? {
                'HTTP-Referer':
                  process.env.NEXT_PUBLIC_APP_URL ||
                  'http://localhost:3000',

                'X-Title':
                  'TaliKhata Voice V2',
              }
            : undefined,
      });

      const response =
        await client.chat.completions.create({
          model: provider.model,

          messages: [
            {
              role: 'system',
              content: SYSTEM,
            },
            {
              role: 'user',
              content: text,
            },
          ],

          temperature: 0,

          // Voice commands only need a small structured JSON payload.
          // Explicitly cap completion tokens so OpenRouter does not reserve
          // a large default budget (e.g. 65,536 tokens) for each request.
          max_tokens: 128,

          tools: [VOICE_V2_TOOL],

          tool_choice: {
            type: 'function',
            function: {
              name: 'emit_voice_command',
            },
          },
        });

      const argumentsJSON =
        getToolArguments(response);

      let parsed: unknown;

      try {
        parsed = JSON.parse(argumentsJSON);
      } catch {
        throw new Error(
          'Provider returned invalid JSON in function arguments.',
        );
      }

      // Providers may vary enum casing (e.g. "product"). Normalize only known enum fields before strict validation.
      if (parsed && typeof parsed === 'object') {
        const value = parsed as Record<string, unknown>;
        for (const key of ['action', 'entityType', 'partyType']) {
          if (typeof value[key] === 'string') value[key] = value[key].toUpperCase();
        }
      }

      const validated =
        VoiceV2Schema.safeParse(parsed);

      if (!validated.success) {
        const issues = validated.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        }));

        console.error('[VoiceV2] Invalid AI command:', issues);

        throw new Error(
          `Provider returned a command that failed TaliKhata validation: ${issues.map((issue) => `${issue.path || 'command'}: ${issue.message}`).join('; ')}`,
        );
      }

      console.info(
        `[VoiceV2] ${provider.name} succeeded`,
      );

      return validated.data;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      errors.push({
        provider: provider.name,
        model: provider.model,
        message,
      });

      console.error(
        `[VoiceV2] ${provider.name} failed`,
        {
          model: provider.model,
          message,
          error,
        },
      );
    }
  }

  throw new VoiceV2Error(
    'AI_UNAVAILABLE',
    'Voice AI providers are temporarily unavailable. Please try again.',
    {
      providers: errors,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Public parser                                                              */
/* -------------------------------------------------------------------------- */

export async function parseVoiceV2(
  text: string,
): Promise<VoiceV2Command> {
  const normalized = text.trim();

  if (!normalized) {
    throw new VoiceV2Error(
      'EMPTY_COMMAND',
      'Voice command is empty.',
    );
  }

  const local = localParse(normalized);

  if (local) {
    return normalizeLedgerSemantics(local, normalized);
  }

  const ai = await aiParse(normalized);
  return normalizeLedgerSemantics(ai, normalized);
}

/* -------------------------------------------------------------------------- */
/* Party resolver                                                             */
/* -------------------------------------------------------------------------- */

async function findParty(
  userId: string,
  name: string,
  session: any,
  type?: 'CUSTOMER' | 'SUPPLIER',
) {
  const all = await resolveParty(
    userId,
    name,
    session,
  );

  const rows = type
    ? all.filter(
        (party: any) =>
          party.partyType === type,
      )
    : all;

  if (!rows.length) {
    throw new VoiceV2Error(
      'NOT_FOUND',
      `${
        type === 'SUPPLIER'
          ? 'Supplier'
          : 'Customer'
      } "${name}" was not found`,
      {
        name,
      },
    );
  }

  if (rows.length > 1) {
    throw new VoiceV2Error(
      'AMBIGUOUS_ENTITY',
      `Multiple parties matched "${name}"`,
      {
        matches: rows
          .slice(0, 10)
          .map((party: any) => ({
            id: String(party._id),
            name: party.name,
            phone: party.phone || null,
            balance: party.currentBalance,
          })),
      },
    );
  }

  return rows[0];
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

async function requireAdmin(
  userId: string,
) {
  const user = await User.findById(userId)
    .select('role status')
    .lean();

  if (
    !user ||
    user.status !== 'ACTIVE' ||
    user.role !== 'ADMIN'
  ) {
    throw new VoiceV2Error(
      'FORBIDDEN',
      'Admin permission is required for user management.',
    );
  }

  return user;
}

/* -------------------------------------------------------------------------- */
/* Product resolver                                                           */
/* -------------------------------------------------------------------------- */

async function findProduct(
  userId: string,
  name: string,
  session: any,
) {
  const rows = await resolveProduct(
    userId,
    name,
    session,
  );

  if (!rows.length) {
    throw new VoiceV2Error(
      'NOT_FOUND',
      `Product "${name}" was not found`,
      {
        name,
      },
    );
  }

  if (rows.length > 1) {
    throw new VoiceV2Error(
      'AMBIGUOUS_ENTITY',
      `Multiple products matched "${name}"`,
      {
        matches: rows
          .slice(0, 10)
          .map((product: any) => ({
            id: String(product._id),
            name: product.name,
            stock: product.stockQuantity,
            unit: product.unit,
          })),
      },
    );
  }

  return rows[0];
}

async function findOrCreateProduct(
  userId: string,
  name: string,
  session: any,
  input: { unit?: string | null; quantity?: number | null; unitPrice?: number | null },
) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new VoiceV2Error('MISSING_ENTITY', 'Product name is required');
  }

  const candidates = await resolveProduct(userId, normalizedName, session);

  if (candidates.length === 1) {
    return { product: candidates[0], created: false };
  }

  if (candidates.length > 1) {
    throw new VoiceV2Error(
      'AMBIGUOUS_ENTITY',
      `Multiple products matched "${normalizedName}"`,
      {
        matches: candidates.slice(0, 10).map((product: any) => ({
          id: String(product._id),
          name: product.name,
          stock: product.stockQuantity,
          unit: product.unit,
        })),
      },
    );
  }

  const [created] = await Product.create(
    [{
      userId: new Types.ObjectId(userId),
      name: normalizedName,
      unit: input.unit?.trim() || 'unit',
      stockQuantity: 0,
      buyPrice: money(input.unitPrice),
      sellPrice: 0,
      lowStockThreshold: 5,
    }],
    { session },
  );

  return { product: created, created: true };
}

/* -------------------------------------------------------------------------- */
/* Party creation / resolution                                                 */
/* -------------------------------------------------------------------------- */

async function findOrCreateParty(
  userId: string,
  name: string,
  session: any,
  type: 'CUSTOMER' | 'SUPPLIER',
) {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new VoiceV2Error(
      'MISSING_ENTITY',
      type === 'SUPPLIER'
        ? 'Supplier name is required'
        : 'Customer name is required',
    );
  }

  const candidates = await resolveParty(
    userId,
    normalizedName,
    session,
  );

  const sameType = candidates.filter(
    (party: any) => party.partyType === type,
  );

  if (sameType.length === 1) {
    return { party: sameType[0], created: false };
  }

  if (sameType.length > 1) {
    throw new VoiceV2Error(
      'AMBIGUOUS_ENTITY',
      'Multiple ' +
        (type === 'SUPPLIER' ? 'suppliers' : 'customers') +
        ' matched "' +
        normalizedName +
        '".',
      {
        matches: sameType.slice(0, 10).map((party: any) => ({
          id: String(party._id),
          name: party.name,
          phone: party.phone || null,
          balance: party.currentBalance,
        })),
      },
    );
  }

  try {
    const [created] = await Party.create(
      [
        {
          userId: new Types.ObjectId(userId),
          name: normalizedName,
          partyType: type,
          currentBalance: 0,
        },
      ],
      { session },
    );

    return { party: created, created: true };
  } catch (error) {
    if (
      error instanceof Error &&
      /E11000|duplicate/i.test(error.message)
    ) {
      const retry = await resolveParty(
        userId,
        normalizedName,
        session,
      );

      const retrySameType = retry.filter(
        (party: any) => party.partyType === type,
      );

      if (retrySameType.length === 1) {
        return {
          party: retrySameType[0],
          created: false,
        };
      }
    }

    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Confirmation                                                               */
/* -------------------------------------------------------------------------- */

function confirm(
  command: VoiceV2Command,
  confirmed: boolean,
) {
  const destructiveActions = new Set([
    'DELETE_PARTY',
    'DELETE_PRODUCT',
    'DELETE_TRANSACTION',
    'DELETE_USER',
  ]);

  const amount = money(command.amount);

  const highValueWrite =
    amount >= 10000 &&
    [
      'CREATE_DUE',
      'RECEIVE_PAYMENT',
      'CREATE_SALE',
      'CREATE_PURCHASE',
      'CREATE_EXPENSE',
      'CREATE_INCOME',
    ].includes(command.action);

  const needsConfirmation =
    command.confirmRequired ||
    destructiveActions.has(command.action) ||
    highValueWrite;

  if (needsConfirmation && !confirmed) {
    throw new VoiceV2Error(
      'CONFIRMATION_REQUIRED',
      highValueWrite
        ? '৳১০,০০০ বা তার বেশি আর্থিক লেনদেন করার আগে confirmation প্রয়োজন।'
        : 'এই কাজটি করার আগে confirmation প্রয়োজন।',
      {
        action: command.action,
        amount: amount || null,
        reason: highValueWrite
          ? 'HIGH_VALUE_FINANCIAL_WRITE'
          : 'DESTRUCTIVE_ACTION',
      },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Execute Voice V2                                                           */
/* -------------------------------------------------------------------------- */

export async function executeVoiceV2(
  commandInput: VoiceV2Command,
  userId: string,
  transcript = '',
  confirmed = false,
  commandId?: string,
) {
  /* ---------------------------------------------------------------------- */
  /* Authentication                                                         */
  /* ---------------------------------------------------------------------- */

  const sessionUser = await auth();

  if (
    !sessionUser?.user?.id ||
    sessionUser.user.id !== userId
  ) {
    throw new VoiceV2Error(
      'UNAUTHORIZED',
      'Unauthorized',
    );
  }

  if (!Types.ObjectId.isValid(userId)) {
    throw new VoiceV2Error(
      'UNAUTHORIZED',
      'Invalid user',
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Validate command                                                       */
  /* ---------------------------------------------------------------------- */

  const parsedCommand =
    VoiceV2Schema.parse(commandInput);

  // Product creation is intentionally tolerant of omitted units in natural voice.
  // Mongo still receives a valid unit so commands such as "চাল ৭০ টাকা দরে পণ্য হিসেবে যোগ করো"
  // can create the catalog item instead of failing only because the spoken unit was omitted.
  const command: VoiceV2Command =
    parsedCommand.action === 'CREATE_PRODUCT'
      ? { ...parsedCommand, unit: parsedCommand.unit || 'unit' }
      : parsedCommand;

  confirm(command, confirmed);

  /* ---------------------------------------------------------------------- */
  /* Database                                                               */
  /* ---------------------------------------------------------------------- */

  await connectDB();

  const uid = new Types.ObjectId(userId);

  /* ---------------------------------------------------------------------- */
  /* Idempotency                                                             */
  /* ---------------------------------------------------------------------- */

  if (commandId) {
    const old = await AuditLog.findOne({
      userId: uid,
      commandId,
      status: 'SUCCESS',
    }).lean();

    if (old?.result) {
      return old.result;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Balance                                                                */
  /* ---------------------------------------------------------------------- */

  if (command.action === 'READ_BALANCE') {
    if (!command.entityName) {
      throw new VoiceV2Error(
        'MISSING_ENTITY',
        'Customer name is required',
      );
    }

    const party = await findParty(
      userId,
      command.entityName,
      null,
      'CUSTOMER',
    );

    const balance = money(
      party.currentBalance,
    );

    return {
      type: 'READ_BALANCE',

      party: {
        id: String(party._id),
        name: party.name,
        phone: party.phone || null,
      },

      balance,

      receivable: Math.max(
        0,
        balance,
      ),

      payable: Math.max(
        0,
        -balance,
      ),
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Read / List                                                             */
  /* ---------------------------------------------------------------------- */

  if (
    [
      'READ_PARTY',
      'READ_PRODUCT',
      'LIST_PARTIES',
      'LIST_PRODUCTS',
      'LIST_TRANSACTIONS',
      'READ_USER',
      'LIST_USERS',
    ].includes(command.action)
  ) {
    if (command.action === 'READ_PARTY') {
      if (!command.entityName) {
        throw new VoiceV2Error(
          'MISSING_ENTITY',
          'Party name is required',
        );
      }

      return {
        type: 'READ_PARTY',
        party: await findParty(
          userId,
          command.entityName,
          null,
          command.partyType || undefined,
        ),
      };
    }

    if (command.action === 'READ_PRODUCT') {
      if (!command.entityName) {
        throw new VoiceV2Error(
          'MISSING_ENTITY',
          'Product name is required',
        );
      }

      return {
        type: 'READ_PRODUCT',
        product: await findProduct(
          userId,
          command.entityName,
          null,
        ),
      };
    }

    if (command.action === 'READ_USER') {
      await requireAdmin(userId);

      const user =
        await User.findOne(
          command.query
            ? {
                email:
                  command.query.toLowerCase(),
                _id: {
                  $ne: uid,
                },
              }
            : {
                _id:
                  command.targetId &&
                  Types.ObjectId.isValid(
                    command.targetId,
                  )
                    ? new Types.ObjectId(
                        command.targetId,
                      )
                    : uid,
              },
        )
          .select('-password')
          .lean();

      if (!user) {
        throw new VoiceV2Error(
          'NOT_FOUND',
          'User was not found',
        );
      }

      return {
        type: 'READ_USER',
        user,
      };
    }

    if (command.action === 'LIST_USERS') {
      await requireAdmin(userId);

      const rows = await User.find({})
        .select('-password')
        .sort({
          createdAt: -1,
        })
        .limit(200)
        .lean();

      return {
        type: 'LIST_USERS',
        items: rows,
      };
    }

    if (
      command.action === 'LIST_PARTIES'
    ) {
      const query: any = {
        userId: uid,
      };

      if (command.partyType) {
        query.partyType =
          command.partyType;
      }

      const rows = await Party.find(query)
        .sort({
          name: 1,
        })
        .limit(200)
        .lean();

      return {
        type: 'LIST_PARTIES',
        items: rows.map(
          (party: any) => ({
            id: String(party._id),
            name: party.name,
            phone: party.phone || null,
            partyType: party.partyType,
            balance:
              party.currentBalance,
          }),
        ),
      };
    }

    if (
      command.action === 'LIST_PRODUCTS'
    ) {
      const rows = await Product.find({
        userId: uid,
      })
        .sort({
          name: 1,
        })
        .limit(200)
        .lean();

      return {
        type: 'LIST_PRODUCTS',
        items: rows,
      };
    }

    const rows =
      await Transaction.find({
        userId: uid,
        isDeleted: {
          $ne: true,
        },
      })
        .sort({
          timestamp: -1,
        })
        .limit(100)
        .lean();

    return {
      type: 'LIST_TRANSACTIONS',
      items: rows,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Transaction session                                                    */
  /* ---------------------------------------------------------------------- */

  const session =
    await Party.startSession();

  let result: any;

  try {
    await session.withTransaction(
      async () => {
        /* ---------------------------------------------------------------- */
        /* USER CRUD                                                         */
        /* ---------------------------------------------------------------- */

        if (
          command.action ===
            'CREATE_USER' ||
          command.action ===
            'UPDATE_USER' ||
          command.action ===
            'DELETE_USER'
        ) {
          await requireAdmin(userId);

          if (
            command.action ===
            'CREATE_USER'
          ) {
            const email =
              clean(command.query)
                ?.toLowerCase();

            if (
              !command.entityName ||
              !email ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                email,
              )
            ) {
              throw new VoiceV2Error(
                'INVALID_USER',
                'Name and valid email are required',
              );
            }

            const duplicate =
              await User.findOne({
                email,
              }).session(session);

            if (duplicate) {
              throw new VoiceV2Error(
                'DUPLICATE_ENTITY',
                'A user with this email already exists',
              );
            }

            const [user] =
              await User.create(
                [
                  {
                    name:
                      command.entityName,

                    email,

                    phone:
                      command.phone ||
                      undefined,

                    role: 'USER',

                    status: 'ACTIVE',
                  },
                ],
                {
                  session,
                },
              );

            result = {
              type: 'CREATE_USER',

              user: {
                id: String(user._id),
                name: user.name,
                email: user.email,
                phone:
                  user.phone || null,
                role: user.role,
                status: user.status,
              },
            };
          } else {
            const target =
              command.query
                ?.toLowerCase();

            const filter: any =
              target
                ? {
                    email: target,
                  }
                : {
                    _id:
                      command.targetId &&
                      Types.ObjectId.isValid(
                        command.targetId,
                      )
                        ? new Types.ObjectId(
                            command.targetId,
                          )
                        : null,
                  };

            if (
              !filter._id &&
              !filter.email
            ) {
              throw new VoiceV2Error(
                'MISSING_ENTITY',
                'User email or id is required',
              );
            }

            const user =
              await User.findOne(
                filter,
              ).session(session);

            if (!user) {
              throw new VoiceV2Error(
                'NOT_FOUND',
                'User was not found',
              );
            }

            if (
              String(user._id) ===
                userId &&
              command.action ===
                'DELETE_USER'
            ) {
              throw new VoiceV2Error(
                'DELETE_BLOCKED',
                'You cannot delete your own account by voice.',
              );
            }

            if (
              command.action ===
              'UPDATE_USER'
            ) {
              const update: any = {};

              if (command.entityName) {
                update.name =
                  command.entityName;
              }

              if (command.phone) {
                update.phone =
                  command.phone;
              }

              if (
                command.notes &&
                [
                  'ACTIVE',
                  'SUSPENDED',
                ].includes(
                  command.notes,
                )
              ) {
                update.status =
                  command.notes;
              }

              if (
                command.partyType ===
                'CUSTOMER'
              ) {
                update.role = 'USER';
              }

              if (
                !Object.keys(update)
                  .length
              ) {
                throw new VoiceV2Error(
                  'INVALID_UPDATE',
                  'No user fields to update',
                );
              }

              const updated =
                await User.findOneAndUpdate(
                  {
                    _id: user._id,
                  },
                  {
                    $set: update,
                  },
                  {
                    new: true,
                    session,
                  },
                )
                  .select('-password')
                  .lean();

              result = {
                type: 'UPDATE_USER',
                user: updated,
              };
            } else {
              const hasData =
                await Promise.all([
                  Party.exists({
                    userId: user._id,
                  }).session(session),

                  Product.exists({
                    userId: user._id,
                  }).session(session),

                  Transaction.exists({
                    userId: user._id,
                  }).session(session),
                ]);

              if (hasData.some(Boolean)) {
                throw new VoiceV2Error(
                  'DELETE_BLOCKED',
                  'This user owns ledger data and cannot be deleted safely.',
                );
              }

              await User.deleteOne(
                {
                  _id: user._id,
                },
                {
                  session,
                },
              );

              result = {
                type: 'DELETE_USER',
                id: String(
                  user._id,
                ),
                email: user.email,
              };
            }
          }
        }

        /* ---------------------------------------------------------------- */
        /* CREATE PARTY                                                      */
        /* ---------------------------------------------------------------- */

        else if (
          command.action ===
          'CREATE_PARTY'
        ) {
          if (!command.entityName) {
            throw new VoiceV2Error(
              'MISSING_ENTITY',
              'Party name is required',
            );
          }

          const partyType =
            command.partyType ||
            'CUSTOMER';

          const escaped =
            command.entityName.replace(
              /[.*+?^\${}()|[\]\\]/g,
              '\\$&',
            );

          const duplicate =
            await Party.findOne({
              userId: uid,
              name: new RegExp(
                `^${escaped}$`,
                'i',
              ),
            }).session(session);

          if (duplicate) {
            throw new VoiceV2Error(
              'DUPLICATE_ENTITY',
              `A party named "${command.entityName}" already exists`,
              {
                matches: [
                  {
                    id: String(
                      duplicate._id,
                    ),
                    name: duplicate.name,
                    phone:
                      duplicate.phone ||
                      null,
                    balance:
                      duplicate.currentBalance,
                  },
                ],
              },
            );
          }

          const [party] =
            await Party.create(
              [
                {
                  userId: uid,
                  name:
                    command.entityName,
                  phone:
                    command.phone ||
                    undefined,
                  partyType,
                  currentBalance: 0,
                },
              ],
              {
                session,
              },
            );

          result = {
            type: 'CREATE_PARTY',
            id: String(party._id),
            name: party.name,
            phone:
              party.phone || null,
            partyType:
              party.partyType,
            balance: 0,
          };
        }

        /* ---------------------------------------------------------------- */
        /* UPDATE PARTY                                                      */
        /* ---------------------------------------------------------------- */

        else if (
          command.action ===
          'UPDATE_PARTY'
        ) {
          if (!command.entityName) {
            throw new VoiceV2Error(
              'MISSING_ENTITY',
              'Party name is required',
            );
          }

          const party =
            await findParty(
              userId,
              command.entityName,
              session,
              command.partyType ||
                undefined,
            );

          const update: any = {};

          if (command.phone) {
            update.phone =
              command.phone;
          }

          if (command.query) {
            update.name =
              command.query;
          }

          if (
            !Object.keys(update).length
          ) {
            throw new VoiceV2Error(
              'INVALID_UPDATE',
              'No party fields to update',
            );
          }

          result = {
            type: 'UPDATE_PARTY',

            party:
              await Party.findOneAndUpdate(
                {
                  _id: party._id,
                  userId: uid,
                },
                {
                  $set: update,
                },
                {
                  new: true,
                  session,
                },
              ).lean(),
          };
        }

        /* ---------------------------------------------------------------- */
        /* DELETE PARTY                                                      */
        /* ---------------------------------------------------------------- */

        else if (
          command.action ===
          'DELETE_PARTY'
        ) {
          if (!command.entityName) {
            throw new VoiceV2Error(
              'MISSING_ENTITY',
              'Party name is required',
            );
          }

          const party =
            await findParty(
              userId,
              command.entityName,
              session,
              command.partyType ||
                undefined,
            );

          const hasTransactions =
            await Transaction.exists({
              userId: uid,
              partyId: party._id,
            }).session(session);

          if (hasTransactions) {
            throw new VoiceV2Error(
              'DELETE_BLOCKED',
              'This party has transaction history and cannot be deleted safely.',
            );
          }

          await Party.deleteOne(
            {
              _id: party._id,
              userId: uid,
            },
            {
              session,
            },
          );

          result = {
            type: 'DELETE_PARTY',
            id: String(party._id),
            name: party.name,
          };
        }

        /* ---------------------------------------------------------------- */
        /* CREATE PRODUCT                                                    */
        /* ---------------------------------------------------------------- */

        else if (
          command.action ===
          'CREATE_PRODUCT'
        ) {
          if (
            !command.entityName ||
            !command.unit
          ) {
            throw new VoiceV2Error(
              'INVALID_PRODUCT',
              'Product name and unit are required',
            );
          }

          const escaped =
            command.entityName.replace(
              /[.*+?^\${}()|[\]\\]/g,
              '\\$&',
            );

          const duplicate =
            await Product.findOne({
              userId: uid,
              name: new RegExp(
                `^${escaped}$`,
                'i',
              ),
            }).session(session);

          if (duplicate) {
            throw new VoiceV2Error(
              'DUPLICATE_ENTITY',
              `Product "${command.entityName}" already exists`,
            );
          }

          const [product] =
            await Product.create(
              [
                {
                  userId: uid,
                  name:
                    command.entityName,
                  unit:
                    command.unit,
                  stockQuantity:
                    num(command.quantity),
                  buyPrice:
                    num(command.unitPrice),
                  sellPrice: 0,
                  lowStockThreshold: 5,
                },
              ],
              {
                session,
              },
            );

          result = {
            type: 'CREATE_PRODUCT',
            id: String(
              product._id,
            ),
            name: product.name,
            unit: product.unit,
            stock:
              product.stockQuantity,
            buyPrice:
              product.buyPrice,
            sellPrice:
              product.sellPrice,
          };
        }

        /* ---------------------------------------------------------------- */
        /* UPDATE PRODUCT                                                    */
        /* ---------------------------------------------------------------- */

        else if (
          command.action ===
          'UPDATE_PRODUCT'
        ) {
          if (!command.entityName) {
            throw new VoiceV2Error(
              'MISSING_ENTITY',
              'Product name is required',
            );
          }

          const product =
            await findProduct(
              userId,
              command.entityName,
              session,
            );

          const update: any = {};

          if (command.unit) {
            update.unit =
              command.unit;
          }

          if (
            command.unitPrice !==
            null
          ) {
            update.buyPrice =
              num(command.unitPrice);
          }

          if (command.query) {
            update.name =
              command.query;
          }

          if (
            !Object.keys(update).length
          ) {
            throw new VoiceV2Error(
              'INVALID_UPDATE',
              'No product fields to update',
            );
          }

          result = {
            type: 'UPDATE_PRODUCT',

            product:
              await Product.findOneAndUpdate(
                {
                  _id: product._id,
                  userId: uid,
                },
                {
                  $set: update,
                },
                {
                  new: true,
                  session,
                },
              ).lean(),
          };
        }

        /* ---------------------------------------------------------------- */
        /* DELETE PRODUCT                                                    */
        /* ---------------------------------------------------------------- */

        else if (
          command.action ===
          'DELETE_PRODUCT'
        ) {
          if (!command.entityName) {
            throw new VoiceV2Error(
              'MISSING_ENTITY',
              'Product name is required',
            );
          }

          const product =
            await findProduct(
              userId,
              command.entityName,
              session,
            );

          const hasTransactions =
            await Transaction.exists({
              userId: uid,
              productId: product._id,
            }).session(session);

          if (hasTransactions) {
            throw new VoiceV2Error(
              'DELETE_BLOCKED',
              'This product has transaction history and cannot be deleted safely.',
            );
          }

          await Product.deleteOne(
            {
              _id: product._id,
              userId: uid,
            },
            {
              session,
            },
          );

          result = {
            type: 'DELETE_PRODUCT',
            id: String(
              product._id,
            ),
            name: product.name,
          };
        }

        /* ---------------------------------------------------------------- */
        /* DUE / PAYMENT                                                     */
        /* ---------------------------------------------------------------- */

        else if (
          command.action ===
            'CREATE_DUE' ||
          command.action ===
            'RECEIVE_PAYMENT'
        ) {
          if (
            !command.entityName ||
            !command.amount ||
            command.amount <= 0
          ) {
            throw new VoiceV2Error(
              'INVALID_TRANSACTION',
              'Customer and positive amount are required',
            );
          }

          let party;
          let partyCreated = false;

          if (command.partyType === 'SUPPLIER' || command.entityType === 'SUPPLIER') {
            const resolved = await findOrCreateParty(
              userId,
              command.entityName,
              session,
              'SUPPLIER',
            );
            party = resolved.party;
            partyCreated = resolved.created;
          } else {
            const existingSupplier = await Party.findOne({
              userId: new Types.ObjectId(userId),
              name: command.entityName,
              partyType: 'SUPPLIER',
            }).session(session);

            if (existingSupplier) {
              party = existingSupplier;
            } else {
              const resolved = await findOrCreateParty(
                userId,
                command.entityName,
                session,
                'CUSTOMER',
              );
              party = resolved.party;
              partyCreated = resolved.created;
            }
          }

          const transaction =
            await createTransaction(
              {
                type:
                  command.action ===
                  'CREATE_DUE'
                    ? 'DUE_GIVEN'
                    : 'DUE_RECEIVED',

                partyId: String(
                  party._id,
                ),

                amount:
                  command.amount,

                quantity: 0,

                notes:
                  command.notes ||
                  undefined,
              },
              userId,
              session,
            );

          result = {
            type: command.action,
            amount:
              command.amount,

            party: {
              id: String(party._id),
              name: party.name,
              created: partyCreated,
            },

            transaction,
          };
        }

        /* ---------------------------------------------------------------- */
        /* STOCK                                                              */
        /* ---------------------------------------------------------------- */

        else if (
          command.action ===
            'STOCK_IN' ||
          command.action ===
            'STOCK_OUT'
        ) {
          if (
            !command.entityName ||
            !command.quantity ||
            command.quantity <= 0
          ) {
            throw new VoiceV2Error(
              'INVALID_STOCK',
              'Product and positive quantity are required',
            );
          }

          const resolvedProduct =
            command.action === 'STOCK_IN'
              ? await findOrCreateProduct(
                  userId,
                  command.entityName,
                  session,
                  {
                    unit: command.unit,
                    quantity: command.quantity,
                    unitPrice: command.unitPrice,
                  },
                )
              : { product: await findProduct(userId, command.entityName, session), created: false };

          const product = resolvedProduct.product;

          const transaction =
            await createTransaction(
              {
                type:
                  command.action ===
                  'STOCK_IN'
                    ? 'STOCK_IN'
                    : 'STOCK_OUT',

                productId: String(
                  product._id,
                ),

                amount: money(
                  num(
                    command.quantity,
                  ) *
                    num(
                      command.unitPrice,
                    ),
                ),

                quantity:
                  command.quantity,

                unitPrice:
                  command.unitPrice ??
                  undefined,

                notes:
                  command.notes ||
                  undefined,
              },
              userId,
              session,
            );

          const fresh =
            await Product.findById(
              product._id,
            )
              .session(session)
              .lean();

          result = {
            type: command.action,

            product: {
              id: String(product._id),
              name: product.name,
              unit: product.unit,
              created: resolvedProduct.created,
            },

            quantity:
              command.quantity,

            stock: num(
              fresh?.stockQuantity,
            ),

            transaction,
          };
        }

        /* ---------------------------------------------------------------- */
        /* SALE / PURCHASE                                                   */
        /* ---------------------------------------------------------------- */

        else if (
          command.action ===
            'CREATE_SALE' ||
          command.action ===
            'CREATE_PURCHASE'
        ) {
          const isAmountOnlySale =
            command.action === 'CREATE_SALE' &&
            !command.entityName &&
            !command.quantity &&
            !command.unitPrice &&
            !!command.amount &&
            command.amount > 0;

          if (
            !isAmountOnlySale &&
            (!command.entityName ||
              !command.quantity ||
              command.quantity <= 0 ||
              !command.unitPrice ||
              command.unitPrice <= 0)
          ) {
            throw new VoiceV2Error(
              'INVALID_TRADE',
              'Product, quantity and unit price are required for an inventory sale or purchase',
            );
          }

          const resolvedProduct =
            isAmountOnlySale
              ? { product: null, created: false }
              : command.action === 'CREATE_PURCHASE'
                ? await findOrCreateProduct(
                    userId,
                    command.entityName!,
                    session,
                    {
                      unit: command.unit,
                      quantity: command.quantity!,
                      unitPrice: command.unitPrice!,
                    },
                  )
                : { product: await findProduct(userId, command.entityName!, session), created: false };

          const product = resolvedProduct.product;

          const total = isAmountOnlySale
            ? money(command.amount)
            : money(
                command.quantity! *
                  command.unitPrice!,
              );

          const paid = num(
            command.paidAmount,
          );

          if (paid > total) {
            throw new VoiceV2Error(
              'INVALID_PAYMENT',
              'Paid amount cannot exceed total amount',
            );
          }

          if (
            command.action ===
            'CREATE_SALE'
          ) {
            let partyId:
              | string
              | undefined;

            let customerCreated = false;

            if (command.query) {
              const resolved = await findOrCreateParty(userId, command.query, session, 'CUSTOMER');
              partyId = String(resolved.party._id);
              customerCreated = resolved.created;
            } else if (paid < total) {
              throw new VoiceV2Error(
                'PARTY_REQUIRED',
                'A customer is required for an unpaid or credit sale. For a walk-in sale, say "নগদে" or provide the customer name.',
              );
            }

            const transaction =
              await createTransaction(
                {
                  type: 'SALE',

                  partyId,

                  productId: product ? String(product._id) : undefined,

                  amount: total,

                  quantity: command.quantity ?? 0,

                  unitPrice: command.unitPrice ?? undefined,

                  paidAmount: paid,

                  notes:
                    command.notes ||
                    undefined,
                },
                userId,
                session,
              );

            result = {
              type: 'CREATE_SALE',

              product:
                product?.name ?? null,

              total,

              paidAmount: paid,

              due: money(total - paid),
              customerCreated,
              transaction,
            };
          } else {
            if (!command.query) {
              throw new VoiceV2Error(
                'PARTY_REQUIRED',
                'Supplier name is required for a purchase',
              );
            }

            const supplierResolved = await findOrCreateParty(userId, command.query, session, 'SUPPLIER');
            const supplier = supplierResolved.party;

            const transaction =
              await createTransaction(
                {
                  type: 'STOCK_IN',

                  partyId: String(
                    supplier._id,
                  ),

                  productId: String(
                    product._id,
                  ),

                  amount: total,

                  quantity:
                    command.quantity,

                  unitPrice:
                    command.unitPrice,

                  paidAmount: paid,

                  notes:
                    command.notes ||
                    undefined,
                },
                userId,
                session,
              );

            const due = money(
              total - paid,
            );

            if (due > 0) {
              await Party.updateOne(
                {
                  _id:
                    supplier._id,
                  userId: uid,
                },
                {
                  $inc: {
                    currentBalance:
                      -due,
                  },
                },
                {
                  session,
                },
              );
            }

            result = {
              type: 'CREATE_PURCHASE',

              product:
                product.name,

              supplier: supplier.name,
              supplierCreated: supplierResolved.created,
              total,

              paidAmount: paid,

              due,

              transaction,
            };
          }
        }

        /* ---------------------------------------------------------------- */
        /* EXPENSE                                                            */
        /* ---------------------------------------------------------------- */

        else if (
          command.action ===
          'CREATE_EXPENSE'
        ) {
          if (
            !command.amount ||
            command.amount <= 0
          ) {
            throw new VoiceV2Error(
              'INVALID_EXPENSE',
              'Positive expense amount is required',
            );
          }

          const transaction =
            await createTransaction(
              {
                type: 'EXPENSE',

                amount:
                  command.amount,

                quantity: 0,

                notes:
                  command.notes ||
                  transcript,
              },
              userId,
              session,
            );

          result = {
            type: 'CREATE_EXPENSE',
            amount:
              command.amount,
            transaction,
          };
        }

        /* ---------------------------------------------------------------- */
        /* OTHER INCOME                                                     */
        /* ---------------------------------------------------------------- */

        else if (
          command.action ===
          'CREATE_INCOME'
        ) {
          if (!command.amount || command.amount <= 0) {
            throw new VoiceV2Error(
              'INVALID_INCOME',
              'Positive income amount is required',
            );
          }

          const transaction =
            await createTransaction(
              {
                type: 'OTHER_INCOME',
                amount: command.amount,
                quantity: 0,
                notes: command.notes || transcript,
              },
              userId,
              session,
            );

          result = {
            type: 'CREATE_INCOME',
            amount: command.amount,
            transaction,
          };
        }

        /* ---------------------------------------------------------------- */
        /* DELETE TRANSACTION                                                */
        /* ---------------------------------------------------------------- */

        else if (
          command.action ===
          'DELETE_TRANSACTION'
        ) {
          if (
            !command.targetId ||
            !Types.ObjectId.isValid(
              command.targetId,
            )
          ) {
            throw new VoiceV2Error(
              'MISSING_ENTITY',
              'Valid transaction id is required',
            );
          }

          result = {
            type: 'DELETE_TRANSACTION',

            reversal:
              await reverseTransaction(
                command.targetId,
                userId,
                session,
              ),
          };
        }

        /* ---------------------------------------------------------------- */
        /* Unsupported                                                        */
        /* ---------------------------------------------------------------- */

        else {
          throw new VoiceV2Error(
            'UNSUPPORTED_ACTION',
            `Action ${command.action} is not implemented yet.`,
          );
        }
      },
      {
        readConcern: {
          level: 'local',
        },

        writeConcern: {
          w: 'majority',
        },

        maxCommitTimeMS: 10_000,
      },
    );
  } catch (error) {
    if (error instanceof VoiceV2Error) {
      throw error;
    }

    if (
      error instanceof
      TransactionServiceError
    ) {
      throw new VoiceV2Error(
        error.code,
        error.message,
        error.details,
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }

  /* ---------------------------------------------------------------------- */
  /* Audit                                                                   */
  /* ---------------------------------------------------------------------- */

  if (commandId) {
    await AuditLog.create({
      userId: uid,

      voiceTranscript:
        transcript,

      parsedIntent:
        command,

      status: 'SUCCESS',

      commandId,

      result,
    }).catch(() => {});
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Local parser                                                               */
/* -------------------------------------------------------------------------- */

