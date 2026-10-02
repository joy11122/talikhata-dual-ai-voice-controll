
import 'server-only';

import mongoose from 'mongoose';

const MONGODB_URI: string | undefined = process.env.MONGODB_URI;

if (typeof MONGODB_URI !== 'string' || MONGODB_URI.trim() === '') {
  throw new Error('Missing MONGODB_URI');
}

const mongoUri: string = MONGODB_URI;

type Cached = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  mongoose?: Cached;
};

const cached: Cached =
  globalForMongoose.mongoose ?? {
    conn: null,
    promise: null,
  };

if (!globalForMongoose.mongoose) {
  globalForMongoose.mongoose = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;

    // Keep the Product SKU uniqueness rule aligned with the schema.
    // The legacy userId_1_sku_1 index may already exist without the
    // partial filter, which would still reject multiple null SKUs.
    const db = cached.conn.connection.db;
    if (db) {
      const products = db.collection('products');
      const indexName = 'userId_1_sku_1';

      const indexMigrations: Array<{
        name: string;
        key: Record<string, 1 | -1>;
        partialFilterExpression: Record<string, unknown>;
      }> = [
        {
          name: 'userId_1_sku_1',
          key: { userId: 1, sku: 1 },
          partialFilterExpression: { sku: { $type: 'string' } },
        },
        {
          name: 'userId_1_barcode_1',
          key: { userId: 1, barcode: 1 },
          partialFilterExpression: { barcode: { $type: 'string' } },
        },
      ];

      const indexes = await products.indexes();

      for (const migration of indexMigrations) {
        const existing = indexes.find((index) => index.name === migration.name);

        if (existing && !existing.partialFilterExpression) {
          await products.dropIndex(migration.name);
        }

        try {
          await products.createIndex(migration.key, {
            name: migration.name,
            unique: true,
            partialFilterExpression: migration.partialFilterExpression,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes('already exists')) {
            throw error;
          }
        }
      }
    }
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

export default connectDB;
