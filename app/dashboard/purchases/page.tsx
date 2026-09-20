
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
  buyPrice?: number;
};

type Purchase = {
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

type PurchaseForm = {
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

const initialForm: PurchaseForm = {
  partyId: '',
  productId: '',
  quantity: '1',
  unitPrice: '0',
  paidAmount: '0',
  notes: '',
};

export default function Page() {
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Purchase[]>([]);

  const [form, setForm] =
    useState<PurchaseForm>(initialForm);

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadPurchases = useCallback(async () => {
    try {
      const response = await fetch(
        '/api/purchases',
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Failed to load purchases.'
        );
      }

      setRows(
        Array.isArray(data)
          ? data
          : data?.purchases || []
      );
    } catch (error) {
      console.error(
        'Failed to load purchases:',
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load purchases.'
      );
    }
  }, []);

  const loadFormData = useCallback(async () => {
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
            'Failed to load suppliers.'
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
            party.partyType === 'SUPPLIER'
        )
      );

      setProducts(productList);
    } catch (error) {
      console.error(
        'Failed to load form data:',
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load purchase data.'
      );
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      setLoading(true);

      await Promise.all([
        loadFormData(),
        loadPurchases(),
      ]);

      setLoading(false);
    }

    void initialize();
  }, [loadFormData, loadPurchases]);

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

    const product = products.find(
      (item) =>
        item._id === productId
    );

    setForm((current) => ({
      ...current,
      productId,
      unitPrice: String(
        product?.buyPrice ?? 0
      ),
    }));
  }

  async function reverse(id: string) {
    const confirmed = window.confirm(
      'Reverse this purchase? Stock and supplier balance will be restored.'
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
            'Could not reverse purchase.'
        );
      }

      setMessage(
        'Purchase reversed successfully.'
      );

      await loadPurchases();

      window.dispatchEvent(
        new Event('talikhata:refresh')
      );
    } catch (error) {
      console.error(
        'Failed to reverse purchase:',
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not reverse purchase. Please try again.'
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
        'Please select a supplier.'
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
        'Buy price must be a valid amount.'
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
      const response = await fetch(
        '/api/purchases',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            partyId: form.partyId,
            productId: form.productId,
            quantity,
            unitPrice,
            paidAmount,
            notes: form.notes.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Failed to save purchase.'
        );
      }

      const result = data?.result;

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

      await loadPurchases();

      window.dispatchEvent(
        new Event('talikhata:refresh')
      );
    } catch (error) {
      console.error(
        'Failed to save purchase:',
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to save purchase. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold">
        ক্রয়
      </h1>

      <p className="mt-2 text-slate-500">
        Complete purchase flow with automatic
        stock and supplier balance updates.
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
            Supplier
          </label>

          <Select
            id="partyId"
            name="partyId"
            value={form.partyId}
            onChange={handlePartyChange}
            required
          >
            <option value="">
              Select supplier
            </option>

            {parties.map((party) => (
              <option
                key={party._id}
                value={party._id}
              >
                {party.name}
              </option>
            ))}
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

            {products.map((product) => (
              <option
                key={product._id}
                value={product._id}
              >
                {product.name} •{' '}
                {product.stockQuantity}{' '}
                {product.unit}
              </option>
            ))}
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
            onChange={handleInputChange}
            required
          />
        </div>

        <div>
          <label
            htmlFor="unitPrice"
            className="form-label"
          >
            Buy price (৳)
          </label>

          <Field
            id="unitPrice"
            name="unitPrice"
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={handleInputChange}
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
            onChange={handleInputChange}
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
              : 'Save purchase'}
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
            onChange={handleInputChange}
            placeholder="Add purchase notes..."
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
          Recent purchases
        </h2>

        {loading ? (
          <p className="py-8 text-center text-slate-400">
            Loading purchases…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-slate-400">
            No purchases yet.
          </p>
        ) : (
          <div className="mt-3">
            {rows.map((purchase) => (
              <div
                key={purchase._id}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0"
              >
                <div>
                  <p className="font-medium">
                    {purchase.productId?.name ||
                      'Product'}{' '}
                    • ৳
                    {Number(
                      purchase.amount ??
                        purchase.total ??
                        0
                    ).toLocaleString(
                      'en-BD'
                    )}
                  </p>

                  <p className="text-sm text-slate-500">
                    Qty{' '}
                    {purchase.quantity ??
                      0}{' '}
                    •{' '}
                    {purchase.partyId?.name ||
                      'Supplier'}
                  </p>

                  {purchase.timestamp && (
                    <p className="text-xs text-slate-400">
                      {new Date(
                        purchase.timestamp
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
                      purchase._id
                    )
                  }
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  Reverse
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
