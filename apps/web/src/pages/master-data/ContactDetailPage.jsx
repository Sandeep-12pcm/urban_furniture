import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Globe,
  ReceiptText,
  ShoppingCart,
  User,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { ErrorState, InlineSpinner } from '../../components/DataStates.jsx';
import { StatusBadge, TypeBadge } from '../../components/StatusBadge.jsx';
import { StatusPill } from '../../components/StatusPill.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { formatDate, formatMoney } from '../../lib/format.js';
import { contactsApi } from '../../lib/masterDataApi.js';

export function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([
      contactsApi.get(id),
      contactsApi.transactions(id).catch(() => ({ purchaseOrders: [], vendorBills: [], salesOrders: [], customerInvoices: [], payments: [] })),
    ])
      .then(([contactData, txData]) => {
        if (!cancelled) {
          setContact(contactData.contact);
          setTransactions(txData);
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || 'Unable to load this contact.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/master-data/contacts')}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-indigo transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Contacts
      </button>

      {loading && (
        <div className="rounded-2xl border border-white/80 bg-white p-8 shadow-card">
          <InlineSpinner label="Loading contact details and transactions…" />
        </div>
      )}

      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && contact && (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Left Column Profile Card */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/80 bg-white p-6 text-center shadow-card">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-lavender/40 text-navy shadow-inner">
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

              {contact.portalLoginId && (
                <div className="mt-5 rounded-xl border border-indigo/20 bg-indigo/5 p-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo">
                    <Globe className="h-4 w-4 shrink-0" />
                    <span>Portal Account Active</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Login ID: <span className="font-semibold text-ink">{contact.portalLoginId}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Role: <span className="font-semibold text-ink">CONTACT ({contact.portalAccountType || contact.type})</span>
                  </p>
                </div>
              )}

              <Link to="/master-data/contacts" className="mt-6 inline-block w-full">
                <Button type="button" variant="secondary" className="w-full">
                  Manage in list
                </Button>
              </Link>
            </div>

            {/* Record History & Relationship Linkage */}
            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Relationship & Audit</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-bold uppercase text-muted">Created By</dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {contact.createdByName ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-page px-2 py-0.5 text-xs font-bold text-navy">
                        {contact.createdByName}
                      </span>
                    ) : (
                      contact.createdBy || 'System Administrator'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-muted">Date Created</dt>
                  <dd className="mt-0.5 font-medium text-ink">{formatDate(contact.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-muted">Last Updated</dt>
                  <dd className="mt-0.5 font-medium text-ink">{formatDate(contact.updatedAt)}</dd>
                </div>
                {contact.archivedAt && (
                  <div>
                    <dt className="text-xs font-bold uppercase text-danger">Archived Date</dt>
                    <dd className="mt-0.5 font-medium text-danger">{formatDate(contact.archivedAt)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Right Column Content */}
          <div className="space-y-6">
            {/* Contact Details Card */}
            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
              <h2 className="mb-4 text-base font-bold text-ink">Contact Details</h2>
              <dl className="grid gap-5 sm:grid-cols-2">
                <Field label="Email" value={contact.email} />
                <Field label="Mobile" value={contact.mobile} />
                <Field label="City" value={contact.city} />
                <Field label="State" value={contact.state} />
                <Field label="Pincode" value={contact.pincode} />
                <Field
                  label="Portal Status"
                  value={
                    contact.portalLoginId ? (
                      <span className="inline-flex items-center gap-1 text-success font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        Enabled ({contact.portalLoginId})
                      </span>
                    ) : (
                      'Disabled / No Portal'
                    )
                  }
                />
              </dl>
            </div>

            {/* Live Transactions Section */}
            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-ink">Recent Transactions</h2>
                  <p className="text-xs text-muted">Live commercial records associated with this contact</p>
                </div>
                {transactions && (
                  <span className="rounded-full bg-page px-3 py-1 text-xs font-bold text-navy">
                    {transactions.totalTransactions} total transactions
                  </span>
                )}
              </div>

              {/* Purchase Orders (for Vendors) */}
              {transactions?.purchaseOrders?.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                    <ShoppingCart className="h-4 w-4 text-indigo" />
                    <span>Purchase Orders ({transactions.purchaseOrders.length})</span>
                  </div>
                  <Table minWidth="600px">
                    <thead>
                      <tr>
                        <Th>PO Number</Th>
                        <Th>Date</Th>
                        <Th className="text-right">Total Amount</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.purchaseOrders.map((po) => (
                        <Tr key={po.id}>
                          <Td first className="font-semibold text-navy">
                            <Link to={`/purchases/orders/${po.id}`} className="hover:underline">
                              {po.number}
                            </Link>
                          </Td>
                          <Td>{formatDate(po.date)}</Td>
                          <Td className="text-right font-medium">{formatMoney(po.total)}</Td>
                          <Td last><StatusPill status={po.status} /></Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {/* Vendor Bills (for Vendors) */}
              {transactions?.vendorBills?.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                    <ReceiptText className="h-4 w-4 text-indigo" />
                    <span>Vendor Bills ({transactions.vendorBills.length})</span>
                  </div>
                  <Table minWidth="600px">
                    <thead>
                      <tr>
                        <Th>Bill Number</Th>
                        <Th>Invoice Date</Th>
                        <Th className="text-right">Total Amount</Th>
                        <Th>Payment Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.vendorBills.map((bill) => (
                        <Tr key={bill.id}>
                          <Td first className="font-semibold text-navy">
                            <Link to={`/purchases/bills/${bill.id}`} className="hover:underline">
                              {bill.number}
                            </Link>
                          </Td>
                          <Td>{formatDate(bill.date)}</Td>
                          <Td className="text-right font-medium">{formatMoney(bill.total)}</Td>
                          <Td last><StatusPill status={bill.paymentStatus || bill.status} /></Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {/* Sales Orders (for Customers) */}
              {transactions?.salesOrders?.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                    <ShoppingCart className="h-4 w-4 text-indigo" />
                    <span>Sales Orders ({transactions.salesOrders.length})</span>
                  </div>
                  <Table minWidth="600px">
                    <thead>
                      <tr>
                        <Th>Order Number</Th>
                        <Th>Date</Th>
                        <Th className="text-right">Total Amount</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.salesOrders.map((so) => (
                        <Tr key={so.id}>
                          <Td first className="font-semibold text-navy">
                            <Link to={`/sales/orders/${so.id}`} className="hover:underline">
                              {so.number}
                            </Link>
                          </Td>
                          <Td>{formatDate(so.date)}</Td>
                          <Td className="text-right font-medium">{formatMoney(so.total)}</Td>
                          <Td last><StatusPill status={so.status} /></Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {/* Customer Invoices (for Customers) */}
              {transactions?.customerInvoices?.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                    <FileText className="h-4 w-4 text-indigo" />
                    <span>Customer Invoices ({transactions.customerInvoices.length})</span>
                  </div>
                  <Table minWidth="600px">
                    <thead>
                      <tr>
                        <Th>Invoice Number</Th>
                        <Th>Date</Th>
                        <Th className="text-right">Total Amount</Th>
                        <Th>Payment Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.customerInvoices.map((inv) => (
                        <Tr key={inv.id}>
                          <Td first className="font-semibold text-navy">
                            <Link to={`/sales/invoices/${inv.id}`} className="hover:underline">
                              {inv.number}
                            </Link>
                          </Td>
                          <Td>{formatDate(inv.date)}</Td>
                          <Td className="text-right font-medium">{formatMoney(inv.total)}</Td>
                          <Td last><StatusPill status={inv.paymentStatus || inv.status} /></Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {/* Payments */}
              {transactions?.payments?.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                    <Wallet className="h-4 w-4 text-indigo" />
                    <span>Recorded Payments ({transactions.payments.length})</span>
                  </div>
                  <Table minWidth="600px">
                    <thead>
                      <tr>
                        <Th>Payment No</Th>
                        <Th>Date</Th>
                        <Th>Method</Th>
                        <Th className="text-right">Amount</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.payments.map((p) => (
                        <Tr key={p.id}>
                          <Td first className="font-semibold text-navy">{p.number}</Td>
                          <Td>{formatDate(p.date)}</Td>
                          <Td><span className="font-semibold text-ink">{p.method}</span></Td>
                          <Td className="text-right font-medium">{formatMoney(p.total)}</Td>
                          <Td last><StatusPill status={p.status} /></Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
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
