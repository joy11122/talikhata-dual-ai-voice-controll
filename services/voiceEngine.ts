import { auth } from '@/auth';
import { Types } from 'mongoose';

import { connectDB } from '@/lib/db';

import type { VoiceIntent } from '@/lib/validations/voice';

import Party from '@/models/Party';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import AuditLog from '@/models/AuditLog';

import {
  resolveParty,
  resolveProduct,
} from './entityResolver';

import {
  createTransaction,
  reverseTransaction,
  TransactionServiceError,
} from './transactionService';

/* ========================================================================== */
/* Errors                                                                     */
/* ========================================================================== */

export class VoiceEngineError extends Error {
  code: string;
  details?: unknown;

  constructor(
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);

    this.name = 'VoiceEngineError';
    this.code = code;
    this.details = details;

    Object.setPrototypeOf(
      this,
      VoiceEngineError.prototype,
    );
  }
}

/* ========================================================================== */
/* Constants                                                                  */
/* ========================================================================== */

const HIGH_VALUE_LIMIT = 10000;

const CONFIRMATION_REQUIRED_CODES = new Set([
  'DELETE_ENTRY',
]);

const ENTITY_NOT_FOUND_CODES = new Set([
  'NOT_FOUND',
  'AMBIGUOUS_ENTITY',
]);

/* ========================================================================== */
/* Utility                                                                    */
/* ========================================================================== */

function money(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(
    (value + Number.EPSILON) * 100,
  ) / 100;
}

function safeNumber(
  value: unknown,
  fallback = 0,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return value;
}

function cleanString(
  value: unknown,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();

  return text.length > 0 ? text : null;
}

function isObjectId(
  value: unknown,
): boolean {
  return (
    typeof value === 'string' &&
    Types.ObjectId.isValid(value)
  );
}

function objectId(
  value: string,
): Types.ObjectId {
  return new Types.ObjectId(value);
}

/* ========================================================================== */
/* Authentication                                                            */
/* ========================================================================== */

async function assertAuthenticatedUser(
  sessionUserId: string,
): Promise<Types.ObjectId> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new VoiceEngineError(
      'UNAUTHORIZED',
      'Unauthorized',
    );
  }

  if (
    session.user.id !==
    sessionUserId
  ) {
    throw new VoiceEngineError(
      'UNAUTHORIZED',
      'User session mismatch',
    );
  }

  if (
    !Types.ObjectId.isValid(
      sessionUserId,
    )
  ) {
    throw new VoiceEngineError(
      'UNAUTHORIZED',
      'Invalid user id',
    );
  }

  return objectId(sessionUserId);
}

/* ========================================================================== */
/* Confirmation                                                               */
/* ========================================================================== */

function transactionValue(
  intent: VoiceIntent,
): number {
  const amount = safeNumber(
    intent.amount,
  );

  const quantity = safeNumber(
    intent.quantity,
  );

  const buyPrice = safeNumber(
    intent.buy_price,
  );

  const quantityValue =
    quantity * buyPrice;

  return Math.max(
    amount,
    quantityValue,
  );
}

function requiresConfirmation(
  intent: VoiceIntent,
): boolean {
  const value =
    transactionValue(intent);

  if (
    value > HIGH_VALUE_LIMIT
  ) {
    return true;
  }

  if (
    CONFIRMATION_REQUIRED_CODES.has(
      intent.intent,
    )
  ) {
    return true;
  }

  return false;
}

function assertConfirmed(
  intent: VoiceIntent,
  confirmed: boolean,
): void {
  if (
    confirmed
  ) {
    return;
  }

  if (
    !requiresConfirmation(
      intent,
    )
  ) {
    return;
  }

  if (
    intent.intent ===
    'DELETE_ENTRY'
  ) {
    throw new VoiceEngineError(
      'CONFIRMATION_REQUIRED',
      'Deleting an existing ledger entry requires confirmation',
    );
  }

  throw new VoiceEngineError(
    'CONFIRMATION_REQUIRED',
    `Transactions above ৳${HIGH_VALUE_LIMIT.toLocaleString(
      'en-BD',
    )} require confirmation`,
  );
}

