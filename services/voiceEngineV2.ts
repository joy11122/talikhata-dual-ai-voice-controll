
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

  const patterns = [
    /^(.*?)\s+(?:name|নামে)\s+নতুন\s+(customer|কাস্টমার|গ্রাহক|supplier|সাপ্লায়ার|সরবরাহকারী)\s+(?:যোগ করো|যোগ করুন|যোগ|add|create|করো|করুন)$/iu,
    /^(.*?)\s+(?:name|নামে)\s+(customer|কাস্টমার|গ্রাহক|supplier|সাপ্লায়ার|সরবরাহকারী)\s+(?:যোগ করো|যোগ করুন|যোগ|add|create|করো|করুন)$/iu,
    /^(.*?)\s+নতুন\s+(customer|কাস্টমার|গ্রাহক|supplier|সাপ্লায়ার|সরবরাহকারী)\s+(?:যোগ করো|যোগ করুন|যোগ|add|create|করো|করুন)$/iu,
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

/* -------------------------------------------------------------------------- */
/* Local parser                                                               */
/* -------------------------------------------------------------------------- */

function localParse(text: string): VoiceV2Command | null {
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

  if (!name || amount === null) {
    return command;
  }

  const outgoingToParty =
    /(?:কে|ke)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:দিলাম|দিল|দিয়েছি|দিয়েছি|দেব|দিব|রাখলাম|dilam|dil|dilo|diyechi|dibo)/iu.test(value);

  const incomingFromParty =
    /(?:কাছ থেকে|কাছথেকে|থেকে)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:পেলাম|পেয়েছি|পেয়েছি|নিলাম|নিয়েছি|নিয়েছি|আদায়|আদায়|পরিশোধ|জমা)/iu.test(value) ||
    /^(?:.+?)\s+\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:দিল|দিলো|দিয়েছে|দিয়েছে|পরিশোধ করেছে|paid|received)$/iu.test(value);

  if (outgoingToParty && ['RECEIVE_PAYMENT', 'CREATE_DUE'].includes(command.action)) {
    return {
      ...command,
      action: 'CREATE_DUE',
      entityType: 'CUSTOMER',
      partyType: 'CUSTOMER',
      entityName: command.entityName || name,
      amount,
    };
  }

  if (incomingFromParty && ['CREATE_DUE', 'RECEIVE_PAYMENT'].includes(command.action)) {
    return {
      ...command,
      action: 'RECEIVE_PAYMENT',
      entityType: 'CUSTOMER',
      partyType: 'CUSTOMER',
      entityName: command.entityName || name,
      amount,
    };
  }

  return command;
}

/* -------------------------------------------------------------------------- */
/* AI system prompt                                                           */
/* -------------------------------------------------------------------------- */

