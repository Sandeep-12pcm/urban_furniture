const { requiredString } = require('./validation');

function decimal(value) {
  if (typeof value === 'number') value = String(value);
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  return value.trim();
}

function validateLines(lines) {
  const errors = [];
  if (!Array.isArray(lines) || lines.length < 2) return ['Journal Entry must contain at least two lines.'];
  let hasDebit = false; let hasCredit = false;
  lines.forEach((line, index) => {
    const prefix = `Line ${index + 1}`;
    if (!requiredString(line?.accountId, `${prefix} account`)) {
      // ok
    } else errors.push(`${prefix} account is required.`);
    const debit = decimal(line?.debit ?? '0');
    const credit = decimal(line?.credit ?? '0');
    if (debit === null || credit === null) errors.push(`${prefix} debit and credit must be valid non-negative amounts.`);
    else {
      const d = Number(debit); const c = Number(credit);
      if ((d > 0 && c > 0) || (d === 0 && c === 0)) errors.push(`${prefix} must have either a debit or a credit amount.`);
      if (d > 0) hasDebit = true;
      if (c > 0) hasCredit = true;
    }
  });
  if (!hasDebit || !hasCredit) errors.push('Journal Entry must contain at least one debit and one credit.');
  return errors;
}

function validateEntry(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.journalId !== undefined) {
    const error = requiredString(body.journalId, 'Journal'); if (error) errors.push(error);
  }
  if (!partial || body.entryDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.entryDate || ''))) errors.push('Date is required.');
  }
  if (!partial || body.lines !== undefined) errors.push(...validateLines(body.lines));
  return errors;
}
module.exports = { validateEntry, validateLines };
