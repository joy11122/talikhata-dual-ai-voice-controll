import type { NextAuthConfig } from 'next-auth';

const authConfig = {
  pages: {
    signIn: '/signin',
  },

  /**
   * Providers are loaded in auth.ts.
   * Keep this file Edge-safe.
   */
  providers: [],

  callbacks: {
    /**
     * Middleware can read an existing Auth.js session.
     *
     * Do not perform MongoDB/Mongoose work here.
     */
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;