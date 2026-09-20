export interface ApiSuccess<T> { ok: true; result: T; }
export interface ApiFailure { ok?: false; error: string; code?: string; details?: unknown; }
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
