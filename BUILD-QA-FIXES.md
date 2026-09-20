# Build & Test QA Fixes

## Fixed

1. `app/api/register/route.ts` no longer accesses Zod `fieldErrors` unsafely. Duplicate-email detection is type-safe and returns HTTP 409; validation errors return 422.
2. Added `vite.config.ts` with the same `@/*` alias used by TypeScript/Next.js so Vitest can resolve imports such as `@/lib/validations/voice` and `@/lib/validations/domain`.
3. Added a `test:watch` script for local test development.
4. `npm run start` is intentionally only valid after a successful `npm run build`. The previous `.next` error was a consequence of the failed build, not an independent application failure.

## Edge Runtime warning

NextAuth/Auth.js uses the `jose` Web API bundle in middleware. Next.js 14 runs middleware in the Edge Runtime, so the build may emit the `CompressionStream`/`DecompressionStream` warning from `jose`. This is a dependency warning, not a build failure. The middleware is intentionally kept Edge-safe and does not import Mongoose, MongoDB, bcrypt, or the server auth configuration.
