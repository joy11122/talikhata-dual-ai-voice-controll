import Link from 'next/link';

import { CredentialsForm } from '@/components/AuthForms';
import GoogleButton from '@/components/GoogleButton';

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <div className="w-full max-w-md rounded-2xl border border-black/[.07] bg-white/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,.08)]">
        <h1 className="text-[30px] font-semibold tracking-[-.035em]">
          Sign in
        </h1>

        <p className="mt-2 text-slate-500">
          Access your TaliKhata shop.
        </p>

        <div className="mt-6">
          <GoogleButton />
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />

          OR

          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <CredentialsForm mode="signin" />

        <p className="mt-5 text-center text-sm text-slate-500">
          New here?{' '}
          <Link
            className="font-semibold text-emerald-700"
            href="/signup"
          >
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}