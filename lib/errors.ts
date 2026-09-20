export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public details?: unknown) { super(message); this.name = 'AppError'; }
}
export function publicError(error: unknown) {
  if (error instanceof AppError) return { error: error.message, code: error.code, status: error.status, details: error.details };
  const e = error as { code?: string; message?: string };
  if (e?.code === '11000') return { error: 'A record with these details already exists.', code: 'DUPLICATE', status: 409 };
  return { error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR', status: 500 };
}
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  return error instanceof Error && error.message ? error.message : fallback;
}
