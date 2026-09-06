import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Select } from '../../components/Select.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { EmptyState, LoadingTable } from '../../components/DataStates.jsx';
import { accountingApi, accountsApi } from '../../lib/masterDataApi.js';
import { formatDate, formatMoney } from '../../lib/format.js';

export function AccountBalancesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    accountingApi
      .balances()
      .then((d) => setRows(d.accounts || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Account Balances"
        subtitle="Balances derived exclusively from posted Journal Entries"
      />
      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        {loading ? (
          <LoadingTable columns={5} />
        ) : rows.length === 0 ? (
          <EmptyState title="No accounting activity found." />
        ) : (
          <Table minWidth="760px">
            <thead>
              <tr>
                <Th>Account</Th>
                <Th>Type</Th>
                <Th className="text-right">Debit</Th>
                <Th className="text-right">Credit</Th>
                <Th className="text-right">Balance</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <Tr key={a.id}>
                  <Td first className="font-semibold text-navy">
                    {a.accountCode} · {a.accountName}
                  </Td>
                  <Td className="text-muted">{a.type}</Td>
                  <Td className="text-right font-medium">{formatMoney(a.totalDebit)}</Td>
                  <Td className="text-right font-medium">{formatMoney(a.totalCredit)}</Td>
                  <Td last className="text-right font-bold text-ink">
                    {formatMoney(a.balance)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}

export function LedgerPage() {
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState(() => searchParams.get('accountId') || '');
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    accountsApi
      .list({ status: 'ACTIVE' })
      .then((d) => setAccounts(d.accounts || []));
  }, []);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    accountingApi
      .ledger(accountId)
      .then((d) => setLedger(d.ledger || []))
      .finally(() => setLoading(false));
  }, [accountId]);

  return (
    <div>
      <PageHeader
        title="Account Ledger"
        subtitle="Posted accounting activity and deterministic running balances"
      />
      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <div className="mb-5 max-w-md">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Select an account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.accountCode} · {a.accountName}
              </option>
            ))}
          </Select>
        </div>

        {!accountId ? (
          <EmptyState title="Select an account to view its ledger." />
        ) : loading ? (
          <LoadingTable columns={6} />
        ) : ledger.length === 0 ? (
          <EmptyState title="No posted accounting transactions found for this account." />
        ) : (
          <Table minWidth="850px">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Entry</Th>
                <Th>Reference</Th>
                <Th className="text-right">Debit</Th>
                <Th className="text-right">Credit</Th>
                <Th className="text-right">Balance</Th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((l, i) => (
                <Tr key={`${l.entryNumber}-${i}`}>
                  <Td first className="text-muted">
                    {formatDate(l.date)}
                  </Td>
                  <Td className="font-semibold text-navy">{l.entryNumber}</Td>
                  <Td className="text-muted">{l.reference || '—'}</Td>
                  <Td className="text-right font-medium">{formatMoney(l.debit)}</Td>
                  <Td className="text-right font-medium">{formatMoney(l.credit)}</Td>
                  <Td last className="text-right font-bold text-ink">
                    {formatMoney(l.balance)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
