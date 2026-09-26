
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

/* -------------------------------------------------------------------------- */
/* Party name extraction                                                      */
/* -------------------------------------------------------------------------- */

function partyName(text: string): string | null {
  const value = normalizeVoiceText(text)
    .replace(/[।,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    /^(.+?)\s*(?:এর|র)\s*(?:কাছে\s*)?(?:কত|কতো)\s*(?:টাকা)?\s*(?:পাব|পাবে|পাও|বাকি|পাওনা)/iu,

    /^(.+?)\s*(?:এর|র)\s*(?:বাকি|পাওনা)\s*(?:কত|কতো)/iu,

    /^(.+?)\s*(?:কে)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:দিলাম|দিল|দিয়েছি|দিয়েছি|জমা|পরিশোধ|paid|pay|dilam|dilo|dil|diyechi)/iu,

    /^(.+?)\s+er\s+kache\s+\d[\d,]*(?:\.\d+)?\s*(?:taka|tk)?\s*(?:baki|due)\s*(?:dilam|dilo|dil|kore|dao)?$/i,

    /^(.+?)\s+ke\s+\d[\d,]*(?:\.\d+)?\s*(?:taka|tk)?\s*(?:dilam|dilo|dil|diyechi|paid|pay)?$/i,

    /^(.+?)\s*(?:কে)\s*\d[\d,]*(?:\.\d+)?\s*(?:টাকা|tk|taka)?\s*(?:বাকি|পাওনা)\s*(?:দিলাম|দাও|করো)?$/iu,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match?.[1]) {
      return match[1]
        .replace(/(?:এর|র|কে|ে)$/u, '')
        .replace(/\s+(?:er|r|ke|der|e)$/i, '')
        .trim();
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

  const balance =
    /(?:কত|কতো|বাকি|পাওনা|দেনা|balance|due|pabo|pabe|koto)/i.test(
      value,
    );

  const payment =
    /(?:জমা|পরিশোধ|পেলাম|দিয়েছে|দিয়েছে|paid|payment|received|receive|dilam|dilo|dise|diyeche|diyechi)/i.test(
      value,
    );

  const due =
    /(?:বাকি|পাওনা|due|baki)/i.test(value);

  if (name && balance) {
    const command = blank('READ_BALANCE');

    command.entityType = 'CUSTOMER';
    command.entityName = name;

    return command;
  }

  if (name && amount && payment) {
    const command = blank('RECEIVE_PAYMENT');

    command.entityType = 'CUSTOMER';
    command.entityName = name;
    command.amount = amount;

    return command;
  }

  if (name && amount && due) {
    const command = blank('CREATE_DUE');

    command.entityType = 'CUSTOMER';
    command.entityName = name;
    command.amount = amount;

    return command;
  }

  if (
    /(?:customer|কাস্টমার|গ্রাহক)/i.test(value) &&
    /(?:list|তালিকা|সব|দেখাও)/i.test(value)
  ) {
    const command = blank('LIST_PARTIES');

    command.entityType = 'CUSTOMER';
    command.partyType = 'CUSTOMER';

    return command;
  }

  if (
    /(?:supplier|সরবরাহকারী|সাপ্লায়ার)/i.test(value) &&
    /(?:list|তালিকা|সব|দেখাও)/i.test(value)
  ) {
    const command = blank('LIST_PARTIES');

    command.entityType = 'SUPPLIER';
    command.partyType = 'SUPPLIER';

    return command;
  }

  if (
    /(?:product|পণ্য|item)/i.test(value) &&
    /(?:list|তালিকা|সব|দেখাও)/i.test(value)
  ) {
    return blank('LIST_PRODUCTS');
  }

  if (
    /(?:transaction|লেনদেন|হিসাব)/i.test(value) &&
    /(?:list|তালিকা|দেখাও)/i.test(value)
  ) {
    return blank('LIST_TRANSACTIONS');
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* AI system prompt                                                           */
/* -------------------------------------------------------------------------- */

const SYSTEM = `
You are TaliKhata Voice Engine V2.

Parse Bangla, Banglish, English and mixed shop commands.

Return exactly one structured command through the provided function tool.

Never invent:
- names
- amounts
- IDs
- products
- phone numbers

Preserve entityName exactly as spoken whenever possible.

Rules:

Customer credit:
CREATE_DUE

Customer pays shop:
RECEIVE_PAYMENT

Balance:
READ_BALANCE

Party CRUD:
CREATE_PARTY
READ_PARTY
LIST_PARTIES
UPDATE_PARTY
DELETE_PARTY

User CRUD:
CREATE_USER
READ_USER
LIST_USERS
UPDATE_USER
DELETE_USER

User CRUD is admin-only.

Product CRUD:
CREATE_PRODUCT
READ_PRODUCT
LIST_PRODUCTS
UPDATE_PRODUCT
DELETE_PRODUCT

Inventory:
STOCK_IN
STOCK_OUT

Sales:
CREATE_SALE

Purchases:
CREATE_PURCHASE

Expenses:
CREATE_EXPENSE

Destructive actions require confirmation.

Financial writes above 10000 require confirmation.
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
    return local;
  }

  return aiParse(normalized);
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
/* Confirmation                                                               */
/* -------------------------------------------------------------------------- */

function confirm(
  command: VoiceV2Command,
  confirmed: boolean,
) {
  const destructiveActions = [
    'DELETE_PARTY',
    'DELETE_PRODUCT',
    'DELETE_TRANSACTION',
    'DELETE_USER',
  ];

  const needsConfirmation =
    command.confirmRequired ||
    destructiveActions.includes(
      command.action,
    );

  if (needsConfirmation && !confirmed) {
    throw new VoiceV2Error(
      'CONFIRMATION_REQUIRED',
      'এই কাজটি করার আগে confirmation প্রয়োজন।',
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

  const command =
    VoiceV2Schema.parse(commandInput);

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

          const party =
            await findParty(
              userId,
              command.entityName,
              session,
              'CUSTOMER',
            );

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
              id: String(
                party._id,
              ),
              name: party.name,
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

          const product =
            await findProduct(
              userId,
              command.entityName,
              session,
            );

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
              id: String(
                product._id,
              ),
              name: product.name,
              unit: product.unit,
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
          if (
            !command.entityName ||
            !command.quantity ||
            command.quantity <= 0 ||
            !command.unitPrice ||
            command.unitPrice <= 0
          ) {
            throw new VoiceV2Error(
              'INVALID_TRADE',
              'Product, quantity and unit price are required',
            );
          }

          const product =
            await findProduct(
              userId,
              command.entityName,
              session,
            );

          const total = money(
            command.quantity *
              command.unitPrice,
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

            if (command.query) {
              const customer =
                await findParty(
                  userId,
                  command.query,
                  session,
                  'CUSTOMER',
                );

              partyId = String(
                customer._id,
              );
            }

            const transaction =
              await createTransaction(
                {
                  type: 'SALE',

                  partyId,

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

            result = {
              type: 'CREATE_SALE',

              product:
                product.name,

              total,

              paidAmount: paid,

              due: money(
                total - paid,
              ),

              transaction,
            };
          } else {
            if (!command.query) {
              throw new VoiceV2Error(
                'PARTY_REQUIRED',
                'Supplier name is required for a purchase',
              );
            }

            const supplier =
              await findParty(
                userId,
                command.query,
                session,
                'SUPPLIER',
              );

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

              supplier:
                supplier.name,

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