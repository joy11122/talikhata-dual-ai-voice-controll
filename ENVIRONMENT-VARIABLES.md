# Environment Variables

Required for production:

```env
MONGODB_URI=
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ADMIN_EMAILS=admin@example.com
```

At least one AI provider:

```env
OPENAI_API_KEY=
OPENROUTER_API_KEY=
```

Recommended public URL:

```env
NEXT_PUBLIC_APP_URL=https://your-domain.example
```

Never expose secret keys with `NEXT_PUBLIC_`.
