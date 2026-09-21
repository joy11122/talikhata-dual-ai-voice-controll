
'use client';

import { signIn } from 'next-auth/react';
import { Chrome } from 'lucide-react';

export default function GoogleButton() {
  if (
    typeof window !== 'undefined' &&
    document.body.dataset.google === 'disabled'
  ) {
    return null;
  }

  async function handleGoogleSignIn() {
    await signIn('google', {
      callbackUrl: '/auth/redirect',
    });
  }

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      className="flex w-full items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed"
    >
      <Chrome size={18} />

      <span>Continue with Google</span>
    </button>
  );
}