/* ========================================================================== */
/* Party helpers                                                              */
/* ========================================================================== */

function partyPreview(
  party: any,
) {
  return {
    id: String(party._id),
    name: party.name,
    phone: party.phone ?? null,
    partyType:
      party.partyType ??
      null,
    balance:
      safeNumber(
        party.currentBalance,
      ),
  };
}

async function resolveSingleParty(
  userId: string,
  name: string,
  session: any,
  expectedType?:
    | 'CUSTOMER'
    | 'SUPPLIER',
) {
  const cleanName =
    cleanString(name);

  if (!cleanName) {
    throw new VoiceEngineError(
      'MISSING_ENTITY',
      'Customer or supplier name is required',
    );
  }

  const matches =
    await resolveParty(
      userId,
      cleanName,
      session,
    );

  let filtered =
    matches;

  if (expectedType) {
    filtered =
      matches.filter(
        (party: any) =>
          party.partyType ===
          expectedType,
      );
  }

  if (
    filtered.length === 0
  ) {
    throw new VoiceEngineError(
      'NOT_FOUND',
      `${expectedType === 'SUPPLIER'
        ? 'Supplier'
        : expectedType === 'CUSTOMER'
          ? 'Customer'
          : 'Party'
      } "${cleanName}" was not found`,
      {
        name: cleanName,
        expectedType,
      },
    );
  }

  if (
    filtered.length > 1
  ) {
    throw new VoiceEngineError(
      'AMBIGUOUS_ENTITY',
      `Multiple parties matched "${cleanName}"`,
      {
        name: cleanName,
        matches:
          filtered
            .slice(0, 10)
            .map(
              partyPreview,
            ),
      },
    );
  }

  return filtered[0];
}

/* ========================================================================== */
/* Product helpers                                                            */
/* ========================================================================== */

function productPreview(
  product: any,
) {
  return {
    id: String(product._id),
    name: product.name,
    stock:
      safeNumber(
        product.stockQuantity,
      ),
    unit:
      product.unit ?? null,
    buyPrice:
      safeNumber(
        product.buyPrice,
      ),
    sellPrice:
      safeNumber(
        product.sellPrice,
      ),
  };
}

async function resolveSingleProduct(
  userId: string,
  name: string,
  session?: any,
) {
  const cleanName =
    cleanString(name);

  if (!cleanName) {
    throw new VoiceEngineError(
      'MISSING_ENTITY',
      'Product name is required',
    );
  }

  const matches =
    await resolveProduct(
      userId,
      cleanName,
      session,
    );

  if (
    matches.length === 0
  ) {
    throw new VoiceEngineError(
      'NOT_FOUND',
      `Product "${cleanName}" was not found`,
      {
        name: cleanName,
      },
    );
  }

  if (
    matches.length > 1
  ) {
    throw new VoiceEngineError(
      'AMBIGUOUS_ENTITY',
      `Multiple products matched "${cleanName}"`,
      {
        name: cleanName,
        matches:
          matches
            .slice(0, 10)
            .map(
              productPreview,
            ),
      },
    );
  }

  return matches[0];
}

/* ========================================================================== */
/* READ BALANCE                                                              */
/* ========================================================================== */

async function readBalance(
  intent: VoiceIntent,
  userId: string,
  session: any,
) {
  const name =
    cleanString(
      intent.entity_name,
    );

  if (!name) {
    throw new VoiceEngineError(
      'MISSING_ENTITY',
      'Customer or supplier name is required',
    );
  }

  const party =
    await resolveSingleParty(
      userId,
      name,
      session,
    );

  return {
    type: 'READ_BALANCE',

    party: {
      id: String(
        party._id,
      ),
      name: party.name,
      phone:
        party.phone ??
        null,
      partyType:
        party.partyType,
    },

    balance: money(
      safeNumber(
        party.currentBalance,
      ),
    ),
  };
}

/* ========================================================================== */
/* LIST PRODUCTS                                                             */
/* ========================================================================== */

