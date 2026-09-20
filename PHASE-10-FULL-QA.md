# Phase 10 — Full QA Recheck

Date: 2026-09-20

## Passed static checks

- Edge runtime boundary: `middleware.ts` and `auth.config.ts` contain no Mongoose/MongoDB/bcrypt/server-service imports.
- Client/server boundary: no `use client` module imports the protected server modules checked by the static QA script.
- Clean TypeScript domain structure: `types/domain/*` contracts exist and legacy `types/domain.ts` has been removed.
- Core directories verified: app, components, hooks, lib, models, services, types, tests.
- Route audit: 40 routes discovered; no obvious broken internal links found.
- Structure audit: 9 core directories and 8 domain type contracts verified.
- Temporary `.tmp`, `.bak`, and editor backup files: none found.
- Voice stock response was corrected to read the post-transaction product quantity from the transaction session rather than relying on a stale document snapshot.
- `OPENROUTER_MODEL` was added to environment validation to match the provider implementation.

## Important runtime verification

A full dependency install/build could not be completed in this environment because `npm install --legacy-peer-deps` timed out. Therefore this report does **not** claim a successful production build here.

Run locally/CI:

```bash
npm install --legacy-peer-deps
npm run typecheck
npm run qa:routes
npm run qa:structure
node scripts/qa-static.mjs
npm test
npm run build
```

## Vercel-specific prevention

The previous Edge Runtime failure was caused by the dependency chain:

`middleware -> auth.ts -> lib/auth.ts -> lib/db.ts -> mongoose`

The current chain is:

`middleware -> auth.config.ts`

while Node-only authentication/database logic remains in `auth.ts`/`lib/auth.ts` and is not imported by middleware.
