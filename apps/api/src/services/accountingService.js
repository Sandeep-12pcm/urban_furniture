const { randomUUID } = require('crypto');
const { withTransaction } = require('../db/transaction');
const { logAudit } = require('../db/audit');
const { validateEntry, validateLines } = require('../accountingValidation');

const lineSelect = `l.id, l.description, l.debit::text AS debit, l.credit::text AS credit, l.line_order AS "lineOrder",
  a.id AS "accountId", a.account_code AS "accountCode", a.account_name AS "accountName", a.type AS "accountType",
  aa.id AS "analyticAccountId", aa.name AS "analyticAccountName"`;
const entrySelect = `e.id, e.entry_number AS "entryNumber", e.entry_date AS "entryDate", e.reference, e.description, e.status,
  e.created_at AS "createdAt", e.updated_at AS "updatedAt", e.posted_at AS "postedAt", e.cancelled_at AS "cancelledAt",
  j.id AS "journalId", j.name AS "journalName", j.type AS "journalType",
  creator.login_id AS "createdBy", poster.login_id AS "postedBy", canceller.login_id AS "cancelledBy"`;

function totals(lines) {
  return lines.reduce((result, line) => ({ debit: result.debit + Number(line.debit), credit: result.credit + Number(line.credit) }), { debit: 0, credit: 0 });
}
function isBalanced(lines) { const total = totals(lines); return total.debit === total.credit && total.debit > 0; }
function serializeEntry(row, lines = []) {
  const total = totals(lines);
  return { ...row, lines, totalDebit: total.debit.toFixed(2), totalCredit: total.credit.toFixed(2), balanced: total.debit === total.credit };
}

async function assertReferences(db, journalId, lines) {
  const journal = await db.query('SELECT id, status FROM journals WHERE id = $1', [journalId]);
  if (!journal.rowCount) throw Object.assign(new Error('Journal does not exist.'), { status: 400 });
  if (journal.rows[0].status !== 'ACTIVE') throw Object.assign(new Error('Journal is archived and cannot be used.'), { status: 400 });
  for (const line of lines) {
    const account = await db.query('SELECT id, status FROM accounts WHERE id = $1', [line.accountId]);
    if (!account.rowCount) throw Object.assign(new Error('Account does not exist.'), { status: 400 });
    if (account.rows[0].status !== 'ACTIVE') throw Object.assign(new Error('Account is archived and cannot be used.'), { status: 400 });
    if (line.analyticAccountId) {
      const analytic = await db.query('SELECT id, status FROM analytic_accounts WHERE id = $1', [line.analyticAccountId]);
      if (!analytic.rowCount || analytic.rows[0].status !== 'ACTIVE') throw Object.assign(new Error('Analytic account does not exist or is archived.'), { status: 400 });
    }
  }
}
async function assertOpenFiscalPeriod(db, entryDate) {
  const periods = await db.query('SELECT status FROM fiscal_periods WHERE $1 BETWEEN start_date AND end_date ORDER BY start_date DESC LIMIT 1', [entryDate]);
  const configured = await db.query('SELECT 1 FROM fiscal_periods LIMIT 1');
  if (configured.rowCount && (!periods.rowCount || periods.rows[0].status !== 'OPEN')) throw Object.assign(new Error('Financial postings are allowed only in an open fiscal period.'), { status: 400 });
}

async function getEntry(db, id) {
  const header = await db.query(`SELECT ${entrySelect} FROM journal_entries e JOIN journals j ON j.id=e.journal_id
    JOIN users creator ON creator.id=e.created_by_id LEFT JOIN users poster ON poster.id=e.posted_by_id LEFT JOIN users canceller ON canceller.id=e.cancelled_by_id WHERE e.id=$1`, [id]);
  if (!header.rowCount) return null;
  const lines = await db.query(`SELECT ${lineSelect} FROM journal_entry_lines l JOIN accounts a ON a.id=l.account_id LEFT JOIN analytic_accounts aa ON aa.id=l.analytic_account_id WHERE l.journal_entry_id=$1 ORDER BY l.line_order`, [id]);
  return serializeEntry(header.rows[0], lines.rows);
}

// Callers that build entryDate from a DB row (Sales/Purchase posting) get a
// JS Date back from `pg` for DATE columns, not a "YYYY-MM-DD" string — but
// validateEntry (and every UI date input) expects a plain date string.
// Normalize once here so every caller of createDraftEntry works the same way.
function toDateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