async function listProducts(
  userIdObjectId: Types.ObjectId,
  session: any,
) {
  const products =
    await Product.find({
      userId:
        userIdObjectId,
    })
      .sort({
        name: 1,
      })
      .limit(200)
      .session(session)
      .lean();

  return {
    type: 'LIST_ITEMS',

    count:
      products.length,

    items:
      products.map(
        (product: any) => ({
          id: String(
            product._id,
          ),

          name:
            product.name,

          stock:
            safeNumber(
              product.stockQuantity,
            ),

          unit:
            product.unit ??
            null,

          buyPrice:
            safeNumber(
              product.buyPrice,
            ),

          sellPrice:
            safeNumber(
              product.sellPrice,
            ),

          lowStock:
            safeNumber(
              product.stockQuantity,
            ) <=
            safeNumber(
              product.lowStockThreshold,
            ),
        }),
      ),
  };
}

/* ========================================================================== */
/* CREATE PARTY                                                              */
/* ========================================================================== */

async function createParty(
  intent: VoiceIntent,
  userIdObjectId: Types.ObjectId,
  userId: string,
  session: any,
) {
  const name =
    cleanString(
      intent.entity_name,
    );

  if (!name) {
    throw new VoiceEngineError(
      'MISSING_ENTITY',
      'Customer or supplier name is required',
    );
  }

  const existing =
    await resolveParty(
      userId,
      name,
      session,
    );

  if (
    existing.length > 0
  ) {
    throw new VoiceEngineError(
      'DUPLICATE_ENTITY',
      `A party named "${name}" already exists`,
      {
        matches:
          existing
            .slice(0, 10)
            .map(
              partyPreview,
            ),
      },
    );
  }

  const partyType =
    intent.party_type ??
    (
      intent.entity_type ===
      'SUPPLIER'
        ? 'SUPPLIER'
        : 'CUSTOMER'
    );

  if (
    partyType !==
      'CUSTOMER' &&
    partyType !==
      'SUPPLIER'
  ) {
    throw new VoiceEngineError(
      'INVALID_PARTY',
      'Party type must be CUSTOMER or SUPPLIER',
    );
  }

  const [party] =
    await Party.create(
      [
        {
          userId:
            userIdObjectId,

          name,

          phone:
            cleanString(
              intent.phone,
            ) ??
            undefined,

          partyType,

          currentBalance: 0,
        },
      ],
      {
        session,
      },
    );

  return {
    type:
      'CREATE_PARTY',

    id:
      String(
        party._id,
      ),

    name:
      party.name,

    phone:
      party.phone ??
      null,

    partyType:
      party.partyType,

    balance: 0,
  };
}

/* ========================================================================== */
/* CREATE PRODUCT                                                            */
/* ========================================================================== */

async function createProduct(
  intent: VoiceIntent,
  userIdObjectId: Types.ObjectId,
  userId: string,
  session: any,
) {
  const name =
    cleanString(
      intent.entity_name,
    );

  const unit =
    cleanString(
      intent.unit,
    );

  if (!name) {
    throw new VoiceEngineError(
      'INVALID_PRODUCT',
      'Product name is required',
    );
  }

  if (!unit) {
    throw new VoiceEngineError(
      'INVALID_PRODUCT',
      'Product unit is required',
    );
  }

  const existing =
    await resolveProduct(
      userId,
      name,
      session,
    );

  if (
    existing.length > 0
  ) {
    throw new VoiceEngineError(
      'DUPLICATE_ENTITY',
      `Product "${name}" already exists`,
      {
        matches:
          existing
            .slice(0, 10)
            .map(
              productPreview,
            ),
      },
    );
  }

  const initialStock =
    Math.max(
      0,
      safeNumber(
        intent.quantity,
      ),
    );

  const buyPrice =
    Math.max(
      0,
      safeNumber(
        intent.buy_price,
      ),
    );

  const sellPrice =
    Math.max(
      0,
      safeNumber(
        intent.sell_price,
      ),
    );

  const lowStockThreshold =
    Math.max(
      0,
      safeNumber(
        intent.low_stock_threshold,
        5,
      ),
    );

  const [product] =
    await Product.create(
      [
        {
          userId:
            userIdObjectId,

          name,

          unit,

          stockQuantity:
            initialStock,

          buyPrice,

          sellPrice,

          lowStockThreshold,
        },
      ],
      {
        session,
      },
    );

  let initialTransaction:
    unknown = null;

  if (
    initialStock > 0
  ) {
    initialTransaction =
      await createTransaction(
        {
          type:
            'STOCK_IN',

          productId:
            String(
              product._id,
            ),

          amount:
            money(
              initialStock *
                buyPrice,
            ),

          quantity:
            initialStock,

          unitPrice:
            buyPrice ||
            undefined,

          notes:
            'Initial stock created by voice',
        },
        userId,
        session,
      );
  }

  return {
    type:
      'CREATE_PRODUCT',

    id:
      String(
        product._id,
      ),

    name:
      product.name,

    unit:
      product.unit,

    stock:
      product.stockQuantity,

    buyPrice:
      product.buyPrice,

    sellPrice:
      product.sellPrice,

    lowStockThreshold:
      product.lowStockThreshold,

    initialTransaction,
  };
}

