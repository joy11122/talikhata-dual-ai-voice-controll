
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function AuthRedirectPage() {
  const session = await auth();

  /**
   * No authenticated session.
   */
  if (!session?.user) {
    redirect('/signin');
  }

  /**
   * Admin users go to the admin dashboard.
   */
  if (session.user.role === 'ADMIN') {
    redirect('/admin');
  }

  /**
   * Normal users go to the main dashboard.
   */
  redirect('/dashboard');
}
