
import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe Auth.js configuration.
 *
 * IMPORTANT:
 * This file must never import Mongoose, MongoDB, bcrypt,
 * or any other Node.js-only dependency because it is
 * consumed by middleware.
 */
const authConfig = {
  pages: {
    signIn: '/signin',
  },

  // Providers are configured in auth.ts.
  // Keep this array empty here so this config remains
  // Edge/Middleware compatible.
  providers: [],

  callbacks: {
    /**
     * Keep authorization permissive here.
     * Middleware performs the final authentication,
     * redirect, and role-based access decisions.
     */
    authorized() {
      return true;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