/* ========================================================================== */
/* CREATE DUE / PAYMENT / EXPENSE                                             */
/* ========================================================================== */

async function createSimpleTransaction(
  intent: VoiceIntent,
  userId: string,
  session?: any,
) {
  const type =
    intent.transaction_type;

  if (!type) {
    throw new VoiceEngineError(
      'INVALID_INTENT',
      'Transaction type is required',
    );
  }

  const amount =
    money(
      safeNumber(
        intent.amount,
      ),
    );

  const quantity =
    Math.max(
      0,
      safeNumber(
        intent.quantity,
      ),
    );

  if (
    type !== 'STOCK_IN' &&
    type !== 'STOCK_OUT' &&
    quantity <= 0 &&
    amount <= 0
  ) {
    throw new VoiceEngineError(
      'INVALID_TRANSACTION',
      'A valid amount or quantity is required',
    );
  }

  let partyId:
    | string
    | undefined;

  if (
    type ===
      'DUE_GIVEN' ||
    type ===
      'DUE_RECEIVED'
  ) {
    const name =
      cleanString(
        intent.entity_name,
      );

    if (!name) {
      throw new VoiceEngineError(
        'MISSING_ENTITY',
        'Customer name is required',
      );
    }

    const party =
      await resolveSingleParty(
        userId,
        name,
        session,
        'CUSTOMER',
      );

    partyId =
      String(
        party._id,
      );
  }

  const result =
    await createTransaction(
      {
        type,

        partyId,

        amount,

        quantity,

        unitPrice:
          undefined,

        notes:
          cleanString(
            intent.notes,
          ) ??
          undefined,
      },
      userId,
      session,
    );

  return {
    type,
    amount,
    quantity,
    partyId:
      partyId ??
      null,
    transaction:
      result,
  };
}

/* ========================================================================== */
/* STOCK UPDATE                                                              */
/* ========================================================================== */

async function updateStock(
  intent: VoiceIntent,
  userId: string,
  userIdObjectId: Types.ObjectId,
  session: any,
) {
  const productName =
    cleanString(
      intent.entity_name,
    );

  if (!productName) {
    throw new VoiceEngineError(
      'INVALID_STOCK',
      'Product name is required',
    );
  }

  const quantity =
    safeNumber(
      intent.quantity,
    );

  if (
    quantity <= 0
  ) {
    throw new VoiceEngineError(
      'INVALID_STOCK',
      'Stock quantity must be greater than zero',
    );
  }

  const product =
    await resolveSingleProduct(
      userId,
      productName,
      session,
    );

  const type =
    intent.transaction_type ===
    'STOCK_OUT'
      ? 'STOCK_OUT'
      : 'STOCK_IN';

  const spokenAmount =
    safeNumber(
      intent.amount,
    );

  const unitPrice =
    spokenAmount > 0
      ? money(
          spokenAmount /
            quantity,
        )
      : undefined;

  const transaction =
    await createTransaction(
      {
        type,

        productId:
          String(
            product._id,
          ),

        amount:
          spokenAmount,

        quantity,

        unitPrice,

        notes:
          cleanString(
            intent.notes,
          ) ??
          undefined,
      },
      userId,
      session,
    );

  const freshProduct =
    await Product.findOne({
      _id:
        product._id,

      userId:
        userIdObjectId,
    })
      .session(session)
      .lean();

  return {
    type,

    product: {
      id:
        String(
          product._id,
        ),

      name:
        product.name,

      unit:
        product.unit,
    },

    quantity,

    stock:
      safeNumber(
        freshProduct?.stockQuantity,
      ),

    transaction,
  };
}