async function createDraftEntry(db, userId, rawBody) {
  const body = { ...rawBody, entryDate: toDateOnly(rawBody.entryDate) };
  const errors = validateEntry(body); if (errors.length) throw Object.assign(new Error(errors[0]), { status: 400, errors });
  return withTransaction(db, async (tx) => {
    await assertReferences(tx, body.journalId, body.lines);
    const number = await tx.query("SELECT nextval('journal_entry_number_seq') AS n");
    const id = randomUUID(); const entryNumber = `JE-${String(number.rows[0].n).padStart(6, '0')}`;
    await tx.query(`INSERT INTO journal_entries (id,entry_number,journal_id,entry_date,reference,description,created_by_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, entryNumber, body.journalId, body.entryDate, body.reference?.trim() || null, body.description?.trim() || null, userId]);
    for (const [index, line] of body.lines.entries()) await tx.query(`INSERT INTO journal_entry_lines (id,journal_entry_id,account_id,description,debit,credit,analytic_account_id,line_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [randomUUID(), id, line.accountId, line.description?.trim() || null, line.debit || '0', line.credit || '0', line.analyticAccountId || null, index + 1]);
    await logAudit(tx, { userId, action: 'JOURNAL_ENTRY_CREATED', entity: 'JournalEntry', entityId: id, metadata: { entryNumber } });
    return getEntry(tx, id);
  });
}

async function updateDraftEntry(db, id, userId, body) {
  const errors = validateEntry(body, { partial: true }); if (errors.length) throw Object.assign(new Error(errors[0]), { status: 400, errors });
  return withTransaction(db, async (tx) => {
    const current = await tx.query('SELECT status, journal_id FROM journal_entries WHERE id=$1 FOR UPDATE', [id]);
    if (!current.rowCount) throw Object.assign(new Error('Journal Entry not found.'), { status: 404 });
    if (current.rows[0].status !== 'DRAFT') throw Object.assign(new Error('Posted Journal Entries cannot be edited.'), { status: 400 });
    const journalId = body.journalId || current.rows[0].journal_id;
    if (body.lines) await assertReferences(tx, journalId, body.lines); else await assertReferences(tx, journalId, []);
    const fields=[]; const params=[]; const add=(key,value)=>{params.push(value);fields.push(`${key}=$${params.length}`);};
    if (body.journalId !== undefined) add('journal_id', body.journalId); if (body.entryDate !== undefined) add('entry_date', body.entryDate); if (body.reference !== undefined) add('reference', body.reference?.trim() || null); if (body.description !== undefined) add('description', body.description?.trim() || null);
    if (fields.length) { fields.push('updated_at=NOW()'); params.push(id); await tx.query(`UPDATE journal_entries SET ${fields.join(',')} WHERE id=$${params.length}`, params); }
    if (body.lines) { await tx.query('DELETE FROM journal_entry_lines WHERE journal_entry_id=$1', [id]); for (const [index,line] of body.lines.entries()) await tx.query(`INSERT INTO journal_entry_lines (id,journal_entry_id,account_id,description,debit,credit,analytic_account_id,line_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [randomUUID(),id,line.accountId,line.description?.trim()||null,line.debit||'0',line.credit||'0',line.analyticAccountId||null,index+1]); }
    await logAudit(tx,{userId,action:'JOURNAL_ENTRY_UPDATED',entity:'JournalEntry',entityId:id,metadata:{fields:Object.keys(body)}}); return getEntry(tx,id);
  });
}

async function postEntry(db, id, userId) { return withTransaction(db, async (tx) => { const entry=await getEntry(tx,id); if(!entry) throw Object.assign(new Error('Journal Entry not found.'),{status:404}); if(entry.status!=='DRAFT') throw Object.assign(new Error('Only Draft Journal Entries can be posted.'),{status:400}); const errors=validateLines(entry.lines); if(errors.length || !isBalanced(entry.lines)) throw Object.assign(new Error('Journal Entry cannot be posted because total debits and credits do not match.'),{status:400}); await assertReferences(tx,entry.journalId,entry.lines); await assertOpenFiscalPeriod(tx,entry.entryDate); await tx.query("UPDATE journal_entries SET status='POSTED', posted_by_id=$1, posted_at=NOW(), updated_at=NOW() WHERE id=$2",[userId,id]); await logAudit(tx,{userId,action:'JOURNAL_ENTRY_POSTED',entity:'JournalEntry',entityId:id,metadata:{entryNumber:entry.entryNumber}}); return getEntry(tx,id); }); }
async function cancelDraft(db,id,userId) { return withTransaction(db,async(tx)=>{const result=await tx.query("UPDATE journal_entries SET status='CANCELLED',cancelled_by_id=$1,cancelled_at=NOW(),updated_at=NOW() WHERE id=$2 AND status='DRAFT' RETURNING id",[userId,id]);if(!result.rowCount) throw Object.assign(new Error('Only Draft Journal Entries can be cancelled.'),{status:400});await logAudit(tx,{userId,action:'JOURNAL_ENTRY_CANCELLED',entity:'JournalEntry',entityId:id});return getEntry(tx,id);}); }

module.exports={createDraftEntry,updateDraftEntry,postEntry,cancelDraft,getEntry,serializeEntry,entrySelect,lineSelect};
