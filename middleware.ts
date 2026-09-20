import NextAuth from 'next-auth';
import authConfig from './auth.config';

/**
 * Edge-safe middleware.
 *
 * IMPORTANT:
 * Do not import ./auth here because ./auth loads
 * MongoDB/Mongoose and Node.js-only dependencies.
 */
const { auth: withAuth } = NextAuth(authConfig);

export default withAuth((req) => {
  const path = req.nextUrl.pathname;
  const user = req.auth?.user;

  /**
   * Dashboard protection.
   *
   * Do NOT check user.id here.
   * The edge-safe Auth.js config may not expose
   * the application's custom Mongoose user ID.
   */
  if (path.startsWith('/dashboard') && !user) {
    const url = new URL('/signin', req.nextUrl.origin);
    url.searchParams.set('callbackUrl', path);

    return Response.redirect(url);
  }

  /**
   * Admin protection.
   *
   * For now, use the role only if it is actually
   * available in the edge session.
   */
  if (path.startsWith('/admin')) {
    if (!user) {
      const url = new URL('/signin', req.nextUrl.origin);
      url.searchParams.set('callbackUrl', path);

      return Response.redirect(url);
    }

    if (user.role !== 'ADMIN') {
      return Response.redirect(
        new URL('/dashboard', req.nextUrl.origin),
      );
    }
  }

  return undefined;
});

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};