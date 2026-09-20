# Edge Runtime QA Fix

## Root cause
`middleware.ts` imported `auth.ts`. `auth.ts` imported `lib/auth.ts`, which imports the MongoDB adapter and `lib/db.ts`; `lib/db.ts` imports Mongoose. Next.js therefore bundled Mongoose's browser build into the Edge Runtime and failed with:

`Dynamic Code Evaluation ... not allowed in Edge Runtime`

## Fix
- Added `auth.config.ts`, an Edge-safe Auth.js configuration containing no Mongoose, MongoDB, bcrypt, or database imports.
- Middleware now initializes Auth.js from `auth.config.ts` instead of importing the Node/Mongo-backed `auth.ts`.
- Server-side `auth.ts` still uses the full MongoDB adapter configuration for API routes/server components.
- Added comments and this document so future changes do not accidentally reintroduce Node-only imports into middleware.

## Edge import rule
Never import these from middleware or any Edge dependency chain:
- `mongoose`
- `mongodb` Node client
- `@auth/mongodb-adapter`
- `bcryptjs`
- database models
- `lib/db.ts`
- `lib/auth.ts`

If a middleware change requires user role/status, read it from the Auth.js JWT/session token rather than querying MongoDB from Edge middleware.

## Local verification
Run:

```powershell
npm install --legacy-peer-deps
npm run typecheck
npm run build
```

The Vercel error reported from `lib/db.ts -> lib/auth.ts -> auth.ts -> middleware.ts` should no longer occur because that import chain is removed.
