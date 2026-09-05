const { validateEntry, validateLines } = require('../src/accountingValidation');

const debit = { accountId: '11111111-1111-1111-1111-111111111111', debit: '100.00', credit: '0.00' };
const credit = { accountId: '22222222-2222-2222-2222-222222222222', debit: '0.00', credit: '100.00' };

describe('accounting validation', () => {
  test('accepts a two-line debit and credit entry', () => {
    expect(validateEntry({ journalId: 'journal', entryDate: '2026-09-05', lines: [debit, credit] })).toEqual([]);
  });
  test('requires at least two lines and both sides', () => {
    expect(validateLines([debit])).toContain('Journal Entry must contain at least two lines.');
    expect(validateLines([debit, { ...debit, accountId: 'other' }])).toContain('Journal Entry must contain at least one debit and one credit.');
  });
  test('rejects zero, negative syntax, and both-sided lines', () => {
    expect(validateLines([{ ...debit, debit: '0.00' }, credit]).length).toBeGreaterThan(0);
    expect(validateLines([{ ...debit, debit: '10.00', credit: '10.00' }, credit]).length).toBeGreaterThan(0);
    expect(validateLines([{ ...debit, debit: '-1.00' }, credit]).length).toBeGreaterThan(0);
  });
});
