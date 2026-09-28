import 'server-only';

import { auth } from '@/auth';

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const configured = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return configured.includes(email.trim().toLowerCase());
}

export async function getAdminSession() {
  const session = await auth();
  const admin =
    Boolean(session?.user?.id) &&
    (session?.user?.role === 'ADMIN' || isAdminEmail(session?.user?.email));
  return { session, admin };
}