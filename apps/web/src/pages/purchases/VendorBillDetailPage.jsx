import { ArrowLeft, Download, Loader2, Printer, Send, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { ErrorState, InlineSpinner } from '../../components/DataStates.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { PaymentPanel } from '../../components/PaymentPanel.jsx';
import { StatusPill } from '../../components/StatusPill.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useAuth } from '../../lib/AuthContext.jsx';
import { downloadFile } from '../../lib/api.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { purchasesApi } from '../../lib/masterDataApi.js';

export function VendorBillDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await purchasesApi.bill(id);
      setBill(data.vendorBill);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load this bill.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await downloadFile(`/purchases/bills/${id}/pdf`, `${bill?.billNumber || 'bill'}.pdf`);
      notify('Vendor Bill PDF downloaded.');
    } catch (err) {
      notify(err.message || 'Failed to download bill PDF.', { tone: 'error' });
    } finally {
      setDownloading(false);
    }
  }

  async function post() {
    setActing('post');
    try {
      await purchasesApi.postBill(id);
      notify('Bill posted. Accounting entry created.');
      load();
    } catch (requestError) {
      notify(requestError.message || 'Could not post bill.', { tone: 'error' });
    } finally {
      setActing('');
    }
  }

  async function cancel() {
    setActing('cancel');
    try {
      await purchasesApi.cancelBill(id);
      notify('Bill cancelled.');
      setCancelOpen(false);
      load();
    } catch (requestError) {
      notify(requestError.message || 'Could not cancel bill.', { tone: 'error' });
    } finally {
      setActing('');
    }
  }

  const status = bill?.status;
  const paymentStatus = bill?.paymentStatus || bill?.payment_status;
  const isContact = user?.role === 'CONTACT';

  return (
    <div>
      <div className="no-print">
        <button type="button" onClick={() => navigate('/purchases/bills')} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-indigo">
          <ArrowLeft className="h-4 w-4" />
          Back to Vendor Bills
        </button>
      </div>

      {loading && <div className="rounded-2xl border border-white/80 bg-white p-8 shadow-card"><InlineSpinner label="Loading bill…" /></div>}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && bill && (
        <div className="space-y-6">
          <div className="no-print">
            <PageHeader
              title={bill.billNumber}
              subtitle={`${bill.vendorName} · Due ${formatDate(bill.dueDate)}`}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={status} />
                  {status === 'POSTED' && <StatusPill status={paymentStatus} />}
                  <Button type="button" variant="secondary" onClick={handleDownloadPdf} disabled={downloading}>
                    <Download className="h-4 w-4" />
                    {downloading ? 'Downloading…' : 'Download PDF'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                    Print Bill
                  </Button>
                  {!isContact && status === 'DRAFT' && (
                    <>
                      <Button type="button" variant="secondary" onClick={() => setCancelOpen(true)}>
                        <XCircle className="h-4 w-4" />
                        Cancel
                      </Button>
                      <Button type="button" onClick={post} disabled={acting === 'post'}>
                        {acting === 'post' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Post Bill
                      </Button>
                    </>
                  )}
                </div>
              }
            />
          </div>

          <div className="printable-document rounded-2xl border border-white/80 bg-white p-6 shadow-card">
            {/* Header visible only in print mode */}
            <div className="hidden print:block print:mb-6 border-b border-slate-200 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Urban Furniture Pvt. Ltd.</h1>
                  <p className="text-xs text-slate-600">104 Industrial Area, Phase II, New Delhi, 110020, India</p>
                  <p className="text-xs text-slate-600">GSTIN: 07AAAAU1234A1Z5 | accounts@urbanfurniture.local</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-slate-800">VENDOR BILL</h2>
                  <p className="text-sm font-semibold">{bill.billNumber}</p>
                  {bill.vendorInvoiceNumber && <p className="text-xs text-slate-600">Vendor Ref: {bill.vendorInvoiceNumber}</p>}
                  <p className="text-xs text-slate-600">Date: {formatDate(bill.invoiceDate)}</p>
                  <p className="text-xs text-slate-600">Due: {formatDate(bill.dueDate)}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-xs font-bold uppercase text-slate-500">Vendor / Supplier:</p>
                <p className="text-sm font-bold text-slate-900">{bill.vendorName}</p>
              </div>
            </div>

            <Table minWidth="600px">
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Qty</Th>
                  <Th>Unit Price</Th>
                  <Th>Tax</Th>
                  <Th>Line Total</Th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((item) => (
                  <Tr key={item.id}>
                    <Td first className="font-semibold">{item.productName}</Td>
                    <Td>{item.quantity}</Td>
                    <Td>{formatMoney(item.unitPrice)}</Td>
                    <Td>{item.taxRate}%</Td>
                    <Td last className="font-semibold">{formatMoney(item.lineTotal)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-5 flex flex-wrap justify-end gap-6 rounded-xl bg-page p-4 text-sm font-semibold">
              <span>Subtotal {formatMoney(bill.subtotal)}</span>
              <span>Tax {formatMoney(bill.taxAmount)}</span>
              <span className="text-ink">Total {formatMoney(bill.totalAmount)}</span>
            </div>
          </div>

          <div className="no-print">
            {status === 'POSTED' && (
              <PaymentPanel type="VENDOR" targetId={bill.id} targetStatus={status} onChanged={load} />
            )}

            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-ink">Record History</h2>
              <dl className="grid gap-4 sm:grid-cols-3 text-sm">
                <div><dt className="text-xs font-bold uppercase text-muted">Vendor Invoice #</dt><dd className="mt-1 font-semibold">{bill.vendorInvoiceNumber || '—'}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-muted">Created By</dt><dd className="mt-1 font-semibold">{bill.createdBy}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-muted">Posted By</dt><dd className="mt-1 font-semibold">{bill.postedBy || '—'}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel Vendor Bill?"
        description={`"${bill?.billNumber}" will be cancelled and can no longer be posted.`}
        confirmLabel="Cancel Bill"
        loading={acting === 'cancel'}
        onConfirm={cancel}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}
