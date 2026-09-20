
import 'server-only';

import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

import { SignInSchema } from '@/lib/validations/auth';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Shop from '@/models/Shop';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('Missing MONGODB_URI');
}

/**
 * Reuse MongoDB client during development / hot reloads.
 */
const globalMongo = globalThis as typeof globalThis & {
  tkMongoClient?: MongoClient;
  tkMongoPromise?: Promise<MongoClient>;
};

const client =
  globalMongo.tkMongoClient ??
  new MongoClient(uri);

if (!globalMongo.tkMongoClient) {
  globalMongo.tkMongoClient = client;
}

const clientPromise =
  globalMongo.tkMongoPromise ??
  client.connect();

if (!globalMongo.tkMongoPromise) {
  globalMongo.tkMongoPromise = clientPromise;
}

/**
 * Check whether an email belongs to the configured admin list.
 */
function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(
    email.trim().toLowerCase(),
  );
}

/**
 * Find/create the application's own User document
 * and make sure the user has a Shop.
 *
 * IMPORTANT:
 * The email is intentionally used as the primary identity
 * because Auth.js MongoDB Adapter and the application's
 * Mongoose User model may have different MongoDB _id values.
 */
async function ensureShop(
  userId: string | undefined,
  name: string,
  email: string,
  image?: string,
) {
  await connectDB();

  const normalizedEmail = email.trim().toLowerCase();

  const displayName =
    name?.trim() ||
    normalizedEmail.split('@')[0] ||
    'Shop Owner';

  /**
   * First search by email.
   *
   * This prevents an Auth.js Adapter user ID from being
   * incorrectly treated as the application's Mongoose
   * User._id.
   */
  let user = await User.findOne({
    email: normalizedEmail,
  });

  /**
   * Only use userId when an email lookup did not find
   * an existing application user.
   */
  if (!user && userId) {
    user = await User.findById(userId);
  }

  /**
   * Create the application's user if necessary.
   */
  if (!user) {
    user = await User.create({
      name: displayName,
      email: normalizedEmail,
      image,
      role: isAdminEmail(normalizedEmail)
        ? 'ADMIN'
        : 'USER',
      status: 'ACTIVE',
    });
  }

  /**
   * Keep email/name/image synchronized where appropriate.
   */
  if (!user.name) {
    user.name = displayName;
  }

  if (image && !user.image) {
    user.image = image;
  }

  /**
   * Keep admin status synchronized with ADMIN_EMAILS.
   */
  const admin = isAdminEmail(normalizedEmail);

  if (!user.role) {
    user.role = admin ? 'ADMIN' : 'USER';
  }

  if (admin && user.role !== 'ADMIN') {
    user.role = 'ADMIN';
  }

  if (!user.status) {
    user.status = 'ACTIVE';
  }

  /**
   * Find the user's existing shop.
   */
  let shop = user.shopId
    ? await Shop.findById(user.shopId)
    : await Shop.findOne({
        userId: user._id,
      });

  /**
   * Create the shop if it does not exist.
   */
  if (!shop) {
    shop = await Shop.findOneAndUpdate(
      {
        userId: user._id,
      },
      {
        $setOnInsert: {
          userId: user._id,
          shopName: `${displayName}'s Shop`,
          currency: 'BDT / ৳',
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  if (!shop) {
    throw new Error(
      'Could not create or find the user shop',
    );
  }

  /**
   * Attach shop to the application's User document.
   */
  if (!user.shopId) {
    user.shopId = shop._id;
  }

  await user.save();

  return {
    userId: String(user._id),
    shopId: String(shop._id),
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    status: user.status,
  };
}

/**
 * Auth.js providers.
 */
const providerList: any[] = [];

/**
 * Google OAuth.
 *
 * allowDangerousEmailAccountLinking is intentionally enabled
 * because this application supports both:
 *
 *   1. Email/password accounts
 *   2. Google OAuth accounts
 *
 * When the verified Google email matches an existing account,
 * Auth.js can link the OAuth account instead of throwing:
 *
 * OAuthAccountNotLinked
 */
if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET
) {
  providerList.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,

      allowDangerousEmailAccountLinking: true,
    }),
  );
}

/**
 * Email/password authentication.
 */
