import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Common enums                                                               */
/* -------------------------------------------------------------------------- */

export const VoiceIntentEnum = z.enum([
  'CREATE_TRANSACTION',
  'READ_BALANCE',
  'UPDATE_STOCK',
  'DELETE_ENTRY',
  'LIST_ITEMS',
  'CREATE_PRODUCT',
  'CREATE_PARTY',

  // Extended CRUD
  'READ_PARTY',
  'LIST_PARTIES',
  'READ_PRODUCT',
  'UPDATE_PRODUCT',
  'UPDATE_PARTY',
  'DELETE_PRODUCT',
  'DELETE_PARTY',
  'SEARCH_TRANSACTIONS',
]);

export const EntityTypeEnum = z.enum([
  'CUSTOMER',
  'SUPPLIER',
  'INVENTORY',
]);

export const TransactionTypeEnum = z.enum([
  'DUE_GIVEN',
  'DUE_RECEIVED',
  'STOCK_IN',
  'STOCK_OUT',
  'EXPENSE',
  'SALE',
]);

export const PartyTypeEnum = z.enum([
  'CUSTOMER',
  'SUPPLIER',
]);

/* -------------------------------------------------------------------------- */
/* Sale / purchase item                                                       */
/* -------------------------------------------------------------------------- */

export const VoiceItemSchema = z.object({
  product_name: z
    .string()
    .trim()
    .min(1)
    .max(200),

  quantity: z
    .number()
    .finite()
    .nonnegative(),

  unit: z
    .string()
    .trim()
    .max(50)
    .nullable(),

  unit_price: z
    .number()
    .finite()
    .nonnegative()
    .nullable(),
});

/* -------------------------------------------------------------------------- */
/* Main voice intent                                                          */
/* -------------------------------------------------------------------------- */

export const VoiceIntentSchema = z
  .object({
    intent: VoiceIntentEnum,

    entity_type: EntityTypeEnum,

    /**
     * Human-readable entity name only.
     *
     * NEVER put MongoDB _id here.
     */
    entity_name: z
      .string()
      .trim()
      .max(200)
      .nullable(),

    amount: z
      .number()
      .finite()
      .nonnegative()
      .nullable(),

    quantity: z
      .number()
      .finite()
      .nonnegative()
      .nullable(),

    unit: z
      .string()
      .trim()
      .max(50)
      .nullable(),

    transaction_type:
      TransactionTypeEnum.nullable(),

    notes: z
      .string()
      .trim()
      .max(500)
      .nullable(),

    phone: z
      .string()
      .trim()
      .max(50)
      .nullable(),

    buy_price: z
      .number()
      .finite()
      .nonnegative()
      .nullable(),

    sell_price: z
      .number()
      .finite()
      .nonnegative()
      .nullable(),

    low_stock_threshold: z
      .number()
      .finite()
      .nonnegative()
      .nullable(),

    party_type:
      PartyTypeEnum.nullable(),

    items: z
      .array(VoiceItemSchema)
      .max(50)
      .default([]),

    paid_amount: z
      .number()
      .finite()
      .nonnegative()
      .nullable(),

    /**
     * Optional search/update/delete helper.
     */
    search_query: z
      .string()
      .trim()
      .max(300)
      .nullable(),

    /**
     * Optional target identifier supplied by an already
     * resolved server-side operation.
     *
     * AI should normally return null.
     */
    target_id: z
      .string()
      .trim()
      .max(100)
      .nullable(),
  })
  .superRefine((value, ctx) => {
    /* ---------------------------------------------------------------------- */
    /* Transaction validation                                                 */
    /* ---------------------------------------------------------------------- */

    if (
      value.intent === 'CREATE_TRANSACTION'
    ) {
      if (!value.transaction_type) {
        ctx.addIssue({
          code: 'custom',
          path: ['transaction_type'],
          message:
            'transaction_type is required for CREATE_TRANSACTION',
        });
      }

      if (
        value.transaction_type !==
          'DUE_RECEIVED' &&
        value.amount === null
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['amount'],
          message:
            'amount is required for this transaction',
        });
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Due operations                                                        */
    /* ---------------------------------------------------------------------- */

    if (
      value.transaction_type ===
        'DUE_GIVEN' ||
      value.transaction_type ===
        'DUE_RECEIVED'
    ) {
      if (
        value.entity_type !==
        'CUSTOMER'
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['entity_type'],
          message:
            'Customer is required for customer due operations',
        });
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Stock operations                                                       */
    /* ---------------------------------------------------------------------- */

    if (
      value.transaction_type ===
        'STOCK_IN' ||
      value.transaction_type ===
        'STOCK_OUT'
    ) {
      if (
        value.entity_type !==
        'INVENTORY'
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['entity_type'],
          message:
            'Inventory entity is required for stock operations',
        });
      }

      if (
        value.quantity === null ||
        value.quantity <= 0
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['quantity'],
          message:
            'Positive quantity is required for stock operations',
        });
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Create product                                                         */
    /* ---------------------------------------------------------------------- */

    if (
      value.intent ===
      'CREATE_PRODUCT'
    ) {
      if (
        value.entity_type !==
        'INVENTORY'
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['entity_type'],
          message:
            'CREATE_PRODUCT requires INVENTORY',
        });
      }

      if (!value.entity_name) {
        ctx.addIssue({
          code: 'custom',
          path: ['entity_name'],
          message:
            'Product name is required',
        });
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Create party                                                           */
    /* ---------------------------------------------------------------------- */

    if (
      value.intent ===
      'CREATE_PARTY'
    ) {
      if (!value.party_type) {
        ctx.addIssue({
          code: 'custom',
          path: ['party_type'],
          message:
            'party_type is required',
        });
      }

      if (!value.entity_name) {
        ctx.addIssue({
          code: 'custom',
          path: ['entity_name'],
          message:
            'Party name is required',
        });
      }
    }
  });

export type VoiceIntent = z.infer<
  typeof VoiceIntentSchema
>;

/* -------------------------------------------------------------------------- */
/* Parse request                                                              */
/* -------------------------------------------------------------------------- */

export const VoiceParseRequest =
  z.object({
    transcript: z
      .string()
      .trim()
      .min(1)
      .max(5000),
  });

export type VoiceParseRequestType =
  z.infer<typeof VoiceParseRequest>;