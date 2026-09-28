import NextAuth from 'next-auth';
import authConfig from './auth.config';

const { auth: withAuth } = NextAuth(authConfig);

function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;

  const configured = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return configured.includes(email.trim().toLowerCase());
}

export default withAuth((req) => {
  const path = req.nextUrl.pathname;
  const user = req.auth?.user;

  if (path.startsWith('/dashboard') || path.startsWith('/admin')) {
    if (!user) {
      const callbackUrl =
        req.nextUrl.pathname + req.nextUrl.search;

      const url = new URL('/signin', req.nextUrl.origin);
      url.searchParams.set('callbackUrl', callbackUrl);

      return Response.redirect(url);
    }
  }

  const admin =
    user?.role === 'ADMIN' ||
    isAdminEmail(user?.email);

  // Admins should never land in the normal shop dashboard.
  if (path.startsWith('/dashboard') && admin) {
    return Response.redirect(
      new URL('/admin', req.nextUrl.origin),
    );
  }

  if (path.startsWith('/admin') && !admin) {
    return Response.redirect(
      new URL('/dashboard', req.nextUrl.origin),
    );
  }

  return undefined;
});

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