/* ========================================================================== */
/* SALE                                                                       */
/* ========================================================================== */

type SaleItem = NonNullable<
  VoiceIntent['items']
>[number];

async function createSale(
  intent: VoiceIntent,
  userId: string,
  session: any,
) {
  const rawItems: SaleItem[] =
    intent.items &&
    intent.items.length > 0
      ? intent.items
      : intent.entity_name
        ? [
            {
              product_name:
                intent.entity_name,

              quantity:
                Math.max(
                  0,
                  safeNumber(
                    intent.quantity,
                  ),
                ),

              unit:
                intent.unit ??
                null,

              unit_price:
                null,
            },
          ]
        : [];

  if (
    rawItems.length === 0
  ) {
    throw new VoiceEngineError(
      'INVALID_SALE',
      'At least one product is required for a sale',
    );
  }

  const createdTransactions:
    unknown[] = [];

  let total = 0;

  for (
    const item of rawItems
  ) {
    const productName =
      cleanString(
        item.product_name,
      );

    if (!productName) {
      throw new VoiceEngineError(
        'INVALID_SALE',
        'Sale product name is required',
      );
    }

    const quantity =
      safeNumber(
        item.quantity,
      );

    if (
      quantity <= 0
    ) {
      throw new VoiceEngineError(
        'INVALID_SALE',
        `Invalid quantity for ${productName}`,
      );
    }

    const product =
      await resolveSingleProduct(
        userId,
        productName,
        session,
      );

    const price =
      item.unit_price !==
        null &&
      item.unit_price !==
        undefined
        ? safeNumber(
            item.unit_price,
          )
        : safeNumber(
            product.sellPrice,
          );

    if (
      price <= 0
    ) {
      throw new VoiceEngineError(
        'INVALID_SALE',
        `Selling price is not set for "${product.name}"`,
        {
          product:
            productPreview(
              product,
            ),
        },
      );
    }

    const lineTotal =
      money(
        price *
          quantity,
      );

    total =
      money(
        total +
          lineTotal,
      );

    const transaction =
      await createTransaction(
        {
          type:
            'SALE',

          productId:
            String(
              product._id,
            ),

          amount:
            lineTotal,

          quantity,

          unitPrice:
            price,

          notes:
            cleanString(
              intent.notes,
            ) ??
            undefined,
        },
        userId,
        session,
      );

    createdTransactions.push(
      transaction,
    );
  }

  const spokenAmount =
    intent.amount !==
      null &&
    intent.amount !==
      undefined
      ? money(
          safeNumber(
            intent.amount,
          ),
        )
      : null;

  if (
    spokenAmount !==
      null &&
    Math.abs(
      spokenAmount -
        total,
    ) > 0.01
  ) {
    throw new VoiceEngineError(
      'AMOUNT_MISMATCH',
      `Spoken total ৳${spokenAmount.toLocaleString(
        'en-BD',
      )} does not match calculated total ৳${total.toLocaleString(
        'en-BD',
      )}`,
      {
        spokenAmount,
        calculatedTotal:
          total,
      },
    );
  }

  const paid =
    Math.min(
      Math.max(
        0,
        safeNumber(
          intent.paid_amount,
          spokenAmount ??
            total,
        ),
      ),
      total,
    );

  const due =
    money(
      total -
        paid,
    );

  let customer:
    | any
    | null = null;

  /*
   * If entity_name was supplied together with items,
   * try to interpret it as customer only when it
   * resolves to a customer.
   */
  if (
    intent.entity_name &&
    intent.items &&
    intent.items.length > 0
  ) {
    const possible =
      await resolveParty(
        userId,
        intent.entity_name,
        session,
      );

    const customers =
      possible.filter(
        (party: any) =>
          party.partyType ===
          'CUSTOMER',
      );

    if (
      customers.length > 1
    ) {
      throw new VoiceEngineError(
        'AMBIGUOUS_ENTITY',
        `Multiple customers matched "${intent.entity_name}"`,
        {
          matches:
            customers
              .slice(0, 10)
              .map(
                partyPreview,
              ),
        },
      );
    }

    if (
      customers.length === 1
    ) {
      customer =
        customers[0];
    }
  }

  if (
    due > 0
  ) {
    if (!customer) {
      throw new VoiceEngineError(
        'CUSTOMER_REQUIRED',
        'A customer is required when the sale has an unpaid balance',
        {
          total,
          paid,
          due,
        },
      );
    }

    const dueTransaction =
      await createTransaction(
        {
          type:
            'DUE_GIVEN',

          partyId:
            String(
              customer._id,
            ),

          amount:
            due,

          quantity: 0,

          notes:
            'Customer due created from voice sale',
        },
        userId,
        session,
      );

    createdTransactions.push(
      dueTransaction,
    );
  }

  return {
    type: 'SALE',

    total,

    paid,

    due,

    customer:
      customer
        ? partyPreview(
            customer,
          )
        : null,

    transactions:
      createdTransactions,
  };
}

