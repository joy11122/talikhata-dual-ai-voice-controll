'use client';

import { useState } from 'react';
import {
  signIn,
  getSession,
} from 'next-auth/react';
import { useRouter } from 'next/navigation';

import {
  SignInSchema,
  SignUpSchema,
} from '@/lib/validations/auth';

type CredentialsFormProps = {
  mode: 'signin' | 'signup';
};

/**
 * Redirect authenticated users according to their role.
 */
async function redirectAfterLogin(
  router: ReturnType<typeof useRouter>,
) {
  const session = await getSession();

  if (session?.user?.role === 'ADMIN') {
    router.push('/admin');
  } else {
    router.push('/dashboard');
  }

  router.refresh();
}

export function CredentialsForm({
  mode,
}: CredentialsFormProps) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const router = useRouter();

  async function submit(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    setError('');
    setBusy(true);

    try {
      const formData = new FormData(
        e.currentTarget,
      );

      const input = {
        ...(mode === 'signup'
          ? {
              name: String(
                formData.get('name') || '',
              ),
            }
          : {}),

        email: String(
          formData.get('email') || '',
        ),

        password: String(
          formData.get('password') || '',
        ),
      };

      const parsed =
        mode === 'signup'
          ? SignUpSchema.safeParse(input)
          : SignInSchema.safeParse(input);

      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ||
            'Please check the form.',
        );

        return;
      }

      /**
       * SIGN UP
       */
      if (mode === 'signup') {
        const response = await fetch(
          '/api/register',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify(
              parsed.data,
            ),
          },
        );

        const data =
          await response.json();

        if (!response.ok || !data.ok) {
          setError(
            typeof data.error === 'string'
              ? data.error
              : 'Registration failed.',
          );

          return;
        }

        /**
         * Automatically sign in after
         * successful registration.
         */
        const result = await signIn(
          'credentials',
          {
            email: parsed.data.email,
            password:
              parsed.data.password,
            redirect: false,
          },
        );

        if (result?.error) {
          setError(
            'Account created successfully. Please sign in.',
          );

          router.push('/signin');

          return;
        }

        /**
         * Credentials login succeeded.
         *
         * ADMIN → /admin
         * USER  → /dashboard
         */
        await redirectAfterLogin(router);

        return;
      }

      /**
       * SIGN IN
       */
      const result = await signIn(
        'credentials',
        {
          email: parsed.data.email,
          password: parsed.data.password,
          redirect: false,
        },
      );

      if (result?.error) {
        setError(
          'Invalid email or password.',
        );

        return;
      }

      /**
       * Login succeeded.
       *
       * ADMIN → /admin
       * USER  → /dashboard
       */
      await redirectAfterLogin(router);
    } catch (error) {
      console.error(
        'Credentials authentication error:',
        error,
      );

      setError(
        'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={submit}
    >
      {mode === 'signup' && (
        <div>
          <label className="form-label">
            Shop owner name
          </label>

          <input
            name="name"
            type="text"
            placeholder="Shop owner name"
            className="field"
            autoComplete="name"
            required
          />
        </div>
      )}

      <div>
        <label className="form-label">
          Email address
        </label>

        <input
          name="email"
          type="email"
          placeholder="Email"
          className="field"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label className="form-label">
          Password
        </label>

        <input
          name="password"
          type="password"
          placeholder={
            mode === 'signup'
              ? '8+ chars, uppercase and special character'
              : 'Password'
          }
          className="field"
          autoComplete={
            mode === 'signup'
              ? 'new-password'
              : 'current-password'
          }
          required
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy
          ? 'Please wait…'
          : mode === 'signup'
            ? 'Create account'
            : 'Sign in'}
      </button>
    </form>
  );
}