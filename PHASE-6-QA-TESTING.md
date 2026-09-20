# Phase 6 — Automated QA & Connectivity

Added:
- `npm run qa:routes` for internal route/link discovery.
- `npm run qa:static` for typecheck + route audit.
- Validation regression tests in `tests/unit/validation.test.ts`.
- Existing voice tests remain in the suite.

Manual verification still required after dependency installation:
- Google OAuth with production callback URLs.
- MongoDB Atlas connection and transaction behavior.
- OpenAI/OpenRouter real provider calls.
- Microphone permissions and speech recognition on target Android devices.
- Capacitor native build/signing.
