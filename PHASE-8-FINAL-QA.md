# Phase 8 — Final QA Gate

Completed static audits:
- Internal route/link audit passes with `npm run qa:routes`.
- Fixed the route-group authentication URL mismatch: `/signin` and `/signup` are the real public URLs for the `(auth)` route group.
- Fixed settings page missing `busy` state.
- Removed duplicate form `aria-label` attributes.
- Added dedicated domain TypeScript types.
- Added centralized client API error helper and safe server error primitives.
- Added global toast and reusable confirmation dialog.
- Added validation regression tests.
- Added conservative protection against reversing a stock-in after later inventory movements.

Runtime verification still requires dependency installation and real environment credentials.
