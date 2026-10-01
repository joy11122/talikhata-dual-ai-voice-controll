
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  ChangeEvent,
  FormEvent,
} from 'react';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Trash2,
} from 'lucide-react';

type TransactionType =
  | 'DUE_GIVEN'
  | 'DUE_RECEIVED'
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'EXPENSE'
  | 'SALE';

type Party = {
  _id: string;
  name: string;
  partyType?: string;
};

type Product = {
  _id: string;
  name: string;
  stockQuantity?: number;
  unit?: string;
};

type Transaction = {
  _id: string;
  type: TransactionType;
  partyId?: {
    _id: string;
    name: string;
  } | null;
  productId?: {
    _id: string;
    name: string;
  } | null;
  amount?: number;
  quantity?: number;
  unitPrice?: number;
  notes?: string;
  timestamp: string;
};

type TransactionForm = {
  type: TransactionType;
  partyId: string;
  productId: string;
  amount: number;
  quantity: number;
  unitPrice: number;
  notes: string;
};

const labels: Record<
  TransactionType,
  string
> = {
  DUE_GIVEN: 'বাকি দেওয়া',
  DUE_RECEIVED: 'জমা নেওয়া',
  STOCK_IN: 'স্টক যোগ',
  STOCK_OUT: 'স্টক বের',
  EXPENSE: 'খরচ',
  SALE: 'বিক্রি',
};

const emptyForm: TransactionForm = {
  type: 'EXPENSE',
  partyId: '',
  productId: '',
  amount: 0,
  quantity: 0,
  unitPrice: 0,
  notes: '',
};

