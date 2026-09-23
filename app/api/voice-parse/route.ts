import { NextResponse } from 'next/server';

import {
  createAIClient,
  getAIProviders,
  getModel,
  shouldFallback,
} from '@/lib/ai/provider';

import { auth } from '@/auth';

import {
  VoiceIntentSchema,
  VoiceParseRequest,
} from '@/lib/validations/voice';

/* -------------------------------------------------------------------------- */
/* AI JSON schema                                                             */
/* -------------------------------------------------------------------------- */

const schema = {
  type: 'object',
  additionalProperties: false,

  properties: {
    intent: {
      type: 'string',
      enum: [
        'CREATE_TRANSACTION',
        'READ_BALANCE',
        'UPDATE_STOCK',
        'DELETE_ENTRY',
        'LIST_ITEMS',
        'CREATE_PRODUCT',
        'CREATE_PARTY',
        'READ_PARTY',
        'LIST_PARTIES',
        'READ_PRODUCT',
        'UPDATE_PRODUCT',
        'UPDATE_PARTY',
        'DELETE_PRODUCT',
        'DELETE_PARTY',
        'SEARCH_TRANSACTIONS',
      ],
    },

    entity_type: {
      type: 'string',
      enum: [
        'CUSTOMER',
        'SUPPLIER',
        'INVENTORY',
      ],
    },

    entity_name: {
      type: ['string', 'null'],
    },

    amount: {
      type: ['number', 'null'],
    },

    quantity: {
      type: ['number', 'null'],
    },

    unit: {
      type: ['string', 'null'],
    },

    transaction_type: {
      type: ['string', 'null'],
      enum: [
        'DUE_GIVEN',
        'DUE_RECEIVED',
        'STOCK_IN',
        'STOCK_OUT',
        'EXPENSE',
        'SALE',
        null,
      ],
    },

    notes: {
      type: ['string', 'null'],
    },

    phone: {
      type: ['string', 'null'],
    },

    buy_price: {
      type: ['number', 'null'],
    },

    sell_price: {
      type: ['number', 'null'],
    },

    low_stock_threshold: {
      type: ['number', 'null'],
    },

    party_type: {
      type: ['string', 'null'],
      enum: [
        'CUSTOMER',
        'SUPPLIER',
        null,
      ],
    },

    items: {
      type: 'array',

      items: {
        type: 'object',
        additionalProperties: false,

        properties: {
          product_name: {
            type: 'string',
          },

          quantity: {
            type: 'number',
          },

          unit: {
            type: ['string', 'null'],
          },

          unit_price: {
            type: ['number', 'null'],
          },
        },

        required: [
          'product_name',
          'quantity',
          'unit',
          'unit_price',
        ],
      },

      maxItems: 50,
    },

    paid_amount: {
      type: ['number', 'null'],
    },

    search_query: {
      type: ['string', 'null'],
    },

    target_id: {
      type: ['string', 'null'],
    },
  },

  required: [
    'intent',
    'entity_type',
    'entity_name',
    'amount',
    'quantity',
    'unit',
    'transaction_type',
    'notes',
    'phone',
    'buy_price',
    'sell_price',
    'low_stock_threshold',
    'party_type',
    'items',
    'paid_amount',
    'search_query',
    'target_id',
  ],
} as const;

/* -------------------------------------------------------------------------- */
/* Bengali digit normalization                                                */
/* -------------------------------------------------------------------------- */

