
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

type ClosingForm = {
  date: string;
  openingCash: string;
  adjustment: string;
  notes: string;
};

type ClosingRecord = {
  _id: string;
  date: string;
  closingCash: number;
  openingCash?: number;
  adjustment?: number;
  notes?: string;
};

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  name?: string;
};

const Field = ({ name, ...props }: FieldProps) => (
  <input {...props} name={name} className="field" />
);

export default function Page() {
  const [form, setForm] = useState<ClosingForm>({
    date: new Date().toISOString().slice(0, 10),
    openingCash: '',
    adjustment: '',
    notes: '',
  });

  const [closings, setClosings] = useState<ClosingRecord[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/closing', {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load closing records.');
      }

      setClosings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load closing records:', error);

      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load closing records.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage('');

    if (!form.date) {
      setMessage('Please select a closing date.');
      return;
    }

    if (form.openingCash === '') {
      setMessage('Please enter the opening cash amount.');
      return;
    }

    const openingCash = Number(form.openingCash);
    const adjustment =
      form.adjustment === '' ? 0 : Number(form.adjustment);

    if (!Number.isFinite(openingCash)) {
      setMessage('Opening cash must be a valid number.');
      return;
    }

    if (!Number.isFinite(adjustment)) {
      setMessage('Adjustment must be a valid number.');
      return;
    }

    setBusy(true);

    try {
      const response = await fetch('/api/closing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: form.date,
          openingCash,
          adjustment,
          notes: form.notes.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to close the day.'
        );
      }

      const closingCash = data?.result?.closingCash;

      setMessage(
        typeof closingCash === 'number'
          ? `Closing cash: ৳${closingCash}`
          : 'Day closed successfully.'
      );

      await load();
    } catch (error) {
      console.error('Failed to close day:', error);

      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong while closing the day.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold">দিন শেষ</h1>

      <form
        onSubmit={save}
        className="mt-6 grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-4"
      >
        <div>
          <label htmlFor="closing-date" className="form-label">
            Closing date
          </label>

          <Field
            id="closing-date"
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="opening-cash" className="form-label">
            Opening cash (৳)
          </label>

          <Field
            id="opening-cash"
            name="openingCash"
            type="number"
            min="0"
            step="0.01"
            value={form.openingCash}
            onChange={handleChange}
            placeholder="0"
            required
          />
        </div>

        <div>
          <label htmlFor="adjustment" className="form-label">
            Adjustment (৳)
          </label>

          <Field
            id="adjustment"
            name="adjustment"
            type="number"
            step="0.01"
            value={form.adjustment}
            onChange={handleChange}
            placeholder="0"
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
              <span className="spinner" aria-hidden="true" />
            ) : null}

            {busy ? 'Saving…' : 'Close day'}
          </button>
        </div>

        <div className="md:col-span-4">
          <label htmlFor="closing-notes" className="form-label">
            Notes (optional)
          </label>

          <Field
            id="closing-notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="Add notes about today's closing..."
          />
        </div>

        {message && (
          <p
            className="md:col-span-4 rounded-lg border p-3"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        )}
      </form>

      <div className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="text-xl font-semibold">
          Closing history
        </h2>

        {loading ? (
          <p className="py-6 text-gray-500">
            Loading closing records…
          </p>
        ) : closings.length === 0 ? (
          <p className="py-6 text-gray-500">
            No closing records found.
          </p>
        ) : (
          <div className="mt-4">
            {closings.map((closing) => (
              <div
                key={closing._id}
                className="border-b py-3 last:border-b-0"
              >
                <div className="flex flex-col justify-between gap-1 sm:flex-row">
                  <span className="font-medium">
                    {closing.date}
                  </span>

                  <span className="font-semibold">
                    Closing ৳{closing.closingCash}
                  </span>
                </div>

                {closing.notes ? (
                  <p className="mt-1 text-sm text-gray-500">
                    {closing.notes}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
