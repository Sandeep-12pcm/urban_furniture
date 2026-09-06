import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Save, Send, X } from 'lucide-react';
import { Button } from '../../components/Button.jsx';
import { EmptyState, ErrorState, LoadingTable } from '../../components/DataStates.jsx';
import { Input } from '../../components/Input.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { Select } from '../../components/Select.jsx';
import { StatusPill } from '../../components/StatusPill.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { useToast } from '../../components/Toast.jsx';
import { FilterSelect, SearchBar, Toolbar } from '../../components/Toolbar.jsx';
import { formatDate, formatMoney } from '../../lib/format.js';
import { accountsApi, journalEntriesApi, journalsApi } from '../../lib/masterDataApi.js';
import { useDebouncedValue, useResourceList } from '../../lib/useResourceList.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 per page' },
  { value: '25', label: '25 per page' },
  { value: '50', label: '50 per page' },
  { value: '100', label: '100 per page' },
];

const emptyLine = () => ({ accountId: '', description: '', debit: '', credit: '' });

export function JournalEntriesPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [journalFilter, setJournalFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const debouncedSearch = useDebouncedValue(search);

  const [journals, setJournals] = useState([]);
  const [form, setForm] = useState(null);

  useEffect(() => {
    journalsApi
      .list({ limit: 500 })
      .then((data) => setJournals(data.journals || []))
      .catch(() => {});
  }, []);

  const journalOptions = useMemo(
    () => [
      { value: '', label: 'All Journals' },
      ...journals.map((j) => ({ value: j.id, label: j.name })),
    ],
    [journals]
  );

  const params = {
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    journalId: journalFilter || undefined,
    page,
    limit: pageSize,
  };

  const { data: entries, pagination, loading, error, reload } = useResourceList(
    journalEntriesApi,
    params,
    'journalEntries'
  );

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleJournalChange = (value) => {
    setJournalFilter(value);
    setPage(1);
  };

  const handlePageSizeChange = (value) => {
    setPageSize(Number(value));
    setPage(1);
  };

  const openNewEntryForm = () => {
    setForm({
      journalId: journals[0]?.id || '',
      entryDate: new Date().toISOString().slice(0, 10),
      reference: '',
      description: '',
      lines: [emptyLine(), emptyLine()],
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal Entries"
        subtitle="Create, review, and post double-entry accounting records"
        actions={
          <Button onClick={openNewEntryForm}>
            <Plus className="h-4 w-4" />
            New Journal Entry
          </Button>
        }
      />

      <Toolbar>
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by entry #, reference, description…"
        />
        <FilterSelect
          value={statusFilter}
          onChange={handleStatusChange}
          options={STATUS_OPTIONS}
          ariaLabel="Filter by status"
        />
        <FilterSelect
          value={journalFilter}
          onChange={handleJournalChange}
          options={journalOptions}
          ariaLabel="Filter by journal"
        />
        <FilterSelect
          value={String(pageSize)}
          onChange={handlePageSizeChange}
          options={PAGE_SIZE_OPTIONS}
          ariaLabel="Rows per page"
        />
      </Toolbar>

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        {loading && <LoadingTable columns={7} rows={6} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && entries.length === 0 && (
          <EmptyState
            title="No journal entries found"
            description="Create your first draft entry or adjust filters to begin accounting activity."
            actionLabel="New Journal Entry"
            onAction={openNewEntryForm}
          />
        )}
        {!loading && !error && entries.length > 0 && (
          <>
            <Table minWidth="850px">
              <thead>
                <tr>
                  <Th>Entry No</Th>
                  <Th>Date</Th>
                  <Th>Journal</Th>
                  <Th>Reference</Th>
                  <Th className="text-right">Debit</Th>
                  <Th className="text-right">Credit</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Tr
                    key={entry.id}
                    className="cursor-pointer transition-colors hover:bg-lavender/20"
                    onClick={() => navigate(`/accounting/journal-entries/${entry.id}`)}
                  >
                    <Td first className="font-semibold text-navy">
                      {entry.entryNumber}
                    </Td>
                    <Td>{formatDate(entry.entryDate)}</Td>
                    <Td>{entry.journalName}</Td>
                    <Td className="text-muted">{entry.reference || '—'}</Td>
                    <Td className="text-right font-medium">{formatMoney(entry.totalDebit)}</Td>
                    <Td className="text-right font-medium">{formatMoney(entry.totalCredit)}</Td>
                    <Td last>
                      <StatusPill status={entry.status} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>

      {form && (
        <EntryForm
          form={form}
          setForm={setForm}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function EntryForm({ form, setForm, onClose, onSaved }) {
  const [accounts, setAccounts] = useState([]);
  const [journals, setJournals] = useState([]);
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    accountsApi
      .list({ status: 'ACTIVE', limit: 500 })
      .then((d) => setAccounts(d.accounts || []))
      .catch(() => {});
    journalsApi
      .list({ status: 'ACTIVE', limit: 500 })
      .then((d) => setJournals(d.journals || []))
      .catch(() => {});
  }, []);

  const totals = useMemo(
    () =>
      form.lines.reduce(
        (acc, line) => ({
          d: acc.d + (Number(line.debit) || 0),
          c: acc.c + (Number(line.credit) || 0),
        }),
        { d: 0, c: 0 }
      ),
    [form.lines]
  );

  const isBalanced = totals.d > 0 && totals.d.toFixed(2) === totals.c.toFixed(2);

  const changeLine = (index, key, value) => {
    setForm({
      ...form,
      lines: form.lines.map((line, n) => (n === index ? { ...line, [key]: value } : line)),
    });
  };

  async function save(post) {
    if (!form.journalId) {
      notify('Please select a journal.', { tone: 'error' });
      return;
    }
    if (!form.lines || form.lines.length < 2) {
      notify('A journal entry must have at least 2 lines.', { tone: 'error' });
      return;
    }
    const hasMissingAccount = form.lines.some((line) => !line.accountId);
    if (hasMissingAccount) {
      notify('Please select an account for each line.', { tone: 'error' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        lines: form.lines.map((l) => ({
          ...l,
          debit: l.debit || '0',
          credit: l.credit || '0',
        })),
      };
      const data = await journalEntriesApi.create(payload);
      if (post) {
        await journalEntriesApi.post(data.journalEntry.id);
      }
      notify(post ? 'Journal Entry posted successfully.' : 'Draft saved successfully.');
      onSaved();
    } catch (e) {
      notify(e.message || 'Could not save Journal Entry.', { tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/30 p-4 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-soft">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">New Journal Entry</h2>
            <p className="text-sm text-muted">Drafts do not affect balances until posted.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-page hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-muted">Journal</label>
            <Select value={form.journalId} onChange={(e) => setForm({ ...form, journalId: e.target.value })}>
              <option value="">Select journal</option>
              {journals.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-muted">Date</label>
            <Input
              type="date"
              value={form.entryDate}
              onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-muted">Reference</label>
            <Input
              placeholder="e.g. INV-0012, Rent Jan"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-bold uppercase text-muted">Description</label>
          <Input
            placeholder="Journal entry description or memo"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="mt-6 overflow-x-auto">
          <Table minWidth="760px">
            <thead>
              <tr>
                <Th>Account</Th>
                <Th>Description</Th>
                <Th className="text-right">Debit</Th>
                <Th className="text-right">Credit</Th>
                <Th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, index) => (
                <Tr key={index}>
                  <Td first>
                    <Select
                      value={line.accountId}
                      onChange={(e) => changeLine(index, 'accountId', e.target.value)}
                    >
                      <option value="">Select account</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.accountCode} · {acc.accountName}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Input
                      placeholder="Line description"
                      value={line.description}
                      onChange={(e) => changeLine(index, 'description', e.target.value)}
                    />
                  </Td>
                  <Td>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="text-right"
                      placeholder="0.00"
                      value={line.debit}
                      onChange={(e) => changeLine(index, 'debit', e.target.value)}
                    />
                  </Td>
                  <Td>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="text-right"
                      placeholder="0.00"
                      value={line.credit}
                      onChange={(e) => changeLine(index, 'credit', e.target.value)}
                    />
                  </Td>
                  <Td last className="text-center">
                    <button
                      type="button"
                      className="text-sm font-semibold text-danger hover:underline disabled:opacity-40"
                      disabled={form.lines.length <= 2}
                      onClick={() =>
                        setForm({
                          ...form,
                          lines: form.lines.filter((_, n) => n !== index),
                        })
                      }
                    >
                      Remove
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>

        <button
          type="button"
          className="mt-3 text-sm font-bold text-indigo hover:underline"
          onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}
        >
          + Add Line
        </button>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-page p-4 text-sm font-semibold">
          <span className={isBalanced ? 'text-success font-bold' : 'text-danger font-bold'}>
            {isBalanced ? '✓ Entry Balanced' : '✗ Debits and credits must match (non-zero)'}
          </span>
          <div className="flex gap-6">
            <span>Total Debit: {formatMoney(totals.d)}</span>
            <span>Total Credit: {formatMoney(totals.c)}</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={() => save(false)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </Button>
          <Button type="button" disabled={saving || !isBalanced} onClick={() => save(true)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post Entry
          </Button>
        </div>
      </div>
    </div>
  );
}
