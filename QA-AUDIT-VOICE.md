# TaliKhata Voice — Voice & Accounting QA Audit

## Fixed in this audit
- Added Bengali digit and whitespace normalization helpers.
- Improved tenant-scoped party/product resolution and safe regex handling.
- Added optional structured multi-item sale payloads and paid amount to voice validation.
- Added semantic validation for sales and payment amounts.
- Fixed TypeScript transaction type to include SALE.
- Fixed initial-stock transaction amount to be quantity × buy price.
- Added customer due creation for unpaid voice sales.
- Added sale total reconciliation against a spoken total.
- Added server-side JSON validation for voice execution requests.
- Added unique `(userId,name)` indexes for parties and products to reduce duplicate races.
- Added voice/accounting regression tests.

## Important production checks still required
1. Run `npm install --legacy-peer-deps`.
2. Run `npm run typecheck`.
3. Run `npm run test` and `npm run test:voice`.
4. Run `npm run build`.
5. Test against a MongoDB Atlas staging database with replica-set transactions enabled.
6. Test real Bengali/Banglish speech on Chrome Android and Capacitor Android.
7. Verify Google OAuth callback URLs and credentials.
8. Verify OpenAI structured output with the configured model.
9. Add Playwright end-to-end tests for login, sale, purchase, payment, reversal, and voice confirmation.
10. For multi-instance production, use a shared rate limiter (Redis/Upstash), not process memory.
11. Add idempotency keys for mobile retries before handling financial commands in production.

## Accounting semantics test cases
- “রহিমের ৫০০ টাকা বাকি” => DUE_GIVEN, +500 receivable.
- “রহিম ৫০০ টাকা বাকি দিয়েছে” => DUE_RECEIVED, -500 receivable.
- “রহিম ৫০০ টাকা জমা দিয়েছে” => DUE_RECEIVED, -500 receivable.
- “রহিমকে ৫০০ টাকা দিলাম” => DUE_GIVEN, +500 receivable (confirm if phrasing is ambiguous in the selected locale).
- “রহিমের কাছ থেকে ৫০০ টাকা নিলাম” => DUE_RECEIVED, -500 receivable.
- “রহিম ২ কেজি চাল নিল, ২০০ টাকা দিল” => SALE with paid amount; remaining due only if calculated total exceeds 200.
- Two parties/products with the same name => no automatic commit; require disambiguation.
