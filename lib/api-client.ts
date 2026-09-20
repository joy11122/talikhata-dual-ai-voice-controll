import type { ApiResponse } from '@/types/api';
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Request failed. Please try again.');
  if (data && typeof data === 'object' && 'ok' in data && data.ok === true && 'result' in data) return (data as ApiResponse<T> & { result: T }).result;
  return data as T;
}