export default function TransactionsPage() {
  const [rows, setRows] =
    useState<Transaction[]>([]);

  const [parties, setParties] =
    useState<Party[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [form, setForm] =
    useState<TransactionForm>(
      emptyForm
    );

  const [error, setError] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState<Transaction | null>(null);

  const load = useCallback(
    async () => {
      try {
        const response =
          await fetch(
            '/api/transactions?limit=200',
            {
              cache: 'no-store',
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'Could not load transactions.'
          );
        }

        setRows(
          Array.isArray(data)
            ? data
            : data?.transactions || []
        );
      } catch (err) {
        console.error(
          'Transaction load error:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Could not load transactions.'
        );
      }
    },
    []
  );

  const loadFormData =
    useCallback(async () => {
      try {
        const [
          partiesResponse,
          productsResponse,
        ] = await Promise.all([
          fetch('/api/parties', {
            cache: 'no-store',
          }),
          fetch('/api/products', {
            cache: 'no-store',
          }),
        ]);

        const partiesData =
          await partiesResponse.json();

        const productsData =
          await productsResponse.json();

        if (!partiesResponse.ok) {
          throw new Error(
            partiesData?.error ||
              'Could not load parties.'
          );
        }

        if (!productsResponse.ok) {
          throw new Error(
            productsData?.error ||
              'Could not load products.'
          );
        }

        setParties(
          Array.isArray(partiesData)
            ? partiesData
            : partiesData?.parties || []
        );

        setProducts(
          Array.isArray(productsData)
            ? productsData
            : productsData?.products || []
        );
      } catch (err) {
        console.error(
          'Form data load error:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Could not load form data.'
        );
      }
    }, []);

  useEffect(() => {
    async function initialize() {
      await Promise.all([
        load(),
        loadFormData(),
      ]);
    }

    void initialize();
  }, [load, loadFormData]);

  const summary = useMemo(() => {
    return rows.reduce(
      (
        totals,
        transaction
      ) => {
        const amount =
          Number(
            transaction.amount || 0
          );

        if (
          transaction.type ===
          'SALE'
        ) {
          totals.sales += amount;
        }

        if (
          transaction.type ===
          'EXPENSE'
        ) {
          totals.expense += amount;
        }

        if (
          transaction.type ===
          'DUE_GIVEN'
        ) {
          totals.due += amount;
        }

        if (
          transaction.type ===
          'DUE_RECEIVED'
        ) {
          totals.due -= amount;
        }

        return totals;
      },
      {
        sales: 0,
        expense: 0,
        due: 0,
      }
    );
  }, [rows]);

  const needsParty =
    form.type === 'DUE_GIVEN' ||
    form.type === 'DUE_RECEIVED';

  const needsProduct =
    form.type === 'STOCK_IN' ||
    form.type === 'STOCK_OUT' ||
    form.type === 'SALE';

  function handleTypeChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    const type =
      event.target
        .value as TransactionType;

    setForm({
      ...emptyForm,
      type,
    });

    setError('');
  }

  function handlePartyChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    setForm((current) => ({
      ...current,
      partyId:
        event.target.value,
    }));
  }

  function handleProductChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    setForm((current) => ({
      ...current,
      productId:
        event.target.value,
    }));
  }

  function handleAmountChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setForm((current) => ({
      ...current,
      amount:
        Number(event.target.value),
    }));
  }

  function handleQuantityChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setForm((current) => ({
      ...current,
      quantity:
        Number(event.target.value),
    }));
  }

  function handleNotesChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setForm((current) => ({
      ...current,
      notes:
        event.target.value,
    }));
  }

  async function add(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError('');

    if (
      !Number.isFinite(form.amount) ||
      form.amount <= 0
    ) {
      setError(
        'Amount must be greater than zero.'
      );
      return;
    }

    if (
      needsParty &&
      !form.partyId
    ) {
      setError(
        'Please select a party.'
      );
      return;
    }

    if (
      needsProduct &&
      !form.productId
    ) {
      setError(
        'Please select a product.'
      );
      return;
    }

    if (
      needsProduct &&
      (!Number.isFinite(
        form.quantity
      ) ||
        form.quantity <= 0)
    ) {
      setError(
        'Quantity must be greater than zero.'
      );
      return;
    }

    setBusy(true);

    try {
      const body = {
        ...form,
        partyId:
          form.partyId || null,
        productId:
          form.productId || null,
        amount:
          Number(form.amount),
        quantity:
          Number(form.quantity),
        unitPrice:
          form.unitPrice
            ? Number(form.unitPrice)
            : undefined,
        notes:
          form.notes.trim(),
      };

      const response =
        await fetch(
          '/api/transactions',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify(body),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Could not save transaction.'
        );
      }

      setForm({
        ...emptyForm,
      });

      await load();

      const productsResponse =
        await fetch(
          '/api/products',
          {
            cache: 'no-store',
          }
        );

      const productsData =
        await productsResponse.json();

      if (
        productsResponse.ok
      ) {
        setProducts(
          Array.isArray(
            productsData
          )
            ? productsData
            : productsData?.products ||
                []
        );
      }

      window.dispatchEvent(
        new Event(
          'talikhata:refresh'
        )
      );
    } catch (err) {
      console.error(
        'Transaction save error:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not save transaction.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {

    setBusy(true);
    setError('');

    try {
      const response =
        await fetch(
          `/api/transactions?id=${encodeURIComponent(
            id
          )}`,
          {
            method: 'DELETE',
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Could not delete transaction.'
        );
      }

      await load();

      window.dispatchEvent(
        new Event(
          'talikhata:refresh'
        )
      );
    } catch (err) {
      console.error(
        'Transaction delete error:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not delete transaction.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-0">
      <div>
        <p className="text-sm font-semibold text-emerald-300">
          Cash flow
        </p>

        <h1 className="text-3xl font-bold">
          দৈনিক হিসাব
        </h1>

        <p className="mt-2 text-white/50">
          Record sales, expenses, dues and
          stock movements. Deleting a
          transaction safely reverses its
          effect.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="tk-transactions-card rounded-2xl p-5">
          <p className="text-sm text-white/50">
            Sales
          </p>

          <p className="mt-1 text-2xl font-bold text-emerald-300">
            ৳
            {summary.sales.toLocaleString(
              'en-BD'
            )}
          </p>
        </div>

        <div className="tk-transactions-card rounded-2xl p-5">
          <p className="text-sm text-white/50">
            Expenses
          </p>

          <p className="mt-1 text-2xl font-bold text-rose-300">
            ৳
            {summary.expense.toLocaleString(
              'en-BD'
            )}
          </p>
        </div>

        <div className="tk-transactions-card rounded-2xl p-5">
          <p className="text-sm text-white/50">
            Net due movement
          </p>

          <p className="mt-1 text-2xl font-bold">
            ৳
            {summary.due.toLocaleString(
              'en-BD'
            )}
          </p>
        </div>
      </div>

      <form
        onSubmit={add}
        className="tk-transactions-form tk-transactions-surface mt-6 rounded-2xl p-5"
      >
        <div className="flex items-center gap-2 font-semibold">
          <Plus size={18} />
          Quick transaction
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select
            className="field"
            value={form.type}
            onChange={
              handleTypeChange
            }
            aria-label="Transaction type"
          >
            {(
              Object.entries(
                labels
              ) as [
                TransactionType,
                string
              ][]
            ).map(
              ([key, label]) => (
                <option
                  key={key}
                  value={key}
                >
                  {label}
                </option>
              )
            )}
          </select>

          {needsParty ? (
            <select
              className="field"
              value={form.partyId}
              onChange={
                handlePartyChange
              }
              aria-label="Select party"
              required
            >
              <option value="">
                Select party
              </option>

              {parties.map(
                (party) => (
                  <option
                    key={party._id}
                    value={party._id}
                  >
                    {party.name}
                  </option>
                )
              )}
            </select>
          ) : needsProduct ? (
            <select
              className="field"
              value={form.productId}
              onChange={
                handleProductChange
              }
              aria-label="Select product"
              required
            >
              <option value="">
                Select product
              </option>

              {products.map(
                (product) => (
                  <option
                    key={product._id}
                    value={product._id}
                  >
                    {product.name} (
                    {product.stockQuantity ??
                      0}{' '}
                    {product.unit ??
                      ''}
                    )
                  </option>
                )
              )}
            </select>
          ) : (
            <input
              className="field"
              placeholder="Notes / category"
              aria-label="Notes / category"
              value={form.notes}
              onChange={
                handleNotesChange
              }
            />
          )}

          <input
            className="field"
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount ৳"
            aria-label="Amount (৳)"
            value={form.amount}
            onChange={
              handleAmountChange
            }
            required
          />

          {needsProduct && (
            <input
              className="field"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Quantity"
              aria-label="Quantity"
              value={form.quantity}
              onChange={
                handleQuantityChange
              }
              required
            />
          )}

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="btn-primary"
          >
            {busy
              ? 'Saving…'
              : 'Save'}
          </button>
        </div>

        {needsParty && (
          <input
            className="field mt-3"
            placeholder="Notes"
            aria-label="Notes"
            value={form.notes}
            onChange={
              handleNotesChange
            }
          />
        )}

        {needsProduct && (
          <input
            className="field mt-3"
            placeholder="Notes (optional)"
            aria-label="Notes (optional)"
            value={form.notes}
            onChange={
              handleNotesChange
            }
          />
        )}

        {error && (
          <p
            className="mt-3 text-sm text-rose-300"
            role="alert"
          >
            {error}
          </p>
        )}
      </form>

      <div className="tk-transactions-surface mt-6 overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-transparent text-left">
              <tr>
                <th className="p-4">
                  Date
                </th>
                <th className="p-4">
                  Type
                </th>
                <th className="p-4">
                  Party / Product
                </th>
                <th className="p-4">
                  Amount
                </th>
                <th className="p-4">
                  Qty
                </th>
                <th className="p-4">
                  Notes
                </th>
                <th className="p-4">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map(
                (transaction) => {
                  const isIncoming =
                    [
                      'DUE_RECEIVED',
                      'SALE',
                      'STOCK_IN',
                    ].includes(
                      transaction.type
                    );

                  return (
                    <tr
                      key={
                        transaction._id
                      }
                      className="border-t border-white/[0.06]"
                    >
                      <td className="whitespace-nowrap p-4">
                        {new Date(
                          transaction.timestamp
                        ).toLocaleString(
                          'en-BD'
                        )}
                      </td>

                      <td className="p-4">
                        <span className="inline-flex items-center gap-1">
                          {isIncoming ? (
                            <ArrowDownLeft
                              size={14}
                              className="text-emerald-600"
                            />
                          ) : (
                            <ArrowUpRight
                              size={14}
                              className="text-red-500"
                            />
                          )}

                          {labels[
                            transaction.type
                          ] ??
                            transaction.type}
                        </span>
                      </td>

                      <td className="p-4">
                        {transaction
                          .partyId
                          ?.name ||
                          transaction
                            .productId
                            ?.name ||
                          '—'}
                      </td>

                      <td className="p-4 font-medium">
                        ৳
                        {Number(
                          transaction.amount ||
                            0
                        ).toLocaleString(
                          'en-BD'
                        )}
                      </td>

                      <td className="p-4">
                        {transaction.quantity ||
                          '—'}
                      </td>

                      <td className="p-4 text-white/50">
                        {transaction.notes ||
                          '—'}
                      </td>

                      <td className="p-4">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setDeleteTarget(transaction)
                          }
                          className="text-red-500 hover:text-red-300 disabled:opacity-50"
                          aria-label={`Delete ${labels[transaction.type] ?? 'transaction'}`}
                        >
                          <Trash2
                            size={16}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>

        {!rows.length && (
          <p className="py-12 text-center text-white/40">
            No transactions yet.
          </p>
        )}
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-[10px]"
          role="presentation"
          onClick={() => !busy && setDeleteTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-transaction-title"
            className="w-full max-w-md rounded-[18px] border border-white/10 bg-transparent p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,.35)] backdrop-blur-[18px]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-transaction-title" className="text-lg font-semibold">
              Delete transaction?
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              This will delete the transaction and reverse its effect. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteTarget(null)}
                className="rounded-[12px] border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-white/75 backdrop-blur-[10px] hover:bg-white/[0.05] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const id = deleteTarget._id;
                  setDeleteTarget(null);
                  await del(id);
                }}
                className="rounded-[12px] bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}