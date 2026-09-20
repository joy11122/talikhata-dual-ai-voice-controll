
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

type Product = {
  _id: string;
  name: string;
  stockQuantity: number;
  unit: string;
  sellPrice?: number;
};

type Sale = {
  _id: string;
  productId?: {
    _id: string;
    name: string;
  };
  partyId?: {
    _id: string;
    name: string;
  };
  amount?: number;
  total?: number;
  quantity?: number;
  unitPrice?: number;
  paidAmount?: number;
  due?: number;
  notes?: string;
  timestamp?: string;
};

type SaleForm = {
  partyId: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  paidAmount: string;
  notes: string;
};

type FieldProps =
  InputHTMLAttributes<HTMLInputElement> & {
    name?: string;
  };

type SelectProps =
  SelectHTMLAttributes<HTMLSelectElement> & {
    children?: ReactNode;
  };

const Field = ({
  name,
  ...props
}: FieldProps) => (
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

const initialForm: SaleForm = {
  partyId: '',
  productId: '',
  quantity: '1',
  unitPrice: '0',
  paidAmount: '0',
  notes: '',
};

export default function Page() {
  const [parties, setParties] =
    useState<Party[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [rows, setRows] =
    useState<Sale[]>([]);

  const [form, setForm] =
    useState<SaleForm>(initialForm);

  const [message, setMessage] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const loadSales = useCallback(
    async () => {
      try {
        const response = await fetch(
          '/api/sales',
          {
            method: 'GET',
            cache: 'no-store',
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'Failed to load sales.'
          );
        }

        setRows(
          Array.isArray(data)
            ? data
            : data?.sales || []
        );
      } catch (error) {
        console.error(
          'Failed to load sales:',
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load sales.'
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
            method: 'GET',
            cache: 'no-store',
          }),
          fetch('/api/products', {
            method: 'GET',
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
              'Failed to load customers.'
          );
        }

        if (!productsResponse.ok) {
          throw new Error(
            productsData?.error ||
              'Failed to load products.'
          );
        }

        const partyList: Party[] =
          Array.isArray(partiesData)
            ? partiesData
            : partiesData?.parties || [];

        const productList: Product[] =
          Array.isArray(productsData)
            ? productsData
            : productsData?.products || [];

        setParties(
          partyList.filter(
            (party) =>
              party.partyType ===
              'CUSTOMER'
          )
        );

        setProducts(productList);
      } catch (error) {
        console.error(
          'Failed to load sales form data:',
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load sales data.'
        );
      }
    }, []);

  useEffect(() => {
    async function initialize() {
      setLoading(true);

      await Promise.all([
        loadFormData(),
        loadSales(),
      ]);

      setLoading(false);
    }

    void initialize();
  }, [
    loadFormData,
    loadSales,
  ]);

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

  function handlePartyChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    setForm((current) => ({
      ...current,
      partyId: event.target.value,
    }));
  }

  function handleProductChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    const productId =
      event.target.value;

    const product =
      products.find(
        (item) =>
          item._id === productId
      );

    setForm((current) => ({
      ...current,
      productId,
      unitPrice: String(
        product?.sellPrice ?? 0
      ),
    }));
  }

  async function reverse(
    id: string
  ) {
    const confirmed =
      window.confirm(
        'Reverse this sale? Stock and customer balance will be restored.'
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage('');

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
            'Could not reverse sale.'
        );
      }

      setMessage(
        'Sale reversed successfully.'
      );

      await loadSales();

      window.dispatchEvent(
        new Event(
          'talikhata:refresh'
        )
      );
    } catch (error) {
      console.error(
        'Failed to reverse sale:',
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not reverse sale. Please try again.'
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
      setMessage(
        'Please select a customer.'
      );
      return;
    }

    if (!form.productId) {
      setMessage(
        'Please select a product.'
      );
      return;
    }

    const quantity =
      Number(form.quantity);

    const unitPrice =
      Number(form.unitPrice);

    const paidAmount =
      Number(form.paidAmount);

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      setMessage(
        'Quantity must be greater than zero.'
      );
      return;
    }

    if (
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      setMessage(
        'Selling price must be a valid amount.'
      );
      return;
    }

    if (
      !Number.isFinite(paidAmount) ||
      paidAmount < 0
    ) {
      setMessage(
        'Paid amount must be a valid amount.'
      );
      return;
    }

    const total =
      quantity * unitPrice;

    if (paidAmount > total) {
      setMessage(
        'Paid amount cannot exceed total.'
      );
      return;
    }

    setBusy(true);

    try {
      const response =
        await fetch(
          '/api/sales',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              partyId:
                form.partyId,
              productId:
                form.productId,
              quantity,
              unitPrice,
              paidAmount,
              notes:
                form.notes.trim(),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Failed to save sale.'
        );
      }

      const result =
        data?.result;

      setMessage(
        `Saved. Total ৳${
          result?.total ?? total
        } • Due ৳${
          result?.due ??
          total - paidAmount
        }`
      );

      setForm({
        ...initialForm,
      });

      await loadSales();

      window.dispatchEvent(
        new Event(
          'talikhata:refresh'
        )
      );
    } catch (error) {
      console.error(
        'Failed to save sale:',
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to save sale. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold">
        বিক্রি / POS
      </h1>

      <p className="mt-2 text-slate-500">
        Complete sales flow with automatic
        stock and party balance updates.
      </p>

      <form
        onSubmit={save}
        className="mt-6 grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-6"
      >
        <div>
          <label
            htmlFor="partyId"
            className="form-label"
          >
            Customer
          </label>

          <Select
            id="partyId"
            name="partyId"
            value={form.partyId}
            onChange={handlePartyChange}
            required
          >
            <option value="">
              Select customer
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
          </Select>
        </div>

        <div>
          <label
            htmlFor="productId"
            className="form-label"
          >
            Product
          </label>

          <Select
            id="productId"
            name="productId"
            value={form.productId}
            onChange={handleProductChange}
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
                  {product.name} •{' '}
                  {product.stockQuantity}{' '}
                  {product.unit}
                </option>
              )
            )}
          </Select>
        </div>

        <div>
          <label
            htmlFor="quantity"
            className="form-label"
          >
            Quantity
          </label>

          <Field
            id="quantity"
            name="quantity"
            type="number"
            min="0.01"
            step="0.01"
            value={form.quantity}
            onChange={
              handleInputChange
            }
            required
          />
        </div>

        <div>
          <label
            htmlFor="unitPrice"
            className="form-label"
          >
            Selling price (৳)
          </label>

          <Field
            id="unitPrice"
            name="unitPrice"
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={
              handleInputChange
            }
            required
          />
        </div>

        <div>
          <label
            htmlFor="paidAmount"
            className="form-label"
          >
            Paid amount (৳)
          </label>

          <Field
            id="paidAmount"
            name="paidAmount"
            type="number"
            min="0"
            step="0.01"
            value={form.paidAmount}
            onChange={
              handleInputChange
            }
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
              : 'Save sale'}
          </button>
        </div>

        <div className="md:col-span-6">
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
            onChange={
              handleInputChange
            }
            placeholder="Add sale notes..."
          />
        </div>

        {message && (
          <p
            className="md:col-span-6 rounded-lg border p-3 text-sm"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        )}
      </form>

      <div className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="font-semibold">
          Recent sales
        </h2>

        {loading ? (
          <p className="py-8 text-center text-slate-400">
            Loading sales…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-slate-400">
            No sales yet.
          </p>
        ) : (
          <div className="mt-3">
            {rows.map(
              (sale) => (
                <div
                  key={sale._id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0"
                >
                  <div>
                    <p className="font-medium">
                      {sale.productId
                        ?.name ||
                        'Product'}{' '}
                      • ৳
                      {Number(
                        sale.amount ??
                          sale.total ??
                          0
                      ).toLocaleString(
                        'en-BD'
                      )}
                    </p>

                    <p className="text-sm text-slate-500">
                      Qty{' '}
                      {sale.quantity ??
                        0}{' '}
                      •{' '}
                      {sale.partyId
                        ?.name ||
                        'Walk-in'}
                    </p>

                    {sale.timestamp && (
                      <p className="text-xs text-slate-400">
                        {new Date(
                          sale.timestamp
                        ).toLocaleString(
                          'en-BD'
                        )}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void reverse(
                        sale._id
                      )
                    }
                    className="text-sm text-red-600 hover:underline disabled:opacity-50"
                  >
                    Reverse
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}