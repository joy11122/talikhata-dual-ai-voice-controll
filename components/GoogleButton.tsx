
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
      className="tk-control w-full disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Chrome size={18} className="text-white/80" />

      <span>Continue with Google</span>
    </button>
  );
}
