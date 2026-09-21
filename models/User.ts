import mongoose, { Schema, Types } from 'mongoose';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type UserRole =
  | 'USER'
  | 'ADMIN';

export type UserStatus =
  | 'ACTIVE'
  | 'SUSPENDED';

/* -------------------------------------------------------------------------- */
/* Interface                                                                  */
/* -------------------------------------------------------------------------- */

export interface IUser extends mongoose.Document {
  _id: Types.ObjectId;

  name: string;

  email: string;

  password?: string;

  image?: string;

  shopId?: Types.ObjectId;

  role: UserRole;

  status: UserStatus;

  createdAt: Date;

  updatedAt: Date;

  lastLoginAt?: Date;

  emailVerified?: Date;

  /* ---------------------------------------------------------------------- */
  /* Account metadata                                                       */
  /* ---------------------------------------------------------------------- */

  phone?: string;

  preferredLanguage?: 'bn' | 'en';

  timezone?: string;
}

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

const UserSchema = new Schema<IUser>(
  {
    /* -------------------------------------------------------------------- */
    /* Basic identity                                                        */
    /* -------------------------------------------------------------------- */

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    /* -------------------------------------------------------------------- */
    /* Authentication                                                        */
    /* -------------------------------------------------------------------- */

    password: {
      type: String,
      select: false,
    },

    image: {
      type: String,
      trim: true,
    },

    /* -------------------------------------------------------------------- */
    /* Shop                                                                  */
    /* -------------------------------------------------------------------- */

    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      index: true,
    },

    /* -------------------------------------------------------------------- */
    /* Authorization                                                         */
    /* -------------------------------------------------------------------- */

    role: {
      type: String,
      enum: [
        'USER',
        'ADMIN',
      ],
      default: 'USER',
      required: true,
      index: true,
    },

    /* -------------------------------------------------------------------- */
    /* Account status                                                        */
    /* -------------------------------------------------------------------- */

    status: {
      type: String,
      enum: [
        'ACTIVE',
        'SUSPENDED',
      ],
      default: 'ACTIVE',
      required: true,
      index: true,
    },

    /* -------------------------------------------------------------------- */
    /* Contact                                                               */
    /* -------------------------------------------------------------------- */

    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },

    /* -------------------------------------------------------------------- */
    /* Localization                                                         */
    /* -------------------------------------------------------------------- */

    preferredLanguage: {
      type: String,
      enum: [
        'bn',
        'en',
      ],
      default: 'bn',
    },

    timezone: {
      type: String,
      default: 'Asia/Dhaka',
      trim: true,
    },

    /* -------------------------------------------------------------------- */
    /* Login metadata                                                        */
    /* -------------------------------------------------------------------- */

    lastLoginAt: {
      type: Date,
    },

    emailVerified: {
      type: Date,
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

/*
 * Email is already unique through the schema definition.
 */
UserSchema.index({
  email: 1,
});

/*
 * Useful for shop-level user queries.
 */
UserSchema.index({
  shopId: 1,
  status: 1,
});

/*
 * Useful for admin queries.
 */
UserSchema.index({
  role: 1,
  status: 1,
});

/* -------------------------------------------------------------------------- */
/* Normalization                                                              */
/* -------------------------------------------------------------------------- */

/*
 * Always normalize email before saving.
 */
UserSchema.pre('save', function (next) {
  if (this.isModified('email') && this.email) {
    this.email = this.email
      .trim()
      .toLowerCase();
  }

  if (this.isModified('name') && this.name) {
    this.name = this.name.trim();
  }

  if (this.isModified('phone') && this.phone) {
    this.phone = this.phone.trim();
  }

  next();
});

/* -------------------------------------------------------------------------- */
/* Model                                                                      */
/* -------------------------------------------------------------------------- */

const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>(
    'User',
    UserSchema,
  );

export default User;