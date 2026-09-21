import NextAuth from 'next-auth';
import authConfig from './auth.config';

const { auth: withAuth } = NextAuth(authConfig);

export default withAuth((req) => {
  const path = req.nextUrl.pathname;
  const user = req.auth?.user;

  // Protected application routes
  if (path.startsWith('/dashboard') || path.startsWith('/admin')) {
    if (!user) {
      const callbackUrl =
        req.nextUrl.pathname + req.nextUrl.search;

      const url = new URL('/signin', req.nextUrl.origin);
      url.searchParams.set('callbackUrl', callbackUrl);

      return Response.redirect(url);
    }
  }

  // Admin-only routes
  if (path.startsWith('/admin') && user?.role !== 'ADMIN') {
    return Response.redirect(
      new URL('/dashboard', req.nextUrl.origin),
    );
  }

  return undefined;
});

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};