/* ========================================================================== */
/* DELETE / REVERSE TRANSACTION                                              */
/* ========================================================================== */

async function deleteEntry(
  intent: VoiceIntent,
  userIdObjectId: Types.ObjectId,
  userId: string,
  session: any,
) {
  const name =
    cleanString(
      intent.entity_name,
    );

  const amount =
    intent.amount !==
      null &&
    intent.amount !==
      undefined
      ? money(
          safeNumber(
            intent.amount,
          ),
        )
      : null;

  const type =
    intent.transaction_type ??
    null;

  /*
   * Build a user-scoped transaction query.
   */
  const query: Record<
    string,
    unknown
  > = {
    userId:
      userIdObjectId,
  };

  if (
    amount !== null
  ) {
    query.amount =
      amount;
  }

  if (type) {
    query.type =
      type;
  }

  /*
   * If a party/product name exists,
   * resolve it before selecting a transaction.
   *
   * This prevents:
   *
   * "রহিমের ৫০০ টাকা মুছে দাও"
   *
   * from deleting করিমের ৫০০ transaction.
   */
  let party:
    | any
    | null = null;

  let product:
    | any
    | null = null;

  if (name) {
    const parties =
      await resolveParty(
        userId,
        name,
        session,
      );

    const products =
      await resolveProduct(
        userId,
        name,
        session,
      );

    if (
      parties.length === 1
    ) {
      party =
        parties[0];
    }

    if (
      products.length === 1
    ) {
      product =
        products[0];
    }

    if (
      parties.length > 1 &&
      !products.length
    ) {
      throw new VoiceEngineError(
        'AMBIGUOUS_ENTITY',
        `Multiple parties matched "${name}"`,
        {
          matches:
            parties
              .slice(0, 10)
              .map(
                partyPreview,
              ),
        },
      );
    }

    if (
      products.length > 1 &&
      !parties.length
    ) {
      throw new VoiceEngineError(
        'AMBIGUOUS_ENTITY',
        `Multiple products matched "${name}"`,
        {
          matches:
            products
              .slice(0, 10)
              .map(
                productPreview,
              ),
        },
      );
    }
  }

  if (party) {
    query.partyId =
      party._id;
  }

  if (product) {
    query.productId =
      product._id;
  }

  /*
   * When no identifying filter exists,
   * don't blindly delete the latest transaction.
   *
   * The user should provide enough information.
   */
  const hasSpecificFilter =
    amount !== null ||
    type !== null ||
    !!party ||
    !!product;

  if (
    !hasSpecificFilter
  ) {
    throw new VoiceEngineError(
      'INSUFFICIENT_DELETE_INFO',
      'Please specify the customer, product, amount, or transaction type to delete',
    );
  }

  const candidates =
    await Transaction.find(
      query,
    )
      .sort({
        timestamp: -1,
        createdAt: -1,
      })
      .limit(10)
      .session(session)
      .lean();

  if (
    candidates.length ===
    0
  ) {
    throw new VoiceEngineError(
      'NOT_FOUND',
      'No matching transaction was found',
      {
        filters: {
          amount,
          type,
          entity:
            name,
        },
      },
    );
  }

  if (
    candidates.length > 1
  ) {
    throw new VoiceEngineError(
      'AMBIGUOUS_TRANSACTION',
      'Multiple transactions match the request. Please provide more details.',
      {
        matches:
          candidates.map(
            (tx: any) => ({
              id:
                String(
                  tx._id,
                ),
              type:
                tx.type,
              amount:
                tx.amount,
              quantity:
                tx.quantity,
              timestamp:
                tx.timestamp,
              partyId:
                tx.partyId
                  ? String(
                      tx.partyId,
                    )
                  : null,
              productId:
                tx.productId
                  ? String(
                      tx.productId,
                    )
                  : null,
              notes:
                tx.notes ??
                null,
            }),
          ),
      },
    );
  }

  const transaction =
    candidates[0];

  const reversed =
    await reverseTransaction(
      String(
        transaction._id,
      ),
      userId,
      session,
    );

  return {
    type:
      'DELETE_ENTRY',

    deletedTransaction: {
      id:
        String(
          transaction._id,
        ),
      transactionType:
        transaction.type,
      amount:
        transaction.amount,
      quantity:
        transaction.quantity,
      timestamp:
        transaction.timestamp,
    },

    reversal:
      reversed,
  };
}

