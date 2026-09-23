import { NextResponse } from 'next/server';

import { auth } from '@/auth';

import {
  VoiceIntentSchema,
} from '@/lib/validations/voice';

import { z } from 'zod';

import {
  executeVoiceCommand,
} from '@/services/voiceEngine';

/* -------------------------------------------------------------------------- */
/* Bengali digit normalization                                                */
/* -------------------------------------------------------------------------- */

function normalizeDigits(
  value: string,
): string {
  const bn =
    '০১২৩৪৫৬৭৮৯';

  const en =
    '0123456789';

  return value.replace(
    /[০-৯]/g,
    (digit) => {
      const index =
        bn.indexOf(digit);

      return index >= 0
        ? en[index]
        : digit;
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Normalize text                                                             */
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
/* Amount                                                                     */
/* -------------------------------------------------------------------------- */

function extractAmount(
  transcript: string,
): number | null {
  const text =
    normalizeDigits(
      transcript,
    );

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

  const amount =
    Number(
      match[1].replace(
        /,/g,
        '',
      ),
    );

  if (
    !Number.isFinite(
      amount,
    ) ||
    amount <= 0
  ) {
    return null;
  }

  return amount;
}

/* -------------------------------------------------------------------------- */
/* Balance question                                                           */
/* -------------------------------------------------------------------------- */

function isBalanceQuestion(
  transcript: string,
): boolean {
  const text =
    normalizeText(
      transcript,
    );

  const question =
    /(?:কত|কতো|কয়|কয়|koto|kot|how much|balance|ব্যালেন্স|পাওনা|দেনা)/i;

  const due =
    /(?:বাকি|baki|bakir|bakite|due|পাওনা|দেনা|balance)/i;

  return (
    question.test(text) &&
    due.test(text)
  );
}

/* -------------------------------------------------------------------------- */
/* Due                                                                       */
/* -------------------------------------------------------------------------- */

function hasDueWord(
  transcript: string,
): boolean {
  const text =
    normalizeText(
      transcript,
    );

  return (
    text.includes(
      'বাকি',
    ) ||
    /\b(?:baki|bakir|bakite|due)\b/i.test(
      text,
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Payment                                                                    */
/* -------------------------------------------------------------------------- */

function isPaymentCommand(
  transcript: string,
): boolean {
  const text =
    normalizeText(
      transcript,
    );

  return (
    /(?:জমা|পরিশোধ|দিয়েছে|দিয়েছে|দিলেন|পেলাম|ফেরত)/i.test(
      text,
    ) ||
    /\b(?:joma|jama|paid|payment|pay|received|receive|dise|diyeche|dilo)\b/i.test(
      text,
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Supplier                                                                   */
/* -------------------------------------------------------------------------- */

function isSupplier(
  transcript: string,
): boolean {
  const text =
    normalizeText(
      transcript,
    );

  return /(?:supplier|সরবরাহকারী|সাপ্লায়ার|সাপ্লায়ার|পাইকার)/i.test(
    text,
  );
}

/* -------------------------------------------------------------------------- */
/* Deterministic security correction                                          */
/* -------------------------------------------------------------------------- */

function correctIntent(
  intent: z.infer<
    typeof VoiceIntentSchema
  >,
  transcript: string,
) {
  const amount =
    extractAmount(
      transcript,
    );

  /* ---------------------------------------------------------------------- */
  /* Balance                                                                */
  /* ---------------------------------------------------------------------- */

  if (
    isBalanceQuestion(
      transcript,
    )
  ) {
    return {
      ...intent,

      intent:
        'READ_BALANCE',

      entity_type:
        'CUSTOMER',

      amount:
        null,

      quantity:
        0,

      transaction_type:
        null,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Customer payment                                                       */
  /* ---------------------------------------------------------------------- */

  if (
    amount !== null &&
    isPaymentCommand(
      transcript,
    ) &&
    !isSupplier(
      transcript,
    )
  ) {
    return {
      ...intent,

      intent:
        'CREATE_TRANSACTION',

      entity_type:
        'CUSTOMER',

      amount,

      quantity:
        0,

      transaction_type:
        'DUE_RECEIVED',

      paid_amount:
        amount,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Customer due                                                           */
  /* ---------------------------------------------------------------------- */

  if (
    amount !== null &&
    hasDueWord(
      transcript,
    ) &&
    !isBalanceQuestion(
      transcript,
    )
  ) {
    return {
      ...intent,

      intent:
        'CREATE_TRANSACTION',

      entity_type:
        'CUSTOMER',

      amount,

      quantity:
        0,

      transaction_type:
        'DUE_GIVEN',

      paid_amount:
        0,
    };
  }

  return intent;
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
        ok: false,
        error:
          'Unauthorized',
      },
      {
        status: 401,
      },
    );
  }

  let body: unknown;

  try {
    body =
      await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Invalid JSON',
      },
      {
        status: 400,
      },
    );
  }

  const requestBody =
    body as {
      commandId?: unknown;
      intent?: unknown;
      transcript?: unknown;
      confirmed?: unknown;
    };

  /* ---------------------------------------------------------------------- */
  /* commandId                                                              */
  /* ---------------------------------------------------------------------- */

  const commandId =
    z
      .string()
      .uuid()
      .optional()
      .safeParse(
        requestBody.commandId,
      );

  if (!commandId.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Invalid command id',
      },
      {
        status: 400,
      },
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Transcript                                                             */
  /* ---------------------------------------------------------------------- */

  const transcript =
    typeof requestBody.transcript ===
    'string'
      ? requestBody.transcript.trim()
      : '';

  if (!transcript) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Transcript is required',
      },
      {
        status: 400,
      },
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Intent validation                                                      */
  /* ---------------------------------------------------------------------- */

  const parsed =
    VoiceIntentSchema.safeParse(
      requestBody.intent,
    );

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Invalid intent',

        issues:
          parsed.error.issues,
      },
      {
        status: 422,
      },
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Defensive correction                                                   */
  /* ---------------------------------------------------------------------- */

  const corrected =
    correctIntent(
      parsed.data,
      transcript,
    );

  /* ---------------------------------------------------------------------- */
  /* Final validation                                                       */
  /* ---------------------------------------------------------------------- */

  const finalParsed =
    VoiceIntentSchema.safeParse(
      corrected,
    );

  if (!finalParsed.success) {
    return NextResponse.json(
      {
        ok: false,

        error:
          'Invalid corrected intent',

        issues:
          finalParsed.error.issues,

        intent:
          corrected,
      },
      {
        status: 422,
      },
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Execute                                                                */
  /* ---------------------------------------------------------------------- */

  try {
    const result =
      await executeVoiceCommand(
        finalParsed.data,
        session.user.id,
        transcript,
        requestBody.confirmed ===
          true,
        commandId.data,
      );

    return NextResponse.json({
      ok: true,

      result,

      intent:
        finalParsed.data,
    });
  } catch (error) {
    const x =
      error as {
        code?: string;
        message?: string;
        details?: unknown;
      };

    /* -------------------------------------------------------------------- */
    /* Auth                                                                  */
    /* -------------------------------------------------------------------- */

    if (
      x.code ===
      'UNAUTHORIZED'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            x.message ||
            'Unauthorized',
          code:
            x.code,
          details:
            x.details,
        },
        {
          status: 401,
        },
      );
    }

    /* -------------------------------------------------------------------- */
    /* Confirmation / entity                                                */
    /* -------------------------------------------------------------------- */

    if (
      [
        'NOT_FOUND',
        'MISSING_ENTITY',
        'DUPLICATE_ENTITY',
        'INVALID_PARTY',
        'INVALID_PRODUCT',
        'INSUFFICIENT_DELETE_INFO',
        'AMBIGUOUS_ENTITY',
        'CONFIRMATION_REQUIRED',
        'AMOUNT_MISMATCH',
        'CUSTOMER_REQUIRED',
        'SUPPLIER_REQUIRED',
        'PRODUCT_REQUIRED',
        'ENTITY_NOT_FOUND',
        'PARTY_NOT_FOUND',
        'PRODUCT_NOT_FOUND',
        'TRANSACTION_NOT_FOUND',
      ].includes(
        x.code || '',
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            x.message ||
            'Confirmation or entity resolution required',

          code:
            x.code,

          details:
            x.details,
        },
        {
          status: 409,
        },
      );
    }

    /* -------------------------------------------------------------------- */
    /* Stock                                                                  */
    /* -------------------------------------------------------------------- */

    if (
      [
        'INSUFFICIENT_STOCK',
        'INVALID_STOCK',
        'NEGATIVE_STOCK',
      ].includes(
        x.code || '',
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            x.message ||
            'Invalid stock operation',

          code:
            x.code,

          details:
            x.details,
        },
        {
          status: 422,
        },
      );
    }

    /* -------------------------------------------------------------------- */
    /* Generic                                                               */
    /* -------------------------------------------------------------------- */

    return NextResponse.json(
      {
        ok: false,

        error:
          x.message ||
          'Execution failed',

        code:
          x.code,

        details:
          x.details,
      },
      {
        status: 400,
      },
    );
  }
}