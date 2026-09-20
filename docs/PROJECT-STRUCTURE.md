# TaliKhata Project Structure

## Principles

- `app/` — Next.js routes, pages, layouts, route handlers and server actions only.
- `components/` — reusable UI components; no database access.
- `services/` — business workflows and domain operations.
- `models/` — Mongoose schemas/models only.
- `types/` — shared TypeScript contracts; one domain concept per file where practical.
- `lib/` — infrastructure, validation, auth, AI, database and reusable utilities.
- `hooks/` — client React hooks.
- `config/` — application configuration/constants that are safe to import by the relevant runtime.
- `tests/` — unit/integration/e2e tests.
- `public/` — static assets.

## TypeScript organization

```text
types/
├── api.ts
├── auth.ts
├── shop.ts
├── voice.ts
├── next-auth.d.ts
└── domain/
    ├── index.ts
    ├── error.ts
    ├── party.ts
    ├── product.ts
    └── transaction.ts
```

Do not create large `types.ts` catch-all files. New shared contracts should live beside their domain concept.

## Runtime boundaries

`middleware.ts` is Edge Runtime code. It must never import `auth.ts`, Mongoose, MongoDB, bcrypt, or any other Node-only database dependency. Use `auth.config.ts` for Edge-safe Auth.js configuration.

## Import rules

- Prefer `import type` for types.
- UI components must call services/API boundaries rather than importing Mongoose models directly.
- Keep database access in server-only modules.
- Keep secrets and server credentials out of client components.
- Every tenant-scoped query must use the authenticated user's ID.
