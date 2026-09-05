import { Plus, Trash2 } from 'lucide-react';
import { Input } from './Input.jsx';
import { Select } from './Select.jsx';
import { Table, Td, Th, Tr } from './Table.jsx';
import { formatMoney } from '../lib/format.js';

const TAX_RATES = [0, 5, 12, 18, 28];

export function emptyLine() {
  return { productId: '', description: '', quantity: '1', unitPrice: '', taxRate: '18' };
}

function lineTotals(line) {
  const quantity = Number(line.quantity) || 0;
  const unitPrice = Number(line.unitPrice) || 0;
  const taxRate = Number(line.taxRate) || 0;
  const subtotal = quantity * unitPrice;
  const tax = subtotal * (taxRate / 100);
  return { subtotal, tax, total: subtotal + tax };
}

export function computeTotals(lines) {
  return lines.reduce(
    (acc, line) => {
      const t = lineTotals(line);
      return { subtotal: acc.subtotal + t.subtotal, tax: acc.tax + t.tax, total: acc.total + t.total };
    },
    { subtotal: 0, tax: 0, total: 0 },
  );
}

export function LineItemsEditor({ lines, onChange, products, disabled = false }) {
  function update(index, field, value) {
    const next = lines.map((line, i) => {
      if (i !== index) return line;
      if (field === 'productId') {
        const product = products.find((p) => p.id === value);
        return { ...line, productId: value, unitPrice: product ? String(product.salesPrice ?? product.purchasePrice ?? '') : line.unitPrice };
      }
      return { ...line, [field]: value };
    });
    onChange(next);
  }

  function addLine() {
    onChange([...lines, emptyLine()]);
  }

  function removeLine(index) {
    onChange(lines.filter((_, i) => i !== index));
  }

  const totals = computeTotals(lines);

  return (
    <div>
      <Table minWidth="720px">
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Qty</Th>
            <Th>Unit Price</Th>
            <Th>Tax %</Th>
            <Th>Line Total</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const t = lineTotals(line);
            return (
              <Tr key={index}>
                <Td first>
                  <Select disabled={disabled} value={line.productId} onChange={(e) => update(index, 'productId', e.target.value)}>
                    <option value="">Select a product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <Input disabled={disabled} type="number" min="0.01" step="0.01" inputMode="decimal" className="w-20" value={line.quantity} onChange={(e) => update(index, 'quantity', e.target.value)} />
                </Td>
                <Td>
                  <Input disabled={disabled} type="number" min="0" step="0.01" inputMode="decimal" className="w-28" value={line.unitPrice} onChange={(e) => update(index, 'unitPrice', e.target.value)} />
                </Td>
                <Td>
                  {/* Values loaded from the API arrive as NUMERIC text ("18.00"), which
                      won't strictly match a plain option value like 18 — normalize so the
                      select doesn't silently fall back to its first option (0%). */}
                  <Select disabled={disabled} className="w-24" value={String(Number(line.taxRate) || 0)} onChange={(e) => update(index, 'taxRate', e.target.value)}>
                    {TAX_RATES.map((rate) => (
                      <option key={rate} value={rate}>{rate}%</option>
                    ))}
                  </Select>
                </Td>
                <Td className="font-semibold">{formatMoney(t.total)}</Td>
                <Td last>
                  {!disabled && lines.length > 1 && (
                    <button type="button" aria-label="Remove line" className="text-danger" onClick={() => removeLine(index)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>

      {!disabled && (
        <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-indigo" onClick={addLine}>
          <Plus className="h-4 w-4" />
          Add Line
        </button>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-6 rounded-xl bg-page p-4 text-sm font-semibold">
        <span>Subtotal {formatMoney(totals.subtotal)}</span>
        <span>Tax {formatMoney(totals.tax)}</span>
        <span className="text-ink">Total {formatMoney(totals.total)}</span>
      </div>
    </div>
  );
}
