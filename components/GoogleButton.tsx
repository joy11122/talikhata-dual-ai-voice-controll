
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
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent px-4 py-3 font-medium text-white/90 shadow-sm transition hover:bg-white/[0.06] hover:border-white/15 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Chrome size={18} className="text-white/80" />

      <span>Continue with Google</span>
    </button>
  );
}
