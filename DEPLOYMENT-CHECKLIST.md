# TaliKhata Deployment Gate

## Must pass before Vercel production
- `npm install --legacy-peer-deps` completes locally
- `npm run typecheck` passes
- `npm run test` passes
- `npm run build` passes
- MongoDB Atlas production database/user configured
- MongoDB Atlas network access configured for the deployment environment
- `AUTH_SECRET` is a new production secret (32+ chars)
- `NEXT_PUBLIC_APP_URL` is the final HTTPS production URL
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` configured if Google login is enabled
- Google OAuth redirect URI is `https://YOUR_DOMAIN/api/auth/callback/google`
- `OPENAI_API_KEY` configured if voice parsing is enabled
- No secrets committed to Git
- Privacy Policy and Terms are publicly reachable
- `/robots.txt` and `/sitemap.xml` return 200
- Dashboard/API routes remain authenticated and are not indexed

## Vercel
Use the Next.js preset. Build command can remain `next build`. Add production environment variables in Project Settings > Environment Variables and redeploy after changing them.

## Capacitor
The native shell uses `CAP_SERVER_URL` to load the deployed HTTPS app. Do not put MongoDB/OpenAI/Auth secrets into the mobile bundle. After deploying the web app, run `npx cap sync android`, set Android target/compile SDK to 36, then build a signed AAB.

## Google OAuth
For production, configure the exact callback URI shown above in Google Cloud Console. Do not leave localhost as the only authorized redirect URI.

## Final smoke test
1. Sign up with credentials.
2. Sign in.
3. Google sign-in.
4. Create customer/product.
5. Record sale and verify stock + due.
6. Record purchase and verify stock + supplier payable.
7. Collect customer payment.
8. Pay supplier.
9. Run daily closing.
10. Open reports.
11. Run a Bengali voice command.
12. Verify another account cannot access the first account's records.