providerList.push(
  Credentials({
    name: 'Email & Password',

    credentials: {
      email: {
        label: 'Email',
        type: 'email',
      },
      password: {
        label: 'Password',
        type: 'password',
      },
    },

    async authorize(raw) {
      const parsed = SignInSchema.safeParse(raw);

      if (!parsed.success) {
        return null;
      }

      await connectDB();

      const email = parsed.data.email
        .trim()
        .toLowerCase();

      const user = await User.findOne({
        email,
      })
        .select('+password')
        .lean();

      /**
       * User does not exist or has no password.
       *
       * This can happen for an OAuth-only account.
       */
      if (!user?.password) {
        return null;
      }

      /**
       * Suspended users cannot sign in.
       */
      if (user.status === 'SUSPENDED') {
        return null;
      }

      const passwordValid = await bcrypt.compare(
        parsed.data.password,
        user.password,
      );

      if (!passwordValid) {
        return null;
      }

      /**
       * Credentials users already belong to the application's
       * Mongoose User collection, so passing their ID is safe.
       *
       * ensureShop() still checks email first.
       */
      const ensured = await ensureShop(
        String(user._id),
        user.name || 'Shop Owner',
        user.email,
        user.image || undefined,
      );

      return {
        id: ensured.userId,
        name: ensured.name,
        email: ensured.email,
        image: ensured.image,
        role: ensured.role,
        status: ensured.status,
        shopId: ensured.shopId,
      };
    },
  }),
);

/**
 * Auth.js configuration.
 */
export const authConfig = {
  adapter: MongoDBAdapter(clientPromise),

  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: '/signin',
  },

  providers: providerList,

  callbacks: {
    /**
     * OAuth sign-in validation.
     */
    async signIn({ user }: any) {
      if (!user?.email) {
        return false;
      }

      await connectDB();

      const email = user.email
        .trim()
        .toLowerCase();

      const existing = await User.findOne({
        email,
      });

      /**
       * Existing suspended account cannot authenticate.
       */
      if (existing?.status === 'SUSPENDED') {
        return false;
      }

      /**
       * If the application User does not exist yet,
       * create it.
       *
       * Auth.js Adapter may already have created its own
       * user document at this point. That is okay.
       */
      if (!existing) {
        await User.create({
          name:
            user.name ||
            email.split('@')[0] ||
            'Shop Owner',
          email,
          image: user.image,
          role: isAdminEmail(email)
            ? 'ADMIN'
            : 'USER',
          status: 'ACTIVE',
        });
      }

      return true;
    },

    /**
     * Add application-specific data to JWT.
     */
    async jwt({ token, user }: any) {
      /**
       * Fresh sign-in.
       */
      if (user?.email) {
        const ensured = await ensureShop(
          /**
           * Do NOT blindly trust user.id here for OAuth.
           * Auth.js Adapter and Mongoose User can have
           * different IDs.
           */
          undefined,
          String(
            user.name ||
              token.name ||
              'Shop Owner',
          ),
          String(user.email),
          user.image ||
            token.picture ||
            undefined,
        );

        token.id = ensured.userId;
        token.shopId = ensured.shopId;
        token.name = ensured.name;
        token.email = ensured.email;
        token.picture = ensured.image;
        token.role = ensured.role;
        token.status = ensured.status;
      }

      /**
       * Existing session.
       */
      else if (token.email) {
        const ensured = await ensureShop(
          undefined,
          String(
            token.name ||
              'Shop Owner',
          ),
          String(token.email),
          token.picture || undefined,
        );

        token.id = ensured.userId;
        token.shopId = ensured.shopId;
        token.name = ensured.name;
        token.email = ensured.email;
        token.picture = ensured.image;
        token.role = ensured.role;
        token.status = ensured.status;
      }

      return token;
    },

    /**
     * Expose application-specific JWT fields
     * on session.user.
     */
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = String(
          token.id || '',
        );

        session.user.shopId =
          token.shopId as
            | string
            | undefined;

        session.user.role =
          token.role;

        session.user.status =
          token.status;

        session.user.name =
          token.name || session.user.name;

        session.user.email =
          token.email || session.user.email;

        session.user.image =
          token.picture || session.user.image;
      }

      return session;
    },
  },
};
