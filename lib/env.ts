import { z } from 'zod';

const Env = z.object({
  MONGODB_URI: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  OPENAI_VOICE_MODEL: z.string().default('gpt-4.1-mini'),
  OPENROUTER_MODEL: z.string().default('openrouter/free'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  CAP_SERVER_URL: z.string().url().optional(),
});

export function getEnv() {
  return Env.parse({
    MONGODB_URI: process.env.MONGODB_URI,
    AUTH_SECRET: process.env.AUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    OPENAI_VOICE_MODEL: process.env.OPENAI_VOICE_MODEL,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    CAP_SERVER_URL: process.env.CAP_SERVER_URL,
  });
}
