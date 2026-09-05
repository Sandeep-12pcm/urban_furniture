import { ArrowLeft, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorState, InlineSpinner } from '../../components/DataStates.jsx';
import { StatusBadge, TypeBadge } from '../../components/StatusBadge.jsx';
import { formatDate, formatMoney } from '../../lib/format.js';
import { productsApi } from '../../lib/masterDataApi.js';

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    productsApi
      .get(id)
      .then((data) => !cancelled && setProduct(data.product))
      .catch((requestError) => !cancelled && setError(requestError.message || 'Unable to load this product.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/master-data/products')}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-indigo"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </button>

      {loading && (
        <div className="rounded-2xl border border-white/80 bg-white p-8 shadow-card">
          <InlineSpinner label="Loading product…" />
        </div>
      )}

      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && product && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-white/80 bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender/40 text-navy">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-ink">{product.name}</h1>
                <p className="text-sm text-muted">{product.categoryName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TypeBadge type={product.type} />
              <StatusBadge status={product.status} />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-ink">Pricing</h2>
              <dl className="space-y-4">
                <Field label="Sales Price" value={formatMoney(product.salesPrice)} />
                <Field label="Purchase Price" value={formatMoney(product.purchasePrice)} />
              </dl>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-ink">Record History</h2>
              <dl className="space-y-4">
                <Field label="Created" value={formatDate(product.createdAt)} />
                <Field label="Last Updated" value={formatDate(product.updatedAt)} />
                {product.archivedAt && <Field label="Archived" value={formatDate(product.archivedAt)} />}
              </dl>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-borderSoft bg-white/60 p-6">
            <h2 className="text-lg font-bold text-ink">Coming in later phases</h2>
            <p className="mt-1 text-sm text-muted">
              SKU, barcode, stock, tax, and product image fields will be added once Inventory and Invoicing are implemented.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value || '—'}</dd>
    </div>
  );
}