/* ========================================================================== */
/* Main Engine                                                                */
/* ========================================================================== */

export async function executeVoiceCommand(
  intent: VoiceIntent,
  sessionUserId: string,
  transcript = '',
  confirmed = false,
  commandId?: string,
) {
  /*
   * ---------------------------------------------------------------
   * 1. Authentication
   * ---------------------------------------------------------------
   */

  const uid =
    await assertAuthenticatedUser(
      sessionUserId,
    );

  /*
   * ---------------------------------------------------------------
   * 2. Confirmation
   * ---------------------------------------------------------------
   */

  assertConfirmed(
    intent,
    confirmed,
  );

  /*
   * ---------------------------------------------------------------
   * 3. Database
   * ---------------------------------------------------------------
   */

  await connectDB();

  try {
    /*
     * -------------------------------------------------------------
     * 4. Idempotency
     * -------------------------------------------------------------
     */
    if (commandId) {
      const previous =
        await AuditLog.findOne({
          userId: uid,
          commandId,
          status: 'SUCCESS',
        }).lean();

      if (previous?.result) {
        return previous.result;
      }
    }

    /*
     * Due/payment commands have exactly two financial writes:
     * party balance + ledger entry. createTransaction() owns one
     * short atomic MongoDB transaction for those writes. Keeping
     * them out of the larger voice/audit transaction prevents a
     * long-lived transaction from waiting on unrelated audit work.
     */
    if (
      intent.intent === 'CREATE_TRANSACTION' &&
      (intent.transaction_type === 'DUE_GIVEN' ||
        intent.transaction_type === 'DUE_RECEIVED')
    ) {
      const result = await createSimpleTransaction(
        intent,
        sessionUserId,
      );

      try {
        await AuditLog.create({
          userId: uid,
          voiceTranscript: transcript,
          parsedIntent: intent,
          status: 'SUCCESS',
          commandId: commandId ?? undefined,
          result,
        });
      } catch {
        // Financial commit already succeeded; audit failure must not undo it.
      }

      return result;
    }

    const session =
      await Party.startSession();

    try {
      let result:
        | unknown
        | undefined;

      const transactionOptions = {
        readConcern: { level: 'local' as const },
        writeConcern: { w: 'majority' as const },
        maxCommitTimeMS: 10000,
      };

      await session.withTransaction(
      async () => {
        switch (
          intent.intent
        ) {
          /* ====================================================== */
          /* READ BALANCE                                          */
          /* ====================================================== */

          case 'READ_BALANCE': {
            result =
              await readBalance(
                intent,
                sessionUserId,
                session,
              );

            break;
          }

          /* ====================================================== */
          /* LIST PRODUCTS                                         */
          /* ====================================================== */

          case 'LIST_ITEMS': {
            result =
              await listProducts(
                uid,
                session,
              );

            break;
          }

          /* ====================================================== */
          /* CREATE PARTY                                          */
          /* ====================================================== */

          case 'CREATE_PARTY': {
            result =
              await createParty(
                intent,
                uid,
                sessionUserId,
                session,
              );

            break;
          }

          /* ====================================================== */
          /* CREATE PRODUCT                                        */
          /* ====================================================== */

          case 'CREATE_PRODUCT': {
            result =
              await createProduct(
                intent,
                uid,
                sessionUserId,
                session,
              );

            break;
          }

          /* ====================================================== */
          /* CREATE TRANSACTION                                    */
          /* ====================================================== */

          case 'CREATE_TRANSACTION': {
            if (
              intent.transaction_type ===
              'SALE'
            ) {
              result =
                await createSale(
                  intent,
                  sessionUserId,
                  session,
                );
            } else {
              result =
                await createSimpleTransaction(
                  intent,
                  sessionUserId,
                  session,
                );
            }

            break;
          }

          /* ====================================================== */
          /* UPDATE STOCK                                          */
          /* ====================================================== */

          case 'UPDATE_STOCK': {
            result =
              await updateStock(
                intent,
                sessionUserId,
                uid,
                session,
              );

            break;
          }

          /* ====================================================== */
          /* DELETE ENTRY                                          */
          /* ====================================================== */

          case 'DELETE_ENTRY': {
            result =
              await deleteEntry(
                intent,
                uid,
                sessionUserId,
                session,
              );

            break;
          }

          /* ====================================================== */
          /* Unknown                                               */
          /* ====================================================== */

          default: {
            throw new VoiceEngineError(
              'UNSUPPORTED_INTENT',
              `Unsupported voice intent: ${
                (intent as any)
                  .intent
              }`,
            );
          }
        }

        /*
         * ---------------------------------------------------------
         * 6. Audit success
         * ---------------------------------------------------------
         */

        await AuditLog.create(
          [
            {
              userId: uid,

              voiceTranscript:
                transcript,

              parsedIntent:
                intent,

              status:
                'SUCCESS',

              commandId:
                commandId ??
                undefined,

              result,
            },
          ],
          {
            session,
          },
        );
      },
      transactionOptions,
    );

    return result;
  } catch (error) {
    /*
     * -------------------------------------------------------------
     * Convert known service errors
     * -------------------------------------------------------------
     */

    if (
      error instanceof
      VoiceEngineError
    ) {
      /*
       * Failed audit intentionally
       * happens outside the main transaction.
       */
      try {
        await AuditLog.create({
          userId: uid,

          voiceTranscript:
            transcript,

          parsedIntent:
            intent,

          status:
            'FAILED',

          commandId:
            commandId ??
            undefined,

          errorMessage:
            error.message,
        });
      } catch {
        // Never hide the original error.
      }

      throw error;
    }

    if (
      error instanceof
      TransactionServiceError
    ) {
      const converted =
        new VoiceEngineError(
          error.code,
          error.message,
          error.details,
        );

      try {
        await AuditLog.create({
          userId: uid,

          voiceTranscript:
            transcript,

          parsedIntent:
            intent,

          status:
            'FAILED',

          commandId:
            commandId ??
            undefined,

          errorMessage:
            converted.message,
        });
      } catch {
        // Ignore audit failure.
      }

      throw converted;
    }

    /*
     * -------------------------------------------------------------
     * Unknown error
     * -------------------------------------------------------------
     */

    const unknownError =
      error instanceof Error
        ? error
        : new Error(
            'Unknown voice execution error',
          );

    try {
      await AuditLog.create({
        userId: uid,

        voiceTranscript:
          transcript,

        parsedIntent:
          intent,

        status:
          'FAILED',

        commandId:
          commandId ??
          undefined,

        errorMessage:
          unknownError.message,
      });
    } catch {
      // Ignore audit failure.
    }

    throw unknownError;
  } finally {
    await session.endSession();
  }
}