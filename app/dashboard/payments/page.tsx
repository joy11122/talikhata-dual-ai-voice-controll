
'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  ChangeEvent,
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

type Party = {
  _id: string;
  name: string;
  partyType?: string;
};

type Payment = {
  _id: string;
  partyId?: {
    _id: string;
    name: string;
  };
  amount: number;
  type: string;
  timestamp: string;
};

type PaymentForm = {
  partyId: string;
  amount: string;
  direction: 'COLLECT' | 'PAY';
  notes: string;
};

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  name?: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children?: ReactNode;
};

const Field = ({ name, ...props }: FieldProps) => (
  <input
    {...props}
    name={name}
    className="field"
  />
);

const Select = ({
  children,
  ...props
}: SelectProps) => (
  <select
    {...props}
    className="field"
  >
    {children}
  </select>
);

export default function Page() {
  const [parties, setParties] = useState<Party[]>([]);
  const [rows, setRows] = useState<Payment[]>([]);

  const [form, setForm] = useState<PaymentForm>({
    partyId: '',
    amount: '',
    direction: 'COLLECT',
    notes: '',
  });

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/payments', {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to load payments.'
        );
      }

      setRows(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(
        'Failed to load payments:',
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load payments.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadParties = useCallback(async () => {
    try {
      const response = await fetch(
        '/api/parties',
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to load parties.'
        );
      }

      setParties(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(
        'Failed to load parties:',
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load parties.'
      );
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      loadParties(),
      load(),
    ]);
  }, [loadParties, load]);

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSelectChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        name === 'direction'
          ? (value as 'COLLECT' | 'PAY')
          : value,
    }));
  }

  async function reverse(id: string) {
    const confirmed = window.confirm(
      'Reverse this payment? The party balance will be restored.'
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const response = await fetch(
        `/api/transactions?id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Could not reverse payment.'
        );
      }

      setMessage(
        'Payment reversed successfully.'
      );

      await load();

      window.dispatchEvent(
        new Event('talikhata:refresh')
      );
    } catch (error) {
      console.error(
        'Failed to reverse payment:',
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not reverse payment. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function save(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage('');

    if (!form.partyId) {
      setMessage('Please select a party.');
      return;
    }

    if (!form.amount) {
      setMessage(
        'Please enter a payment amount.'
      );
      return;
    }

    const amount = Number(form.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setMessage(
        'Payment amount must be greater than zero.'
      );
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        '/api/payments',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            ...form,
            amount,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Failed to record payment.'
        );
      }

      setMessage(
        'Payment recorded successfully.'
      );

      setForm((current) => ({
        ...current,
        amount: '',
        notes: '',
      }));

      await load();

      window.dispatchEvent(
        new Event('talikhata:refresh')
      );
    } catch (error) {
      console.error(
        'Failed to record payment:',
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : 'Network error. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold">
        পেমেন্ট
      </h1>

      <form
        onSubmit={save}
        className="mt-6 grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-4"
      >
        <div>
          <label
            htmlFor="partyId"
            className="form-label"
          >
            Party
          </label>

          <Select
            id="partyId"
            name="partyId"
            value={form.partyId}
            onChange={handleSelectChange}
            required
          >
            <option value="">
              Select party
            </option>

            {parties.map((party) => (
              <option
                key={party._id}
                value={party._id}
              >
                {party.name}
                {party.partyType
                  ? ` • ${party.partyType}`
                  : ''}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label
            htmlFor="direction"
            className="form-label"
          >
            Payment direction
          </label>

          <Select
            id="direction"
            name="direction"
            value={form.direction}
            onChange={handleSelectChange}
          >
            <option value="COLLECT">
              Customer collection
            </option>

            <option value="PAY">
              Supplier payment
            </option>
          </Select>
        </div>

        <div>
          <label
            htmlFor="amount"
            className="form-label"
          >
            Amount (৳)
          </label>

          <Field
            id="amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={handleInputChange}
            placeholder="0.00"
            required
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="btn-primary w-full"
          >
            {busy ? (
              <span
                className="spinner"
                aria-hidden="true"
              />
            ) : null}

            {busy
              ? 'Saving…'
              : 'Record payment'}
          </button>
        </div>

        <div className="md:col-span-4">
          <label
            htmlFor="notes"
            className="form-label"
          >
            Notes (optional)
          </label>

          <Field
            id="notes"
            name="notes"
            value={form.notes}
            onChange={handleInputChange}
            placeholder="Add payment notes..."
          />
        </div>

        {message && (
          <p
            className="md:col-span-4 rounded-lg border p-3 text-sm"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        )}
      </form>

      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="font-semibold">
          Recent payments
        </h2>

        {loading ? (
          <p className="py-8 text-center text-slate-400">
            Loading payments…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-slate-400">
            No payments yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {rows.map((payment) => (
              <div
                key={payment._id}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0"
              >
                <div>
                  <p className="font-medium">
                    {payment.partyId?.name ||
                      'Party'}{' '}
                    • ৳
                    {Number(
                      payment.amount || 0
                    ).toLocaleString('en-BD')}
                  </p>

                  <p className="text-sm text-slate-500">
                    {payment.type ===
                    'DUE_RECEIVED'
                      ? 'Customer collection'
                      : 'Supplier payment'}{' '}
                    •{' '}
                    {new Date(
                      payment.timestamp
                    ).toLocaleString('en-BD')}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void reverse(payment._id)
                  }
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  Reverse
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