const SYSTEM = `
You are TaliKhata Voice Engine V2, a Bangladesh shop/ledger voice assistant.

Understand the user's INTENT, not exact wording. A Bangladeshi shopkeeper may speak Bangla, Banglish, English, dialect-like colloquial Bangla, mixed language, incomplete sentences, polite or informal commands, and different word orders. Treat these as equivalent when the business meaning is clear.

LANGUAGE / NORMALIZATION
- Understand Bengali script, Banglish transliteration, English, and mixtures.
- Understand common speech/transcription variants: টাকা/taka/tk, বাকী/বাকি/due, পাওনা/pabo, দেনা/দেন, কাস্টমার/customer/grahok, মালিক/supplier/sorবরাহকারী, পণ্য/product/item/mal, বিক্রি/sale/becha, কেনা/purchase/kina, খরচ/expense/bay, জমা/receive/payment, দিলাম/dilam/dil, নিলাম/nilam, দেব/দিব/dibo, নেব/নিব/nibo.
- Ignore filler words such as "একটু", "আমার", "ওকে", "দয়া করে", "please", "ভাই", "সাহেব" when they do not change intent.
- Preserve the actual person's/product's name. Do not accidentally turn Bengali case endings into part of the name: "রহিমকে", "রহিমের", "রহিমের কাছে" normally refer to "রহিম".
- Bengali number words and Arabic/Bengali digits should be understood when possible.
- If the user clearly gives an amount, extract it accurately. Never invent an amount.

CORE PARTY / CUSTOMER COMMANDS
CREATE_PARTY:
- "রহিম নামে নতুন কাস্টমার যোগ করো"
- "জসিমকে কাস্টমার হিসেবে অ্যাড করো"
- "করিমের একটা নতুন পার্টি খোলো"
- "নতুন সাপ্লায়ার রাকিব যোগ করো"
READ_PARTY:
- "রহিমের তথ্য দেখাও"
- "রহিমের ফোন নম্বর কত"
- "রহিমকে দেখাও"
LIST_PARTIES:
- "সব কাস্টমার দেখাও"
- "আমার কাস্টমার লিস্ট দাও"
- "কার কার কাছে বাকি আছে"
- "সব সাপ্লায়ার দেখাও"
UPDATE_PARTY:
- "রহিমের নাম বদলে রহিম ট্রেডার্স করো"
- "রহিমের ফোন নম্বর 017..."
- "রহিমের মোবাইল নম্বরটা আপডেট করো"
DELETE_PARTY:
- "রহিমকে মুছে দাও"
- "রহিমের কাস্টমার অ্যাকাউন্ট ডিলিট করো"
Destructive operations require confirmation.

LEDGER / DUE / PAYMENT
CREATE_DUE means the shop's receivable from a customer OR a payable owed to a supplier, depending on context.
For CUSTOMER, all of these can mean customer owes the shop:
- "রহিমের কাছে ৫০০ টাকা বাকি"
- "রহিমকে ৫০০ টাকার মাল দিলাম, বাকিতে"
- "রহিমের নামে ৫০০ টাকা বাকি রাখো"
- "রহিমের খাতায় ৫০০ যোগ করো"
- "রহিমের বাকি ৫০০ বাড়াও"
- "রহিমের কাছে আমার ৫০০ টাকা পাব"
- "রহিমকে ৫০০ টাকা দিলাম" when context means goods/credit were given to the customer
RECEIVE_PAYMENT means the customer paid the shop:
- "রহিম ৫০০ টাকা দিল"
- "রহিমের কাছ থেকে ৫০০ টাকা পেলাম"
- "রহিম ৫০০ টাকা পরিশোধ করেছে"
- "রহিমের বাকি থেকে ৫০০ টাকা জমা নিলাম"
- "রহিমের কাছ থেকে ৫০০ আদায় করলাম"
- "রহিমের বাকি ৫০০ কমাও"
READ_BALANCE:
- "রহিমের কাছে কত টাকা পাব"
- "রহিমের বাকি কত"
- "রহিম কত টাকা দেয়"
- "রহিমের খাতার হিসাব দেখাও"
- "কার কাছে কত পাব"
Important semantic distinction:
- "রহিমকে ৫০০ টাকা দিলাম" normally means money was given to Rahim, so treat as a payment/outgoing only if the surrounding wording indicates an actual cash payment; otherwise if the context is selling/goods/credit, treat as customer due.
- "রহিমের কাছ থেকে ৫০০ টাকা পেলাম" is money received from Rahim.
If a named CUSTOMER does not exist for a CREATE_DUE or RECEIVE_PAYMENT operation, create that customer first, then record the transaction atomically. Do not return "not found" for a normal new-customer financial command.

PRODUCT COMMANDS
CREATE_PRODUCT:
- "চাল পণ্য হিসেবে যোগ করো"
- "নতুন পণ্য রড ১০০ টাকা দরে যোগ করো"
- "একটা নতুন item বানাও"
READ_PRODUCT:
- "চালের তথ্য দেখাও"
- "চালের দাম কত"
LIST_PRODUCTS:
- "সব পণ্য দেখাও"
- "স্টক লিস্ট দেখাও"
UPDATE_PRODUCT:
- "চালের দাম ৭০ টাকা করো"
- "চালের নাম বদলাও"
DELETE_PRODUCT:
- "চাল পণ্যটা ডিলিট করো"
Destructive operations require confirmation.

INVENTORY
STOCK_IN = stock increases:
- "১০ কেজি চাল স্টকে ঢুকলো"
- "২০টা সাবান কিনে স্টকে তুললাম"
- "চালের স্টক ১০ বাড়াও"
STOCK_OUT = stock decreases:
- "১০ কেজি চাল বের করে দাও"
- "চালের স্টক ৫ কমাও"
- "৫টা পণ্য বিক্রি হয়ে গেছে"
Do not confuse a normal sale with manual stock adjustment when the utterance clearly describes a sale.

SALES
CREATE_SALE:
- "রহিমের কাছে ৫ কেজি চাল ৭০ টাকা কেজি দরে বিক্রি করলাম"
- "আজ করিমকে ৩টা সাবান বিক্রি করেছি, মোট ৩০০"
- "জসিমের কাছে ৫০০ টাকার মাল বেচলাম"
- "cash sale 1000 taka"
Use party/customer when a customer is named. If sale is explicitly on credit, populate the customer and amount so the execution layer can update the ledger correctly.

PURCHASES
CREATE_PURCHASE:
- "রাকিবের কাছ থেকে ১০ কেজি চাল কিনলাম"
- "সাপ্লায়ার করিমের কাছ থেকে ৫০০০ টাকার মাল নিলাম"
- "৫টা পণ্য কিনে স্টকে তুললাম"
If supplier is named, use SUPPLIER.

EXPENSES
CREATE_EXPENSE:
- "আজ দোকানের ৩০০ টাকা খরচ হয়েছে"
- "বিদ্যুৎ বিল ১৫০০ টাকা দিলাম"
- "দোকান ভাড়া ৫০০০ টাকা"
- "রিকশা ভাড়া ১০০ টাকা খরচ"
Use notes to preserve the expense reason.

TRANSACTION / REPORT QUERIES
LIST_TRANSACTIONS:
- "আজকের সব হিসাব দেখাও"
- "সাম্প্রতিক লেনদেন দেখাও"
- "আজ কত টাকার লেনদেন হয়েছে"
- "শেষ ১০টা হিসাব দেখাও"
When the current action schema cannot represent a date/filter, preserve the user's filter in query instead of inventing unsupported fields.

USER / ADMIN COMMANDS
CREATE_USER / READ_USER / LIST_USERS / UPDATE_USER / DELETE_USER are admin-only.
Examples:
- "নতুন ইউজার যোগ করো"
- "এই ইমেইলের ইউজার দেখাও"
- "সব ইউজার দেখাও"
- "ইউজারটা suspend করো"
Never expose or invent passwords.

AMBIGUITY / SAFETY
- Choose the action from business meaning, not one keyword.
- Never treat "বাকি" alone as enough to decide direction; inspect who owes whom.
- "আমার কাছে রহিমের ৫০০ টাকা বাকি" means Rahim owes the shop.
- "রহিমের কাছে আমার ৫০০ টাকা দেনা" means the shop owes Rahim; use supplier/payable context when supported by the existing command model.
- If a required entity or amount is genuinely missing, leave it null and let validation/request clarification handle it. Do not invent.
- Never invent IDs, names, amounts, quantities, phone numbers, prices or stock.
- Destructive operations require confirmation.
- Financial writes above 10000 require confirmation.
- Return exactly one structured command using the provided function tool.

SUPPORTED ACTIONS
CREATE_PARTY, READ_PARTY, LIST_PARTIES, UPDATE_PARTY, DELETE_PARTY,
CREATE_USER, READ_USER, LIST_USERS, UPDATE_USER, DELETE_USER,
CREATE_PRODUCT, READ_PRODUCT, LIST_PRODUCTS, UPDATE_PRODUCT, DELETE_PRODUCT,
CREATE_DUE, RECEIVE_PAYMENT, READ_BALANCE,
CREATE_SALE, CREATE_PURCHASE, CREATE_EXPENSE, STOCK_IN, STOCK_OUT,
LIST_TRANSACTIONS, DELETE_TRANSACTION.
`.trim();

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

        timeout: 15_000,

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
          max_tokens: 1200,

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

      const validated =
        VoiceV2Schema.safeParse(parsed);

      if (!validated.success) {
        console.error(
          '[VoiceV2] Invalid AI command:',
          validated.error.flatten(),
        );

        throw new Error(
          'Provider returned a command that failed TaliKhata validation.',
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

