import { NextResponse } from 'next/server';
import { registerUser } from '@/app/actions/register';

function hasDuplicateEmailError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as Record<string, unknown>;
  const fieldErrors = value.fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== 'object') return false;
  const emailErrors = (fieldErrors as Record<string, unknown>).email;
  return Array.isArray(emailErrors) && emailErrors.some((message) => message === 'Email already registered');
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: { formErrors: ['Invalid JSON body'] } },
        { status: 400 },
      );
    }

    const result = await registerUser(body);
    if (!result.ok) {
      const status = hasDuplicateEmailError(result.error) ? 409 : 422;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[register] unexpected error', error);
    return NextResponse.json(
      { ok: false, error: { formErrors: ['Registration could not be completed. Please try again.'] } },
      { status: 500 },
    );
  }
}
