# Phase 6 — Play Store + SEO readiness

## Web SEO implemented
- Next.js Metadata API with canonical URL, title templates and descriptions.
- Bengali/Banglish/English keyword coverage without keyword stuffing.
- `robots.txt`, `sitemap.xml`, and PWA manifest via Next.js route handlers.
- SoftwareApplication JSON-LD on the public homepage.
- Public Privacy Policy and Terms pages.
- Authenticated dashboard marked `noindex` so private business records are not indexed.
- Open Graph/Twitter metadata.

Google recommends descriptive titles/meta descriptions and supports structured data to help it understand site content. Structured data does not guarantee a rich result.

## Before launch
Set `NEXT_PUBLIC_APP_URL` to the real HTTPS production domain. Replace placeholder support/contact text in Privacy Policy and Terms.

## Play Store
As of August 31, 2026, new Google Play apps and app updates must target Android 16 (API 36) or higher. This repository uses Capacitor 7; create/sync the Android platform on the build machine after installing dependencies and set the Android target/compile SDK to 36.

For new personal developer accounts created after November 13, 2023, Google requires a closed test with at least 12 testers opted in continuously for 14 days before production access.

## Required release gates
1. `npm install --legacy-peer-deps`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. Deploy the Next.js server over HTTPS.
6. Set `CAP_SERVER_URL` to the production URL.
7. `npx cap add android` (once) and `npx cap sync android`.
8. Verify Android compile/target SDK 36.
9. Build a signed `.aab` in Android Studio/Gradle.
10. Run internal/closed testing and complete Play Console declarations.
