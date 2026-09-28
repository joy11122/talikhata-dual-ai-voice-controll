import { redirect } from 'next/navigation';
import { auth } from '@/auth';

function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;

  const configured = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return configured.includes(email.trim().toLowerCase());
}

export default async function AuthRedirectPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/signin');
  }

  const isAdmin =
    session.user.role === 'ADMIN' ||
    isAdminEmail(session.user.email);

  redirect(isAdmin ? '/admin' : '/dashboard');
}
