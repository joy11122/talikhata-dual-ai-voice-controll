# Phase 7 — Production & Capacitor Readiness

Final pre-deploy commands:

```bash
npm install --legacy-peer-deps
npm run typecheck
npm run qa:routes
npm test
npm run build
```

Vercel:
- Set `MONGODB_URI`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Set `ADMIN_EMAILS`.
- Set at least one of `OPENAI_API_KEY` or `OPENROUTER_API_KEY`.
- Configure Google OAuth callback for the deployed origin.
- Ensure MongoDB Atlas allows the deployment runtime to connect.

Capacitor:
- `npm run cap:sync`
- Open Android Studio and test on a physical device.
- Configure HTTPS API origin, microphone permission, app ID, icon, splash, back navigation, and signed AAB before Play Store submission.
