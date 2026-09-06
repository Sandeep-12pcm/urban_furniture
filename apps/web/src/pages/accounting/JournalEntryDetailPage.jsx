import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Send, XCircle } from 'lucide-react';
import { Button } from '../../components/Button.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { ErrorState, InlineSpinner } from '../../components/DataStates.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { StatusPill } from '../../components/StatusPill.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { useToast } from '../../components/Toast.jsx';
import { formatDate, formatMoney } from '../../lib/format.js';
import { journalEntriesApi } from '../../lib/masterDataApi.js';

const LINES_PAGE_SIZE = 10;

export function JournalEntryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [linePage, setLinePage] = useState(1);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await journalEntriesApi.get(id);
      setEntry(data.journalEntry);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load this journal entry.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handlePost() {
    setActing('post');
    try {
      await journalEntriesApi.post(id);
      notify('Journal Entry posted successfully.');
      setPostOpen(false);
      load();
    } catch (requestError) {
      notify(requestError.message || 'Could not post Journal Entry.', { tone: 'error' });
    } finally {
      setActing('');
    }
  }

  async function handleCancel() {
    setActing('cancel');
    try {
      await journalEntriesApi.cancel(id);
      notify('Journal Entry cancelled.');
      setCancelOpen(false);
      load();
    } catch (requestError) {
      notify(requestError.message || 'Could not cancel Journal Entry.', { tone: 'error' });
    } finally {
      setActing('');
    }
  }

  const lines = entry?.lines || [];
  const totalLinePages = Math.ceil(lines.length / LINES_PAGE_SIZE);
  const paginatedLines = useMemo(() => {
    const start = (linePage - 1) * LINES_PAGE_SIZE;
    return lines.slice(start, start + LINES_PAGE_SIZE);
  }, [lines, linePage]);

  const linePagination = useMemo(() => {
    if (lines.length <= LINES_PAGE_SIZE) return null;
    return {
      page: linePage,
      limit: LINES_PAGE_SIZE,
      total: lines.length,
      totalPages: totalLinePages,
    };
  }, [lines.length, linePage, totalLinePages]);

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/accounting/journal-entries')}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-indigo transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Journal Entries
      </button>

      {loading && (
        <div className="rounded-2xl border border-white/80 bg-white p-8 shadow-card">
          <InlineSpinner label="Loading journal entry…" />
        </div>
      )}

      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && entry && (
        <div className="space-y-6">
          <PageHeader
            title={entry.entryNumber}
            subtitle={`${entry.journalName} · ${formatDate(entry.entryDate)}`}
            actions={
              <div className="flex items-center gap-3">
                <StatusPill status={entry.status} />
                {entry.balanced ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Balanced
                  </span>
                ) : (
                  <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-bold text-danger">
                    Unbalanced
                  </span>
                )}
                {entry.status === 'DRAFT' && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setCancelOpen(true)}
                      disabled={Boolean(acting)}
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel Draft
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setPostOpen(true)}
                      disabled={Boolean(acting) || !entry.balanced}
                    >
                      {acting === 'post' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Post Entry
                    </Button>
                  </>
                )}
              </div>
            }
          />

          <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-base font-bold text-ink">Entry Overview</h2>
            <dl className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase text-muted">Journal</dt>
                <dd className="mt-1 font-semibold text-ink">
                  {entry.journalName}
                  {entry.journalType && (
                    <span className="ml-2 text-xs font-normal text-muted">({entry.journalType})</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-muted">Reference</dt>
                <dd className="mt-1 font-semibold text-ink">{entry.reference || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-muted">Entry Date</dt>
                <dd className="mt-1 font-semibold text-ink">{formatDate(entry.entryDate)}</dd>
              </div>
              <div className="sm:col-span-3">
                <dt className="text-xs font-bold uppercase text-muted">Description</dt>
                <dd className="mt-1 text-ink">{entry.description || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">
                Accounting Lines ({lines.length})
              </h2>
            </div>

            <Table minWidth="760px">
              <thead>
                <tr>
                  <Th>Account</Th>
                  <Th>Description</Th>
                  <Th className="text-right">Debit</Th>
                  <Th className="text-right">Credit</Th>
                  <Th>Analytic Account</Th>
                </tr>
              </thead>
              <tbody>
                {paginatedLines.map((line) => (
                  <Tr key={line.id}>
                    <Td first className="font-semibold text-navy">
                      {line.accountCode} · {line.accountName}
                    </Td>
                    <Td>{line.description || '—'}</Td>
                    <Td className="text-right font-medium">{formatMoney(line.debit)}</Td>
                    <Td className="text-right font-medium">{formatMoney(line.credit)}</Td>
                    <Td last className="text-muted">{line.analyticAccountName || '—'}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            {linePagination && (
              <div className="mt-4">
                <Pagination pagination={linePagination} onPageChange={setLinePage} />
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-page p-4 text-sm font-semibold">
              <span className={entry.balanced ? 'text-success font-bold' : 'text-danger font-bold'}>
                {entry.balanced ? '✓ Debits and credits are balanced' : '✗ Debits and credits do not match'}
              </span>
              <div className="flex gap-6">
                <span>Total Debit: {formatMoney(entry.totalDebit)}</span>
                <span>Total Credit: {formatMoney(entry.totalCredit)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-base font-bold text-ink">Audit Trail</h2>
            <dl className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase text-muted">Created By</dt>
                <dd className="mt-1 font-semibold text-ink">{entry.createdBy || '—'}</dd>
                <dd className="text-xs text-muted">{formatDate(entry.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-muted">Posted By</dt>
                <dd className="mt-1 font-semibold text-ink">{entry.postedBy || '—'}</dd>
                <dd className="text-xs text-muted">{entry.postedAt ? formatDate(entry.postedAt) : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-muted">Cancelled By</dt>
                <dd className="mt-1 font-semibold text-ink">{entry.cancelledBy || '—'}</dd>
                <dd className="text-xs text-muted">
                  {entry.cancelledAt ? formatDate(entry.cancelledAt) : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel Draft Journal Entry?"
        description={`Entry "${entry?.entryNumber}" will be cancelled. It can no longer be edited or posted.`}
        confirmLabel="Cancel Entry"
        tone="danger"
        loading={acting === 'cancel'}
        onConfirm={handleCancel}
        onCancel={() => setCancelOpen(false)}
      />

      <ConfirmDialog
        open={postOpen}
        title="Post Journal Entry?"
        description={`Post entry "${entry?.entryNumber}"? Once posted, double-entry financial balances are updated and cannot be reverted.`}
        confirmLabel="Post Entry"
        tone="default"
        loading={acting === 'post'}
        onConfirm={handlePost}
        onCancel={() => setPostOpen(false)}
      />
    </div>
  );
}
