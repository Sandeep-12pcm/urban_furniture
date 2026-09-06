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
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-borderSoft bg-lavender/40 text-navy shadow-inner">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <Package className="h-7 w-7" />
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-ink">{product.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-sm text-muted">{product.categoryName}</p>
                  {product.sku && (
                    <span className="font-mono bg-lavender/50 text-navy font-semibold px-2 py-0.5 rounded text-xs">
                      SKU: {product.sku}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={product.type} />
              <StatusBadge status={product.status} />
              {product.type === 'GOODS' && (
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    Number(product.stockQuantity || 0) <= 0
                      ? 'bg-danger/10 text-danger'
                      : Number(product.stockQuantity || 0) <= 5
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {Number(product.stockQuantity || 0)} units in stock
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-ink">Inventory & Codes</h2>
              <dl className="space-y-4">
                <Field
                  label="SKU"
                  value={product.sku ? <span className="font-mono font-semibold">{product.sku}</span> : '—'}
                />
                <Field
                  label="Barcode"
                  value={product.barcode ? <span className="font-mono font-semibold">{product.barcode}</span> : '—'}
                />
                <Field
                  label="Stock On Hand"
                  value={
                    product.type === 'GOODS'
                      ? `${product.stockQuantity || 0} units`
                      : 'Not tracked (Service/Combo)'
                  }
                />
              </dl>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-ink">Pricing & Tax</h2>
              <dl className="space-y-4">
                <Field label="Sales Price" value={formatMoney(product.salesPrice)} />
                <Field label="Purchase Price" value={formatMoney(product.purchasePrice)} />
                <Field label="Tax Rate" value={`${product.taxRate ? `${product.taxRate}%` : '18.00%'}`} />
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

          {product.imageUrl && (
            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-ink">Product Image Preview</h2>
              <div className="max-w-md overflow-hidden rounded-xl border border-borderSoft bg-surface/50 shadow-sm">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-64 w-full object-cover transition hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.parentElement.style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}
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
