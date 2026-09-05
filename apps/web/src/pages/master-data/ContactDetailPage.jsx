import { ArrowLeft, FileText, ReceiptText, User, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { ErrorState, InlineSpinner } from '../../components/DataStates.jsx';
import { StatusBadge, TypeBadge } from '../../components/StatusBadge.jsx';
import { formatDate } from '../../lib/format.js';
import { contactsApi } from '../../lib/masterDataApi.js';

export function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    contactsApi
      .get(id)
      .then((data) => !cancelled && setContact(data.contact))
      .catch((requestError) => !cancelled && setError(requestError.message || 'Unable to load this contact.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/master-data/contacts')}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-indigo"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Contacts
      </button>

      {loading && (
        <div className="rounded-2xl border border-white/80 bg-white p-8 shadow-card">
          <InlineSpinner label="Loading contact…" />
        </div>
      )}

      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && contact && (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="rounded-2xl border border-white/80 bg-white p-6 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-lavender/40 text-navy">
              {contact.profileImageUrl ? (
                <img src={contact.profileImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10" />
              )}
            </div>
            <h1 className="text-xl font-bold text-ink">{contact.name}</h1>
            <div className="mt-3 flex items-center justify-center gap-2">
              <TypeBadge type={contact.type} />
              <StatusBadge status={contact.status} />
            </div>
            <Link to={`/master-data/contacts`} className="mt-6 inline-block">
              <Button type="button" variant="secondary">Manage in list</Button>
            </Link>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-ink">Contact Information</h2>
              <dl className="grid gap-5 sm:grid-cols-2">
                <Field label="Email" value={contact.email} />
                <Field label="Mobile" value={contact.mobile} />
                <Field label="City" value={contact.city} />
                <Field label="State" value={contact.state} />
                <Field label="Pincode" value={contact.pincode} />
              </dl>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-ink">Record History</h2>
              <dl className="grid gap-5 sm:grid-cols-2">
                <Field label="Created" value={formatDate(contact.createdAt)} />
                <Field label="Last Updated" value={formatDate(contact.updatedAt)} />
                {contact.archivedAt && <Field label="Archived" value={formatDate(contact.archivedAt)} />}
              </dl>
            </div>

            <div className="rounded-2xl border border-dashed border-borderSoft bg-white/60 p-6">
              <h2 className="mb-1 text-lg font-bold text-ink">Coming in later phases</h2>
              <p className="mb-4 text-sm text-muted">
                This space is reserved for transaction history once Sales, Purchases, and Payments are implemented.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <FuturePlaceholder icon={FileText} label="Invoices" />
                <FuturePlaceholder icon={ReceiptText} label="Bills" />
                <FuturePlaceholder icon={Wallet} label="Payments" />
              </div>
            </div>
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

function FuturePlaceholder({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-page px-4 py-5 text-center text-muted">
      <Icon className="h-5 w-5" />
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}
