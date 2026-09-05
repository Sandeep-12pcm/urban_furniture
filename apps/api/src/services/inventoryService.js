const { randomUUID } = require('crypto');
const { withTransaction } = require('../db/transaction');
const { logAudit } = require('../db/audit');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

const tracked = async (tx, productId, active = false) => {
  const r = await tx.query(`SELECT id,name,type,status FROM products WHERE id=$1${active ? " AND status='ACTIVE'" : ''} FOR UPDATE`, [productId]);
  if (!r.rowCount) throw fail(active ? 'Product does not exist or is archived.' : 'Product not found.', 404);
  return r.rows[0];
};
async function lockStock(tx, productId) {
  await tx.query('INSERT INTO inventory_stock (id,product_id) VALUES ($1,$2) ON CONFLICT (product_id) DO NOTHING', [randomUUID(), productId]);
  return (await tx.query('SELECT * FROM inventory_stock WHERE product_id=$1 FOR UPDATE', [productId])).rows[0];
}
async function record(tx, { productId, type, quantity, unitCost = null, referenceType, referenceId = null, movementDate, notes = null, userId, active = false }) {
  const product = await tracked(tx, productId, active);
  if (product.type !== 'GOODS') return null;
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0) throw fail('Stock quantity must be greater than zero.');
  const stock = await lockStock(tx, productId);
  const isIn = type === 'STOCK_IN' || type === 'ADJUSTMENT_IN';
  if (!isIn && Number(stock.quantity) < q) throw fail(`Insufficient stock for ${product.name}. Available: ${stock.quantity}.`);
  const nextQuantity = isIn ? Number(stock.quantity) + q : Number(stock.quantity) - q;
  const cost = unitCost === null ? Number(stock.average_cost) : Number(unitCost);
  const nextCost = isIn && unitCost !== null && nextQuantity > 0
    ? ((Number(stock.quantity) * Number(stock.average_cost)) + (q * cost)) / nextQuantity
    : Number(stock.average_cost);
  const duplicate = referenceId && await tx.query('SELECT id FROM inventory_movements WHERE product_id=$1 AND movement_type=$2 AND reference_type=$3 AND reference_id=$4', [productId, type, referenceType, referenceId]);
  if (duplicate?.rowCount) return null;
  const movementId = randomUUID();
  await tx.query(`INSERT INTO inventory_movements (id,product_id,movement_type,quantity,unit_cost,reference_type,reference_id,movement_date,notes,created_by_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [movementId, productId, type, q, cost, referenceType, referenceId, movementDate, notes, userId]);
  await tx.query('UPDATE inventory_stock SET quantity=$1,average_cost=$2,updated_at=NOW() WHERE product_id=$3', [nextQuantity, nextCost, productId]);
  await logAudit(tx, { userId, action: type === 'STOCK_IN' ? 'STOCK_IN_CREATED' : type === 'STOCK_OUT' ? 'STOCK_OUT_CREATED' : 'INVENTORY_ADJUSTMENT_CREATED', entity: 'InventoryMovement', entityId: movementId, metadata: { productId, quantity: q, referenceType, referenceId, notes } });
  return movementId;
}
function aggregate(lines) { return Object.values(lines.reduce((out, line) => { const x = out[line.productId] || { ...line, quantity: 0, totalCost: 0 }; x.quantity += Number(line.quantity); x.totalCost += Number(line.quantity) * Number(line.unitPrice || 0); out[line.productId] = x; return out; }, {})); }
async function receiveVendorBill(tx, bill, userId) { for (const line of aggregate(bill.items)) await record(tx, { productId: line.productId, type: 'STOCK_IN', quantity: line.quantity, unitCost: line.totalCost / line.quantity, referenceType: 'VENDOR_BILL', referenceId: bill.id, movementDate: bill.invoiceDate, notes: `Vendor Bill ${bill.billNumber}`, userId }); }
async function fulfillCustomerInvoice(tx, invoice, userId) { for (const line of aggregate(invoice.items)) await record(tx, { productId: line.productId, type: 'STOCK_OUT', quantity: line.quantity, referenceType: 'CUSTOMER_INVOICE', referenceId: invoice.id, movementDate: invoice.invoiceDate, notes: `Customer Invoice ${invoice.invoiceNumber}`, userId }); }
async function list(db, query) {
  const page = Math.max(1, Number(query.page) || 1), limit = Math.min(100, Math.max(1, Number(query.limit) || 20)), params = [], where = ["p.type='GOODS'"];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  if (query.search) add('lower(p.name) LIKE ?', `%${String(query.search).toLowerCase()}%`);
  if (query.status === 'OUT_OF_STOCK') where.push('COALESCE(s.quantity,0)=0'); else if (query.status === 'LOW_STOCK') where.push('COALESCE(s.quantity,0)>0 AND COALESCE(s.quantity,0)<=5'); else if (query.status === 'IN_STOCK') where.push('COALESCE(s.quantity,0)>5');
  const condition = `WHERE ${where.join(' AND ')}`;
  const count = await db.query(`SELECT COUNT(*)::int total FROM products p LEFT JOIN inventory_stock s ON s.product_id=p.id ${condition}`, params);
  const rows = await db.query(`SELECT p.id,p.name,p.type,p.status,COALESCE(s.quantity,0)::text quantity,COALESCE(s.average_cost,0)::text AS "averageCost",(COALESCE(s.quantity,0)*COALESCE(s.average_cost,0))::text AS "stockValue",CASE WHEN COALESCE(s.quantity,0)=0 THEN 'OUT_OF_STOCK' WHEN COALESCE(s.quantity,0)<=5 THEN 'LOW_STOCK' ELSE 'IN_STOCK' END AS "stockStatus" FROM products p LEFT JOIN inventory_stock s ON s.product_id=p.id ${condition} ORDER BY p.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit]);
  return { inventory: rows.rows, pagination: { page, limit, total: count.rows[0].total, totalPages: Math.ceil(count.rows[0].total / limit) } };
}
async function detail(db, productId) { const r = await db.query(`SELECT p.id,p.name,p.type,p.status,COALESCE(s.quantity,0)::text quantity,COALESCE(s.average_cost,0)::text AS "averageCost",(COALESCE(s.quantity,0)*COALESCE(s.average_cost,0))::text AS "stockValue" FROM products p LEFT JOIN inventory_stock s ON s.product_id=p.id WHERE p.id=$1`, [productId]); if (!r.rowCount) return null; return r.rows[0]; }
async function movements(db, query, productId = null) { const page=Math.max(1,Number(query.page)||1),limit=Math.min(100,Math.max(1,Number(query.limit)||20)),params=[],where=[]; const add=(sql,v)=>{params.push(v);where.push(sql.replace('?',`$${params.length}`));}; if(productId)add('m.product_id=?',productId); if(query.productId)add('m.product_id=?',query.productId); if(query.movementType)add('m.movement_type=?',query.movementType); if(query.dateFrom)add('m.movement_date>=?',query.dateFrom); if(query.dateTo)add('m.movement_date<=?',query.dateTo); if(query.search){const term=`%${String(query.search).toLowerCase()}%`;params.push(term);const productParam=`$${params.length}`;params.push(term);where.push(`(lower(p.name) LIKE ${productParam} OR lower(m.reference_type) LIKE $${params.length})`);} const condition=where.length?`WHERE ${where.join(' AND ')}`:''; const count=await db.query(`SELECT COUNT(*)::int total FROM inventory_movements m JOIN products p ON p.id=m.product_id ${condition}`,params); const rows=await db.query(`SELECT m.id,m.product_id AS "productId",p.name AS "productName",m.movement_type AS "movementType",m.quantity::text,m.unit_cost::text AS "unitCost",m.reference_type AS "referenceType",m.reference_id AS "referenceId",m.movement_date AS "movementDate",m.notes,u.login_id AS "createdBy" FROM inventory_movements m JOIN products p ON p.id=m.product_id JOIN users u ON u.id=m.created_by_id ${condition} ORDER BY m.movement_date DESC,m.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,limit,(page-1)*limit]); return { movements:rows.rows,pagination:{page,limit,total:count.rows[0].total,totalPages:Math.ceil(count.rows[0].total/limit)} }; }
async function summary(db) { return (await db.query(`SELECT COUNT(*)::int AS "totalProducts",COALESCE(SUM(s.quantity),0)::text AS "totalUnits",COUNT(*) FILTER (WHERE COALESCE(s.quantity,0)>0 AND COALESCE(s.quantity,0)<=5)::int AS "lowStockProducts",COUNT(*) FILTER (WHERE COALESCE(s.quantity,0)=0)::int AS "outOfStockProducts",COALESCE(SUM(s.quantity*s.average_cost),0)::text AS "inventoryValue" FROM products p LEFT JOIN inventory_stock s ON s.product_id=p.id WHERE p.type='GOODS'`)).rows[0]; }
async function adjustment(db,userId,body) { const type=body.direction === 'IN' ? 'ADJUSTMENT_IN' : body.direction === 'OUT' ? 'ADJUSTMENT_OUT' : null; if(!body.productId||!type||!body.reason?.trim()) throw fail('Product, adjustment direction, and reason are required.'); return withTransaction(db, async tx => { const id=await record(tx,{productId:body.productId,type,quantity:body.quantity,unitCost:body.unitCost ?? null,referenceType:'MANUAL_ADJUSTMENT',movementDate:body.movementDate || new Date().toISOString().slice(0,10),notes:`${body.reason.trim()}${body.notes ? ` — ${body.notes.trim()}` : ''}`,userId,active:true}); return { movementId:id, inventory:await detail(tx,body.productId) }; }); }
module.exports={receiveVendorBill,fulfillCustomerInvoice,list,detail,movements,summary,adjustment};
