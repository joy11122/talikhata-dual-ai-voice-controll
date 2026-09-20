# TaliKhata Voice — Complete

A production-oriented Bengali/Banglish/English voice-first ledger, inventory and cash-flow application for micro-merchants.

## Stack
- Next.js 14 App Router + TypeScript
- MongoDB Atlas + Mongoose 8
- Auth.js v5: Google OAuth (when configured) + Credentials
- bcryptjs cost 12
- Zod 3 runtime validation
- Tailwind CSS, Lucide, Framer Motion
- Web Speech API + OpenAI structured intent parsing + Bengali TTS

## Core functionality
- Customer/supplier CRUD with running balances
- Product CRUD, pricing, quantity and low-stock alerts
- Sales, expenses, due given/received, stock in/out
- Transaction history with safe reversal on delete
- Dashboard KPIs and recent activity
- Shop settings
- Voice: read balance, list inventory, add/update stock, create products, create parties, record dues/expenses/sales, delete latest matching entry
- Bengali, Banglish and English command parsing
- Entity disambiguation and tenant-scoped text/regex matching
- High-value/deletion server-side confirmation
- Atomic MongoDB transactions for business mutations + audit logging

## Setup (Windows PowerShell)
```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```
If npm reports the OpenAI/Zod peer dependency conflict, the package versions in this project are aligned to Zod 3.25.76. If an old lockfile is present, remove `node_modules` and `package-lock.json`, then run `npm install` again. As a fallback, `npm install --legacy-peer-deps` is acceptable.

## Environment
```env
MONGODB_URI=mongodb+srv://...
AUTH_SECRET=at-least-32-random-characters
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OPENAI_API_KEY=...
OPENAI_VOICE_MODEL=gpt-4.1-mini
NEXT_PUBLIC_APP_URL=https://your-domain.com
```
Google and OpenAI are optional for a credentials-only UI test, but Google login and AI voice parsing require their respective credentials.

## Google OAuth callback
Local: `http://localhost:3000/api/auth/callback/google`

## MongoDB
Use an Atlas replica set/sharded cluster because multi-document ACID transactions are required. The application creates its collections automatically through Mongoose. Main business collections: users, shops, parties, products, transactions, auditLogs. Auth.js uses accounts/sessions when applicable.

## Voice examples
- `রহিম ভাইয়ের বাকি ৫০০ টাকা`
- `রহিম ৩০০ টাকা জমা দিয়েছে`
- `১০ কেজি চাল স্টক যোগ করো দাম ৬০ টাকা`
- `চাল ২ কেজি বিক্রি করলাম ১৪০ টাকা`
- `নতুন পণ্য চাল যোগ করো, ২০ কেজি, কেনা ৫০, বিক্রি ৬০`
- `নতুন কাস্টমার করিম, ফোন 01700000000`
- `কাস্টমার করিমের কত টাকা বাকি আছে?`
- `শেষ ৫০০ টাকার এন্ট্রি ডিলিট করো`

## Production hardening before public launch
Add a durable confirmation token, rate limiting, email verification/password recovery, CSP/security headers, Sentry, backup/restore procedures, automated unit/integration/E2E tests, and a server-side Whisper upload route if browser SpeechRecognition coverage is insufficient.

## Final QA workflow

```bash
npm install --legacy-peer-deps
npm run typecheck
npm run qa:routes
npm test
npm run build
```

For Android/Capacitor:

```bash
npm run cap:sync
npm run cap:android
```
