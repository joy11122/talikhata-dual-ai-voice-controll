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
  const [deleteTarget, setDeleteTarget] = useState<Party | null>(null);
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
    setDeleteTarget(party);
    showToast('error', `“${party.name}” মুছে ফেলার আগে নিশ্চিত করুন`);
  }

  async function confirmDelete() {
    const party = deleteTarget;
    if (!party) return;

    setDeleteTarget(null);
    setBusy(true);
    setError('');

    try {
      const response = await fetch(`/api/parties/${party._id}`, {
        method: 'DELETE',
        cache: 'no-store',
      });

      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(data?.error || 'কাস্টমার মুছে ফেলা যায়নি');
      }

      setRows((current) => current.filter((row) => row._id !== party._id));

      if (editing === party._id) {
        setEditing(null);
        setForm(emptyForm);
      }

      showToast('success', `${party.name} সফলভাবে মুছে ফেলা হয়েছে`);
      window.dispatchEvent(new Event('talikhata:refresh'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'কাস্টমার মুছে ফেলা যায়নি';
      setError(message);
      showToast('error', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {deleteTarget && (
        <div className="fixed inset-x-4 bottom-5 z-[10000] mx-auto max-w-md sm:right-6 sm:left-auto sm:inset-x-auto">
          <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"><Trash2 size={18} /></div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">কাস্টমার মুছে ফেলবেন?</p>
                <p className="mt-1 text-sm text-slate-500">“{deleteTarget.name}” স্থায়ীভাবে মুছে যাবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setDeleteTarget(null)} disabled={busy} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">বাতিল</button>
                  <button type="button" onClick={() => void confirmDelete()} disabled={busy} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{busy ? 'মুছে ফেলা হচ্ছে…' : 'মুছে ফেলুন'}</button>
                </div>
              </div>
              <button type="button" aria-label="Close delete notification" onClick={() => setDeleteTarget(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-[3px]" role="alertdialog" aria-modal="true" aria-labelledby="party-error-title">
          <div className="w-full max-w-sm rounded-[24px] border border-white/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertCircle size={22} /></div>
              <div className="min-w-0 flex-1">
                <h2 id="party-error-title" className="text-base font-bold text-slate-900">কাজটি সম্পন্ন করা যায়নি</h2>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{error}</p>
              </div>
              <button type="button" aria-label="Close error" onClick={() => setError('')} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
            </div>
            <button type="button" onClick={() => setError('')} className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">ঠিক আছে</button>
          </div>
        </div>
      )}

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
          className="rounded-[24px] border border-black/[0.07] bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)] sm:p-6"
        >
          <div className="flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Users size={18} />
            </span>
            <span>{editing ? 'Edit party' : 'Add party'}</span>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="form-label">নাম</label>
              <input
                className="field"
                aria-label="নাম"
                placeholder="যেমন: রহিম"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
              />
            </div>

            <div>
              <label className="form-label">ফোন</label>
              <div className="relative mt-1.5">
                <Phone
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={17}
                />
                <input
                  className="field pl-12"
                  aria-label="ফোন"
                  placeholder="01XXXXXXXXX"
                  inputMode="tel"
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

            <div>
              <label className="form-label">ধরন</label>
              <select
                className="field mt-1.5"
                aria-label="Party type"
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
            </div>
          </div>

          <div className="mt-6 flex gap-2">
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