function normalizeDigits(
  value: string,
): string {
  const bn = '০১২৩৪৫৬৭৮৯';
  const en = '0123456789';

  return value.replace(
    /[০-৯]/g,
    (digit) => {
      const index = bn.indexOf(digit);

      return index >= 0
        ? en[index]
        : digit;
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Text normalization                                                         */
/* -------------------------------------------------------------------------- */

function normalizeText(
  value: string,
): string {
  return normalizeDigits(value)
    .trim()
    .toLowerCase()
    .replace(/[।,!?;:]/g, ' ')
    .replace(/\s+/g, ' ');
}

/* -------------------------------------------------------------------------- */
/* Amount extraction                                                          */
/* -------------------------------------------------------------------------- */

function extractAmount(
  transcript: string,
): number | null {
  const text =
    normalizeDigits(transcript);

  const money =
    text.match(
      /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:টাকা|টাকায়|টাকার|tk|taka|bdt)\b/i,
    );

  const generic =
    text.match(
      /(?:^|\s)(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s|$)/i,
    );

  const match =
    money || generic;

  if (!match?.[1]) {
    return null;
  }

  const amount = Number(
    match[1].replace(/,/g, ''),
  );

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return null;
  }

  return amount;
}

/* -------------------------------------------------------------------------- */
/* Quantity extraction                                                        */
/* -------------------------------------------------------------------------- */

function extractQuantity(
  transcript: string,
): number | null {
  const text =
    normalizeDigits(transcript);

  const match =
    text.match(
      /(\d+(?:\.\d+)?)\s*(?:টা|টি|কেজি|kg|pcs?|piece|pieces|litre|liter|লিটার|বস্তা|box|কার্টন)\b/i,
    );

  if (!match?.[1]) {
    return null;
  }

  const quantity =
    Number(match[1]);

  return Number.isFinite(quantity) &&
    quantity > 0
    ? quantity
    : null;
}

/* -------------------------------------------------------------------------- */
/* Intent helpers                                                             */
/* -------------------------------------------------------------------------- */

function isBalanceQuestion(
  transcript: string,
): boolean {
  const text =
    normalizeText(transcript);

  const question =
    /(?:কত|কতো|কয়|কয়|koto|kot|how much|balance|ব্যালেন্স|পাওনা|দেনা)/i;

  const due =
    /(?:বাকি|bak[iy]|bakir|bakite|due|পাওনা|দেনা|balance)/i;

  return (
    question.test(text) &&
    due.test(text)
  );
}

function hasDueWord(
  transcript: string,
): boolean {
  const text =
    normalizeText(transcript);

  return (
    text.includes('বাকি') ||
    /\b(?:baki|bakir|bakite|due)\b/i.test(
      text,
    )
  );
}

function isPaymentCommand(
  transcript: string,
): boolean {
  const text =
    normalizeText(transcript);

  return (
    /(?:(?:জমা|পরিশোধ|দিয়েছে|দিয়েছে|দিলাম|দিল|দিলেন|পেলাম|ফেরত|দিয়েছি|দিয়েছি|দেওয়া|দেওয়ার))/i.test(
      text,
    ) ||
    /\b(?:\b(?:joma|jama|paid|payment|pay|received|receive|dise|diyeche|dilo|dilam|dil|diyechi|diyachi)\b)\b/i.test(
      text,
    )
  );
}

function isProductCommand(
  transcript: string,
): boolean {
  const text =
    normalizeText(transcript);

  return (
    /(?:পণ্য|প্রোডাক্ট|মাল|product|item)/i.test(
      text,
    )
  );
}

function isDeleteCommand(
  transcript: string,
): boolean {
  const text =
    normalizeText(transcript);

  return (
    /(?:ডিলিট|মুছে|মুছে ফেল|বাদ দাও|delete|remove|cancel)/i.test(
      text,
    )
  );
}

function isListCommand(
  transcript: string,
): boolean {
  const text =
    normalizeText(transcript);

  return (
    /(?:দেখাও|দেখান|লিস্ট|তালিকা|সবগুলো|সব|list|show|display)/i.test(
      text,
    )
  );
}

function isSupplierCommand(
  transcript: string,
): boolean {
  const text =
    normalizeText(transcript);

  return (
    /(?:supplier|সরবরাহকারী|সাপ্লায়ার|সাপ্লায়ার|পাইকার)/i.test(
      text,
    )
  );
}

function isCustomerCommand(
  transcript: string,
): boolean {
  const text =
    normalizeText(transcript);

  return (
    /(?:customer|কাস্টমার|ক্রেতা|গ্রাহক)/i.test(
      text,
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Dynamic customer name extraction for due/payment commands                  */
/* -------------------------------------------------------------------------- */

function extractPartyNameForTransaction(transcript: string): string | null {
  const text = normalizeDigits(transcript)
    .trim()
    .replace(/[।,!?;:]/g, ' ')
    .replace(/\s+/g, ' ');

  const patterns = [
    // করিমকে ৩০০ টাকা দিলাম
    /^(.+?)\s*কে\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:দিলাম|দিল|দিয়েছি|দিয়েছি|দিয়েছে|দিয়েছে|দিলেন|দাও|দিতে|দেওয়া|দেওয়ার)?\s*$/iu,
    // করিমের কাছে ৩০০ টাকা বাকি দিলাম / পাওনা করো
    /^(.+?)\s*(?:এর|র)\s*কাছে\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|টাকায়|টাকার|tk|taka)?\s*(?:বাকি|পাওনা)\s*(?:করে|দাও|দিলাম|দিলেন|দিতে|করো)?\s*$/iu,
    // করিমের বাকি ৩০০ টাকা
    /^(.+?)\s*(?:এর|র)\s*(?:বাকি|পাওনা)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|টাকার|tk|taka)?\s*(?:করে|দাও|দিলাম|দিলেন|করো)?\s*$/iu,
    // rahim er kache 500 taka baki dilam
    /^(.+?)\s+er\s+kache\s+\d[\d,]*(?:\.\d+)?\s*(?:taka|tk)?\s*(?:baki|due)\s*(?:kore|dao|dilam|dilo|dil|diben|kor[o]?|dite)?\s*$/i,
    // karim ke 300 taka dilam
    /^(.+?)\s+ke\s+\d[\d,]*(?:\.\d+)?\s*(?:taka|tk)?\s*(?:dilam|dil|diyechi|diyachi|dise|diyeche|dilo|dao|dite)?\s*$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;

    const name = match[1]
      .trim()
      .replace(/(?:এর|র|কে|ে)$/u, '')
      .trim();

    if (
      name &&
      !/^(?:customer|client|party|supplier|সাপ্লায়ার|সরবরাহকারী)$/iu.test(name)
    ) {
      return name;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Deterministic correction                                                   */
/* -------------------------------------------------------------------------- */

function correctIntent(
  aiData: any,
  transcript: string,
) {
  const amount =
    extractAmount(transcript);

  const quantity =
    extractQuantity(transcript);

  /* ---------------------------------------------------------------------- */
  /* Balance                                                                */
  /* ---------------------------------------------------------------------- */

  if (
    isBalanceQuestion(transcript)
  ) {
    return {
      ...aiData,

      intent:
        'READ_BALANCE',

      entity_type:
        'CUSTOMER',

      amount: null,

      quantity: 0,

      transaction_type:
        null,

      paid_amount:
        null,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Customer payment                                                       */
  /* ---------------------------------------------------------------------- */

  if (
    amount !== null &&
    isPaymentCommand(transcript) &&
    !isSupplierCommand(transcript)
  ) {
    return {
      ...aiData,

      intent:
        'CREATE_TRANSACTION',

      entity_type:
        'CUSTOMER',

      amount,

      quantity: 0,

      transaction_type:
        'DUE_RECEIVED',

      entity_name:
        extractPartyNameForTransaction(transcript) ??
        aiData.entity_name,

      paid_amount:
        amount,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Customer due                                                           */
  /* ---------------------------------------------------------------------- */

  if (
    amount !== null &&
    hasDueWord(transcript) &&
    !isBalanceQuestion(transcript)
  ) {
    return {
      ...aiData,

      intent:
        'CREATE_TRANSACTION',

      entity_type:
        'CUSTOMER',

      amount,

      quantity: 0,

      transaction_type:
        'DUE_GIVEN',

      entity_name:
        extractPartyNameForTransaction(transcript) ??
        aiData.entity_name,

      paid_amount:
        0,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Stock                                                                  */
  /* ---------------------------------------------------------------------- */

  const text =
    normalizeText(transcript);

  if (
    /(?:স্টক|stock|মাল|পণ্য)/i.test(
      text,
    ) &&
    /(?:যোগ|ঢোকাও|আনলাম|কিনলাম|add|in|increase)/i.test(
      text,
    )
  ) {
    return {
      ...aiData,

      intent:
        'UPDATE_STOCK',

      entity_type:
        'INVENTORY',

      quantity:
        quantity ??
        aiData.quantity ??
        0,

      transaction_type:
        'STOCK_IN',
    };
  }

  if (
    /(?:স্টক|stock|মাল|পণ্য)/i.test(
      text,
    ) &&
    /(?:বের|কমাও|বিক্রি|sold|out|remove|decrease)/i.test(
      text,
    )
  ) {
    return {
      ...aiData,

      intent:
        'UPDATE_STOCK',

      entity_type:
        'INVENTORY',

      quantity:
        quantity ??
        aiData.quantity ??
        0,

      transaction_type:
        'STOCK_OUT',
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Delete                                                                 */
  /* ---------------------------------------------------------------------- */

  if (
    isDeleteCommand(transcript)
  ) {
    return {
      ...aiData,

      intent:
        'DELETE_ENTRY',
    };
  }

  /* ---------------------------------------------------------------------- */
  /* List products                                                           */
  /* ---------------------------------------------------------------------- */

  if (
    isListCommand(transcript) &&
    isProductCommand(transcript)
  ) {
    return {
      ...aiData,

      intent:
        'LIST_ITEMS',

      entity_type:
        'INVENTORY',
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Supplier                                                               */
  /* ---------------------------------------------------------------------- */

  if (
    isSupplierCommand(transcript) &&
    isListCommand(transcript)
  ) {
    return {
      ...aiData,

      intent:
        'LIST_PARTIES',

      entity_type:
        'SUPPLIER',

      party_type:
        'SUPPLIER',
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Customer                                                               */
  /* ---------------------------------------------------------------------- */

  if (
    isCustomerCommand(transcript) &&
    isListCommand(transcript)
  ) {
    return {
      ...aiData,

      intent:
        'LIST_PARTIES',

      entity_type:
        'CUSTOMER',

      party_type:
        'CUSTOMER',
    };
  }

  return aiData;
}

/* -------------------------------------------------------------------------- */
/* System prompt                                                              */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROMPT = `
You are TaliKhata Voice, a highly reliable Bangladeshi shop ledger command parser.

Your job is ONLY to understand the user's command and return structured JSON.

You understand:

- Native Bengali
- Banglish
- English
- Bengali digits
- English digits
- mixed Bengali + English
- natural conversational shop language

==================================================
ABSOLUTE RULES
==================================================

1. NEVER invent a name.
2. NEVER invent an amount.
3. NEVER invent quantity.
4. NEVER invent phone number.
5. NEVER invent product.
6. NEVER invent database IDs.
7. Preserve names exactly as spoken whenever possible.
8. Do not convert "Rahim" into another person.
9. Do not convert "করিম" into "রহিম".
10. Database entity resolution happens on the server.

==================================================
CUSTOMER DUE
==================================================

"রহিমের বাকি ৫০০ টাকা"
"করিমের বাকি ৮০০"
"সুমনকে ১০০০ টাকা বাকিতে দিলাম"
"rahim er baki 500"
"karim ke 800 taka baki dilam"

→

intent = CREATE_TRANSACTION
entity_type = CUSTOMER
transaction_type = DUE_GIVEN
amount = spoken amount

==================================================
CUSTOMER PAYMENT
==================================================

"রহিম ৫০০ টাকা জমা দিল"
"করিম ৩০০ টাকা দিয়েছে"
"সুমন টাকা পরিশোধ করেছে"
"rahim paid 500"
"karim joma dilo 300"

→

intent = CREATE_TRANSACTION
entity_type = CUSTOMER
transaction_type = DUE_RECEIVED
amount = spoken amount
paid_amount = spoken amount

==================================================
BALANCE
==================================================

"রহিমের বাকি কত?"
"করিমের মোট বাকি কত?"
"সুমনের পাওনা কত?"
"রহিমের ব্যালেন্স কত?"
"rahim er baki koto?"
"karim total due koto?"

→

intent = READ_BALANCE
entity_type = CUSTOMER
amount = null
transaction_type = null

==================================================
SUPPLIER
==================================================

"রহমান সাপ্লায়ারকে ৫০০ টাকা দিলাম"

This is supplier payment context.

Do not treat a supplier as a customer.

==================================================
STOCK IN
==================================================

"১০টা কোক স্টকে ঢুকাও"
"২০ কেজি চাল কিনলাম"
"৫টা সাবান স্টকে যোগ করো"
"stock add 20 coke"
"kinlam 10 pcs"

→

intent = UPDATE_STOCK
entity_type = INVENTORY
transaction_type = STOCK_IN

==================================================
STOCK OUT
==================================================

"১০টা কোক স্টক থেকে বের করলাম"
"৫টা সাবান বের করো"
"stock out 10"

→

intent = UPDATE_STOCK
entity_type = INVENTORY
transaction_type = STOCK_OUT

==================================================
SALE
==================================================

"রহিমকে ২টা কোক বিক্রি করলাম"
"করিমকে ৩টা সাবান আর ২টা কোক দিলাম"
"rahim er kase 2 coke sell"

→

intent = CREATE_TRANSACTION
entity_type = CUSTOMER
transaction_type = SALE

Put every product into items[].

==================================================
EXPENSE
==================================================

"দোকানের ৫০০ টাকা বিদ্যুৎ বিল"
"আজ ৩০০ টাকা খরচ হয়েছে"
"expense 500"

→

intent = CREATE_TRANSACTION
transaction_type = EXPENSE

==================================================
CREATE PRODUCT
==================================================

Only when the user explicitly wants to create/add/register a product.

Examples:

"কোক নামে নতুন product যোগ করো"
"নতুন সাবান তৈরি করো"
"product add করো"

→

intent = CREATE_PRODUCT
entity_type = INVENTORY

==================================================
CREATE CUSTOMER / SUPPLIER
==================================================

"রহিমকে customer হিসেবে যোগ করো"
"করিম নামে customer বানাও"
"রহমান ট্রেডার্সকে supplier হিসেবে যোগ করো"

→

intent = CREATE_PARTY

party_type must be CUSTOMER or SUPPLIER.

==================================================
READ PARTY
==================================================

"রহিমের তথ্য দেখাও"
"করিমের customer information"
"রহমান supplier details"

→ READ_PARTY

==================================================
LIST
==================================================

"সব customer দেখাও"
"সব supplier দেখাও"
"সব product দেখাও"
"inventory list দেখাও"

→ LIST_PARTIES or LIST_ITEMS

==================================================
DELETE
==================================================

"শেষ transaction delete করো"
"৫০০ টাকার entry মুছে দাও"
"এই transaction delete করো"
"করিমকে delete করো"

Use DELETE_ENTRY for ledger transaction deletion.

Use DELETE_PARTY for customer/supplier deletion.

Use DELETE_PRODUCT for product deletion.

==================================================
UPDATE
==================================================

"রহিমের phone number পরিবর্তন করো"
"কোকের selling price ৫০ টাকা করো"
"করিমকে supplier বানাও"

Use UPDATE_PARTY or UPDATE_PRODUCT.

==================================================
SEARCH
==================================================

"রহিমের transaction দেখাও"
"গতকালের transaction দেখাও"
"৫০০ টাকার entry খুঁজে বের করো"

→ SEARCH_TRANSACTIONS

==================================================
IMPORTANT
==================================================

A concrete amount + customer + baki/due
means DUE_GIVEN.

A question + customer + baki/due
means READ_BALANCE.

A customer + paid/joma/received
means DUE_RECEIVED.

Never confuse them.

==================================================
ENTITY NAME
==================================================

If user says:

"রহিম"
return entity_name = "রহিম"

If user says:

"করিম"
return entity_name = "করিম"

If user says:

"রহমান ট্রেডার্স"
return exactly that name.

Do not hardcode any person's name.

==================================================
MULTI PRODUCT SALE
==================================================

For:

"রহিমকে ২টা কোক আর ৩টা সাবান বিক্রি করেছি"

items:

[
  {
    product_name: "কোক",
    quantity: 2
  },
  {
    product_name: "সাবান",
    quantity: 3
  }
]

==================================================
CONFIDENCE
==================================================

If information is missing, return null.

Do not guess.

The server will ask for clarification when required.
`;

/* -------------------------------------------------------------------------- */
/* Deterministic party creation                                               */
/* -------------------------------------------------------------------------- */

function extractExplicitPartyCreation(transcript: string) {
  const text = normalizeDigits(transcript).trim().replace(/[।!?;:]/g, ' ').replace(/\\s+/g, ' ');
  const patterns: Array<{ regex: RegExp; type: 'CUSTOMER' | 'SUPPLIER' }> = [
    { regex: /^(.+?)\\s+নামে\\s+(?:নতুন\\s+)?(?:কাস্টমার|গ্রাহক|ক্রেতা)\\s+(?:হিসেবে\\s+)?(?:যোগ(?:\\s+করো|\\s+করুন)?|বানাও|তৈরি(?:\\s+করো|\\s+করুন)?)\\s*$/i, type: 'CUSTOMER' },
    { regex: /^(.+?)\\s+(?:নামে\\s+)?(?:নতুন\\s+)?(?:customer|client)\\s+(?:হিসেবে\\s+)?(?:যোগ(?:\\s+(?:করো|করুন|কর))?|add|create|register)\\s*$/i, type: 'CUSTOMER' },
    { regex: /^(?:add|create|register)\\s+(?:a\\s+)?(?:new\\s+)?customer\\s+(?:named\\s+)?(.+?)\\s*$/i, type: 'CUSTOMER' },
    { regex: /^(.+?)\\s+নামে\\s+(?:নতুন\\s+)?(?:সাপ্লায়ার|সাপ্লায়ার|সরবরাহকারী)\\s+(?:হিসেবে\\s+)?(?:যোগ(?:\\s+করো|\\s+করুন)?|বানাও|তৈরি(?:\\s+করো|\\s+করুন)?)\\s*$/i, type: 'SUPPLIER' },
    { regex: /^(.+?)\\s+(?:নামে\\s+)?(?:নতুন\\s+)?(?:supplier|vendor)\\s+(?:হিসেবে\\s+)?(?:যোগ(?:\\s+(?:করো|করুন|কর))?|add|create|register)\\s*$/i, type: 'SUPPLIER' },
    { regex: /^(?:add|create|register)\\s+(?:a\\s+)?(?:new\\s+)?supplier\\s+(?:named\\s+)?(.+?)\\s*$/i, type: 'SUPPLIER' },
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match?.[1]) {
      const name = match[1].trim().replace(/^(?:the|a|an)\\s+/i, '').trim();
      if (name) return { name, partyType: pattern.type };
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Deterministic balance question parser                                      */
/* -------------------------------------------------------------------------- */

function extractBalanceEntityName(transcript: string): string | null {
  const text = normalizeDigits(transcript).trim().replace(/[।,!?;:]/g, ' ').replace(/\s+/g, ' ');
  const patterns = [
    /^(.+?)'s\s+(?:total\s+)?(?:balance|due|baki)\s+(?:koto|how much)\s*$/i,
    /^(.+?)\s+er\s+(?:total\s+)?(?:baki|due|balance)\s+(?:koto|kot|how much)\s*$/i,
    /^(.+?)(?:ের|এর|র)\s+(?:মোট\s+)?(?:বাকি|পাওনা|দেনা|ব্যালেন্স)\s+(?:কত|কতো)\s*$/i,
    /^(.+?)(?:ের|এর|র)\s+(?:মোট\s+)?(?:কত)\s+(?:টাকা|টাকায়|টাকার)?\s*(?:বাকি|পাওনা|দেনা|ব্যালেন্স)\s*$/i,
    /^(.+?)(?:ের|এর|র)\s+(?:মোট\s+)?(?:বাকি|পাওনা|দেনা|ব্যালেন্স)\s+(?:কত|কতো)\s+(?:টাকা|টাকায়|টাকার)\s*$/i,
    /^(.+?)(?:ের|এর|র)\s+(?:বাকি|পাওনা|দেনা|ব্যালেন্স)\s*কত\s*$/i,
    /^(.+?)(?:ের|র)\s+(?:মোট\s+)?(?:বাকি|পাওনা|দেনা|ব্যালেন্স)\s+(?:কত|কতো)\s*$/i,
    /^(.+?)\s+(?:ের|এর|র)\s+(?:বাকি|পাওনা|দেনা|ব্যালেন্স)\s+(?:কত|কতো)\s*$/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim().replace(/[\u09c7]$/u, '');
      if (name && !/^(?:customer|client|party)$/i.test(name)) return name;
    }
  }
  return null;
}

function buildDeterministicPaymentIntent(transcript: string) {
  const amount = extractAmount(transcript);
  const entityName = extractPartyNameForTransaction(transcript);
  if (
    amount === null ||
    !entityName ||
    !isPaymentCommand(transcript) ||
    isSupplierCommand(transcript) ||
    isBalanceQuestion(transcript)
  ) return null;

  // Direction matters:
  // "করিমকে ৩০০ টাকা দিলাম" = I gave money/credit to Karim -> DUE_GIVEN.
  // "করিম ৩০০ টাকা দিল" / "করিমের কাছ থেকে ৩০০ টাকা পেলাম" =
  // Karim paid me -> DUE_RECEIVED.
  const normalized = normalizeDigits(transcript).toLowerCase();
  const receivedByMe =
    /(?:কাছ থেকে|কাছথেকে|থেকে)\s*(?:\d|[০-৯]).*(?:পেলাম|নিলাম|দিল|দিয়েছে|দিয়েছে)/iu.test(normalized) ||
    /(?:^|\s)(?:করিম|রহিম|সুমন|সোহেল|গ্রাহক)\s+(?:\d|[০-৯]).*(?:দিল|দিয়েছে|দিয়েছে|দিয়েছে)$/iu.test(normalized) ||
    /(?:from|theke|kache theke|kacher theke).*\b(?:pelam|nilam|received|paid|dise|diyeche)\b/i.test(normalized);

  const gaveToParty =
    /(?:কে|কে\s+|কে$).*?(?:দিলাম|দিয়েছি|দিয়েছি|দিলেন|দাও|দেওয়া)/iu.test(normalized) ||
    /\b(?:ke)\b.*\b(?:dilam|diyechi|diyachi|dil|gave|give|lent)\b/i.test(normalized);

  const transactionType = receivedByMe && !gaveToParty
    ? 'DUE_RECEIVED'
    : 'DUE_GIVEN';

  return {
    intent: 'CREATE_TRANSACTION',
    entity_type: 'CUSTOMER',
    entity_name: entityName,
    amount,
    quantity: 0,
    unit: null,
    transaction_type: transactionType,
    notes: null,
    phone: null,
    buy_price: null,
    sell_price: null,
    low_stock_threshold: null,
    party_type: 'CUSTOMER',
    items: [],
    paid_amount: transactionType === 'DUE_RECEIVED' ? amount : 0,
    search_query: null,
    target_id: null,
  };
}

function buildDeterministicBalanceIntent(transcript: string) {
  if (!isBalanceQuestion(transcript)) return null;
  const entityName = extractBalanceEntityName(transcript);
  if (!entityName) return null;
  return {
    intent: 'READ_BALANCE',
    entity_type: 'CUSTOMER',
    entity_name: entityName,
    amount: null,
    quantity: 0,
    unit: null,
    transaction_type: null,
    notes: null,
    phone: null,
    buy_price: null,
    sell_price: null,
    low_stock_threshold: null,
    party_type: 'CUSTOMER',
    items: [],
    paid_amount: null,
    search_query: null,
    target_id: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Resilient AI JSON parsing                                                  */
/* -------------------------------------------------------------------------- */

function parseAIJson(raw: string): unknown | null {
  const text = raw.replace(/^\uFEFF/, '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first < 0 || last <= first) return null;
    try { return JSON.parse(text.slice(first, last + 1)); } catch { return null; }
  }
}

function parserFailure(message: string, provider: string) {
  return new Error('Voice parser [' + provider + ']: ' + message);
}

/* -------------------------------------------------------------------------- */
/* POST                                                                       */
/* -------------------------------------------------------------------------- */

export async function POST(
  req: Request,
) {
  const session =
    await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error:
          'Unauthorized',
      },
      {
        status: 401,
      },
    );
  }

  let rawBody: unknown;

  try {
    rawBody =
      await req.json();
  } catch {
    return NextResponse.json(
      {
        error:
          'Invalid JSON',
      },
      {
        status: 400,
      },
    );
  }

  const body =
    VoiceParseRequest.safeParse(
      rawBody,
    );

  if (!body.success) {
    return NextResponse.json(
      {
        error:
          'Invalid transcript',
        issues:
          body.error.issues,
      },
      {
        status: 400,
      },
    );
  }

  // Balance questions do not need an AI round-trip. Parse the customer
  // name deterministically so malformed provider JSON can never block a read.
  const deterministicBalance = buildDeterministicBalanceIntent(
    body.data.transcript,
  );

  const deterministicPayment = buildDeterministicPaymentIntent(
    body.data.transcript,
  );

  if (deterministicPayment) {
    const parsed = VoiceIntentSchema.safeParse(deterministicPayment);
    if (parsed.success) {
      return NextResponse.json({
        ok: true,
        ...parsed.data,
        provider: 'deterministic',
        transcript: body.data.transcript,
      });
    }
  }

  if (deterministicBalance) {
    const parsed = VoiceIntentSchema.safeParse(deterministicBalance);
    if (parsed.success) {
      return NextResponse.json({
        ok: true,
        ...parsed.data,
        provider: 'deterministic',
        transcript: body.data.transcript,
      });
    }
  }

  const providers =
    getAIProviders();

  if (!providers.length) {
    return NextResponse.json(
      {
        error:
          'Configure OPENAI_API_KEY or OPENROUTER_API_KEY',
      },
      {
        status: 503,
      },
    );
  }

  let lastError: unknown =
    null;

  for (
    const provider of providers
  ) {
    try {
      const client =
        createAIClient(
          provider,
        );

      const completion =
        await client.chat.completions.create(
          {
            model:
              getModel(
                provider,
              ),

            temperature: 0,

            response_format: {
              type:
                'json_schema',

              json_schema: {
                name:
                  'talikhata_voice_intent',

                strict: true,

                schema:
                  schema as any,
              },
            },

            messages: [
              {
                role:
                  'system',

                content:
                  SYSTEM_PROMPT,
              },

              {
                role:
                  'user',

                content:
                  body.data.transcript,
              },
            ],
          },
        );

      const raw =
        completion
          .choices[0]
          ?.message
          ?.content ||
        '{}';

      const aiData = parseAIJson(raw);
      if (aiData === null) {
        lastError = parserFailure('provider returned malformed JSON', provider);
        continue;
      }

      const parsed = VoiceIntentSchema.safeParse(aiData);
      if (!parsed.success) {
        lastError = parserFailure('provider returned schema-invalid intent', provider);
        continue;
      }

      const corrected =
        correctIntent(
          parsed.data,
          body.data.transcript,
        );

      const finalParsed =
        VoiceIntentSchema.safeParse(
          corrected,
        );

      if (!finalParsed.success) {
        return NextResponse.json(
          {
            error:
              'Invalid corrected parser output',

            issues:
              finalParsed.error.issues,

            data:
              corrected,
          },
          {
            status: 422,
          },
        );
      }

      return NextResponse.json({
        ok: true,

        ...finalParsed.data,

        provider,

        transcript:
          body.data.transcript,
      });
    } catch (error) {
      lastError =
        error;

      if (!shouldFallback(error)) {
        lastError = error;
        continue;
      }
    }
  }

  return NextResponse.json(
    {
      ok: false,

      error:
        lastError instanceof Error
          ? lastError.message
          : 'Voice parsing failed',
    },
    {
      status: 502,
    },
  );
}