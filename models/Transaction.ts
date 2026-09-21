import mongoose, { Schema, Types } from 'mongoose';

/* -------------------------------------------------------------------------- */
/* Transaction Types                                                          */
/* -------------------------------------------------------------------------- */

export type TransactionType =
  | 'DUE_GIVEN'
  | 'DUE_RECEIVED'
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'EXPENSE'
  | 'SALE';

/* -------------------------------------------------------------------------- */
/* Transaction Interface                                                      */
/* -------------------------------------------------------------------------- */

export interface ITransaction extends mongoose.Document {
  _id: Types.ObjectId;

  userId: Types.ObjectId;

  partyId?: Types.ObjectId;

  productId?: Types.ObjectId;

  type: TransactionType;

  amount: number;

  quantity: number;

  unitPrice?: number;

  paidAmount: number;

  costAmount: number;

  notes?: string;

  timestamp: Date;

  createdAt: Date;

  updatedAt: Date;

  /* ---------------------------------------------------------------------- */
  /* Soft delete                                                            */
  /* ---------------------------------------------------------------------- */

  isDeleted: boolean;

  deletedAt?: Date;

  deletedBy?: Types.ObjectId;

  /* ---------------------------------------------------------------------- */
  /* Voice / audit information                                              */
  /* ---------------------------------------------------------------------- */

  source?: 'MANUAL' | 'VOICE' | 'SYSTEM';

  commandId?: string;
}

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

const TransactionSchema = new Schema<ITransaction>(
  {
    /* -------------------------------------------------------------------- */
    /* Owner                                                                */
    /* -------------------------------------------------------------------- */

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /* -------------------------------------------------------------------- */
    /* Party                                                                */
    /* -------------------------------------------------------------------- */

    partyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      index: true,
    },

    /* -------------------------------------------------------------------- */
    /* Product                                                               */
    /* -------------------------------------------------------------------- */

    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      index: true,
    },

    /* -------------------------------------------------------------------- */
    /* Transaction type                                                     */
    /* -------------------------------------------------------------------- */

    type: {
      type: String,
      enum: [
        'DUE_GIVEN',
        'DUE_RECEIVED',
        'STOCK_IN',
        'STOCK_OUT',
        'EXPENSE',
        'SALE',
      ],
      required: true,
      index: true,
    },

    /* -------------------------------------------------------------------- */
    /* Financial data                                                       */
    /* -------------------------------------------------------------------- */

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    unitPrice: {
      type: Number,
      min: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    costAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* -------------------------------------------------------------------- */
    /* Notes                                                                */
    /* -------------------------------------------------------------------- */

    notes: {
      type: String,
      maxlength: 500,
      trim: true,
    },

    /* -------------------------------------------------------------------- */
    /* Timestamp                                                            */
    /* -------------------------------------------------------------------- */

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    /* -------------------------------------------------------------------- */
    /* Soft delete                                                          */
    /* -------------------------------------------------------------------- */

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
    },

    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    /* -------------------------------------------------------------------- */
    /* Source                                                                */
    /* -------------------------------------------------------------------- */

    source: {
      type: String,
      enum: ['MANUAL', 'VOICE', 'SYSTEM'],
      default: 'MANUAL',
      index: true,
    },

    /* -------------------------------------------------------------------- */
    /* Voice command ID                                                     */
    /* -------------------------------------------------------------------- */

    commandId: {
      type: String,
      trim: true,
      index: true,
    },
  },

  {
    timestamps: true,
    versionKey: false,
  },
);

/* -------------------------------------------------------------------------- */
/* Indexes                                                                    */
/* -------------------------------------------------------------------------- */

TransactionSchema.index({
  userId: 1,
  createdAt: -1,
});

TransactionSchema.index({
  userId: 1,
  timestamp: -1,
});

TransactionSchema.index({
  userId: 1,
  partyId: 1,
  timestamp: -1,
});

TransactionSchema.index({
  userId: 1,
  productId: 1,
  timestamp: -1,
});

TransactionSchema.index({
  userId: 1,
  type: 1,
  timestamp: -1,
});

TransactionSchema.index({
  userId: 1,
  isDeleted: 1,
  timestamp: -1,
});

TransactionSchema.index({
  userId: 1,
  commandId: 1,
});

/* -------------------------------------------------------------------------- */
/* Model                                                                      */
/* -------------------------------------------------------------------------- */

const Transaction =
  (mongoose.models.Transaction as mongoose.Model<ITransaction>) ||
  mongoose.model<ITransaction>(
    'Transaction',
    TransactionSchema,
  );

export default Transaction;