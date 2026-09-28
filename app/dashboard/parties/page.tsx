'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';

type PartyType = 'CUSTOMER' | 'SUPPLIER';
type ToastType = 'success' | 'error';

type Party = {
  _id: string;
  name: string;
  phone?: string | null;
  partyType: PartyType;
  currentBalance?: number;
};

type Toast = {
  type: ToastType;
  message: string;
};

const emptyForm = {
  name: '',
  phone: '',
  partyType: 'CUSTOMER' as PartyType,
};

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export default function PartiesPage() {
  const [rows, setRows] = useState<Party[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/parties${q ? `?q=${encodeURIComponent(q)}` : ''}`,
        { cache: 'no-store' },
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Could not load parties');
      }

      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not load parties';
      setError(message);
      showToast('error', message);
    } finally {
      setLoading(false);
    }
  }, [q, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener('talikhata:refresh', handler);
    return () => window.removeEventListener('talikhata:refresh', handler);
  }, [load]);

  const totals = useMemo(
    () => ({
      receive: rows
        .filter((row) => Number(row.currentBalance || 0) > 0)
        .reduce((sum, row) => sum + Number(row.currentBalance || 0), 0),
      pay: rows
        .filter((row) => Number(row.currentBalance || 0) < 0)
        .reduce(
          (sum, row) => sum + Math.abs(Number(row.currentBalance || 0)),
          0,
        ),
    }),
    [rows],
  );

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const url = editing ? `/api/parties/${editing}` : '/api/parties';
      const response = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          phone: form.phone.trim() || null,
        }),
      });

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Could not save party');
      }

      const name = form.name.trim();
      const wasEditing = Boolean(editing);

      setForm(emptyForm);
      setEditing(null);
      await load();

      showToast(
        'success',
        wasEditing
          ? `${name} successfully updated`
          : `${name} successfully added`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not save party';
      setError(message);
      showToast('error', message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    const party = rows.find((row) => row._id === id);
    if (!party) return;

    if (!window.confirm(`Delete "${party.name}"? This cannot be undone.`)) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await fetch(`/api/parties/${id}`, {
        method: 'DELETE',
        cache: 'no-store',
      });

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.error || 'কাস্টমার মুছে ফেলা যায়নি',
        );
      }

      setRows((current) => current.filter((row) => row._id !== id));

      if (editing === id) {
        setEditing(null);
        setForm(emptyForm);
      }

      showToast(
        'success',
        `${party.name} সফলভাবে মুছে ফেলা হয়েছে`,
      );

      window.dispatchEvent(new Event('talikhata:refresh'));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'কাস্টমার মুছে ফেলা যায়নি';
      setError(message);
      showToast('error', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {toast && (
        <div
          className="fixed right-4 top-4 z-[9999] w-[calc(100%-2rem)] max-w-[390px] sm:right-6 sm:top-6"
          role="status"
          aria-live="polite"
        >
          <div
            className={[
              'flex items-start gap-3 rounded-2xl border bg-white px-4 py-3.5',
              'shadow-[0_18px_50px_rgba(15,23,42,0.16)]',
              'backdrop-blur-xl',
              toast.type === 'success'
                ? 'border-emerald-200'
                : 'border-red-200',
            ].join(' ')}
          >
            <div
              className={[
                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                toast.type === 'success'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-red-100 text-red-600',
              ].join(' ')}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 size={19} />
              ) : (
                <AlertCircle size={19} />
              )}
            </div>

            <p className="min-w-0 flex-1 pt-1 text-sm font-semibold leading-5 text-slate-800">
              {toast.message}
            </p>

            <button
              type="button"
              aria-label="Close notification"
              onClick={() => setToast(null)}
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Ledger</p>
          <h1 className="text-3xl font-bold">বাকির খাতা</h1>
          <p className="mt-2 text-slate-500">
            Customers, suppliers and their running balances.
          </p>
        </div>

        <div className="flex gap-3 text-sm">
          <span className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
            পাবো ৳{totals.receive.toLocaleString()}
          </span>
          <span className="rounded-xl bg-red-50 px-3 py-2 text-red-700">
            দেবো ৳{totals.pay.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
        <form
          onSubmit={save}
          className="rounded-xl border bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Users size={18} />
            {editing ? 'Edit party' : 'Add party'}
          </div>

          <label className="form-label mt-4">নাম / Name</label>
          <input
            className="field"
            aria-label="নাম / Name"
            placeholder="নাম / Name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            required
          />

          <div className="mt-3">
            <label className="form-label">Phone</label>
            <div className="relative mt-1.5">
              <Phone
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                className="field pl-10"
                aria-label="Phone"
                placeholder="Phone"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <label className="form-label mt-3">Party type</label>
          <select
            className="field"
            value={form.partyType}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                partyType: event.target.value as PartyType,
              }))
            }
          >
            <option value="CUSTOMER">Customer</option>
            <option value="SUPPLIER">Supplier</option>
          </select>

          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="btn-primary flex-1"
            >
              {busy ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <Plus size={17} />
              )}
              {editing ? 'Update' : 'Add'}
            </button>

            {editing && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyForm);
                  setError('');
                }}
                disabled={busy}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">
              Your parties ({rows.length})
            </h2>

            <div className="relative w-full sm:w-64">
              <Search
                className="absolute left-3 top-3 text-slate-400"
                size={16}
                aria-hidden="true"
              />
              <input
                className="field pl-9"
                placeholder="Search"
                aria-label="Search parties"
                value={q}
                onChange={(event) => setQ(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {loading ? (
              <div className="space-y-2">
                <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={row._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                >
                  <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-sm text-slate-500">
                      {row.partyType === 'CUSTOMER'
                        ? 'Customer'
                        : 'Supplier'}
                      {row.phone && ` • ${row.phone}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={
                        Number(row.currentBalance || 0) >= 0
                          ? 'font-semibold text-emerald-700'
                          : 'font-semibold text-red-600'
                      }
                    >
                      ৳{Number(row.currentBalance || 0).toLocaleString()}
                    </span>

                    <button
                      type="button"
                      aria-label={`Edit ${row.name}`}
                      className="text-slate-500 hover:text-emerald-700"
                      onClick={() => {
                        setEditing(row._id);
                        setForm({
                          name: row.name,
                          phone: row.phone || '',
                          partyType: row.partyType,
                        });
                        setError('');
                      }}
                      disabled={busy}
                    >
                      <Pencil size={17} />
                    </button>

                    <button
                      type="button"
                      aria-label={`Delete ${row.name}`}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50"
                      onClick={() => void del(row._id)}
                      disabled={busy}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))
            )}

            {!loading && !rows.length && (
              <p className="py-12 text-center text-slate-400">
                No parties found.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
