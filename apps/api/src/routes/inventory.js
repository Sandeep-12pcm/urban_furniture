const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const inventory = require('../services/inventoryService');
const { sendServiceError } = require('../lib/serviceError');
function inventoryRoutes(db) {
    const r = express.Router(), view = [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];
    r.get('/inventory', ...view, async (req, res, next) => { try { res.json({ ...await inventory.list(db, req.query), summary: await inventory.summary(db) }); } catch (e) { next(e); } });
    r.get('/inventory/movements', ...view, async (req, res, next) => { try { res.json(await inventory.movements(db, req.query)); } catch (e) { next(e); } });
    r.post('/inventory/adjustments', authenticate(db), authorize('ADMIN'), async (req, res) => { try { res.status(201).json(await inventory.adjustment(db, req.user.id, req.body)); } catch (e) { sendServiceError(res, e); } });
    r.get('/inventory/:productId/movements', ...view, async (req, res, next) => { try { res.json(await inventory.movements(db, req.query, req.params.productId)); } catch (e) { next(e); } });
    r.get('/inventory/:productId', ...view, async (req, res, next) => { try { const x = await inventory.detail(db, req.params.productId); if (!x) return res.status(404).json({ message: 'Product not found.' }); res.json({ inventory: x }); } catch (e) { next(e); } }); return r;
}
module.exports = { inventoryRoutes };
