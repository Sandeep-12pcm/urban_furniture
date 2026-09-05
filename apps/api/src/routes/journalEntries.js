const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { createDraftEntry, updateDraftEntry, postEntry, cancelDraft, getEntry, entrySelect } = require('../services/accountingService');
const { parsePagination, buildPaginationMeta } = require('../lib/pagination');
const { sendServiceError } = require('../lib/serviceError');

const accountingAccess = (db) => [authenticate(db), authorize('ADMIN', 'ACCOUNTANT')];
function queryText(params) { const query=new URLSearchParams(); Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')query.set(k,v);}); return query.toString(); }
function journalEntriesRoutes(db) {
 const router=express.Router(); const access=accountingAccess(db);
 router.get('/journal-entries',...access,async(req,res,next)=>{try{const {page,limit,offset}=parsePagination(req.query);const conditions=[];const params=[];const add=(column,value)=>{params.push(value);conditions.push(`${column}=$${params.length}`);};if(req.query.status)add('e.status',String(req.query.status).toUpperCase());if(req.query.journalId)add('e.journal_id',req.query.journalId);if(req.query.startDate){params.push(req.query.startDate);conditions.push(`e.entry_date >= $${params.length}`);}if(req.query.endDate){params.push(req.query.endDate);conditions.push(`e.entry_date <= $${params.length}`);}if(req.query.search){const value=`%${String(req.query.search).toLowerCase()}%`;params.push(value,value);conditions.push(`(lower(e.entry_number) LIKE $${params.length-1} OR lower(coalesce(e.reference,'')) LIKE $${params.length})`);}const where=conditions.length?`WHERE ${conditions.join(' AND ')}`:'';const count=await db.query(`SELECT COUNT(*)::int AS total FROM journal_entries e ${where}`,params);const rows=await db.query(`SELECT ${entrySelect}, COALESCE(SUM(l.debit),0)::text AS "totalDebit", COALESCE(SUM(l.credit),0)::text AS "totalCredit" FROM journal_entries e JOIN journals j ON j.id=e.journal_id JOIN users creator ON creator.id=e.created_by_id LEFT JOIN users poster ON poster.id=e.posted_by_id LEFT JOIN users canceller ON canceller.id=e.cancelled_by_id LEFT JOIN journal_entry_lines l ON l.journal_entry_id=e.id ${where} GROUP BY e.id,j.id,creator.login_id,poster.login_id,canceller.login_id ORDER BY e.entry_date DESC,e.entry_number DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,limit,offset]);return res.json({journalEntries:rows.rows.map(row=>({...row,balanced:row.totalDebit===row.totalCredit})),pagination:buildPaginationMeta({page,limit,total:count.rows[0].total})});}catch(e){next(e);}});
 router.get('/journal-entries/:id',...access,async(req,res,next)=>{try{const entry=await getEntry(db,req.params.id);if(!entry)return res.status(404).json({message:'Journal Entry not found.'});res.json({journalEntry:entry});}catch(e){next(e);}});
 router.post('/journal-entries',...access,async(req,res)=>{try{const entry=await createDraftEntry(db,req.user.id,req.body);res.status(201).json({journalEntry:entry});}catch(e){sendServiceError(res,e);}});
 router.patch('/journal-entries/:id',...access,async(req,res)=>{try{res.json({journalEntry:await updateDraftEntry(db,req.params.id,req.user.id,req.body)});}catch(e){sendServiceError(res,e);}});
 router.post('/journal-entries/:id/post',...access,async(req,res)=>{try{res.json({journalEntry:await postEntry(db,req.params.id,req.user.id)});}catch(e){sendServiceError(res,e);}});
 router.post('/journal-entries/:id/cancel',...access,async(req,res)=>{try{res.json({journalEntry:await cancelDraft(db,req.params.id,req.user.id)});}catch(e){sendServiceError(res,e);}});
 return router;
}
function accountingReportsRoutes(db) { const router=express.Router();const access=accountingAccess(db);
 router.get('/accounts/:id/balance',...access,async(req,res,next)=>{try{const account=await db.query('SELECT id,account_name AS "accountName",type AS "accountType" FROM accounts WHERE id=$1',[req.params.id]);if(!account.rowCount)return res.status(404).json({message:'Account not found.'});const sums=await db.query(`SELECT COALESCE(SUM(l.debit),0)::text AS debit,COALESCE(SUM(l.credit),0)::text AS credit FROM journal_entry_lines l JOIN journal_entries e ON e.id=l.journal_entry_id WHERE l.account_id=$1 AND e.status='POSTED'`,[req.params.id]);const s=sums.rows[0];res.json({accountId:account.rows[0].id,accountName:account.rows[0].accountName,accountType:account.rows[0].accountType,totalDebit:s.debit,totalCredit:s.credit,balance:(Number(s.debit)-Number(s.credit)).toFixed(2)});}catch(e){next(e);}});
 router.get('/accounts/:id/ledger', ...access, async (req, res, next) => {
   try {
     const params = [req.params.id];
     let where = "l.account_id=$1 AND e.status='POSTED'";
     for (const [field, column] of [['startDate', 'e.entry_date >='], ['endDate', 'e.entry_date <='], ['journalId', 'e.journal_id =']]) {
       if (req.query[field]) { params.push(req.query[field]); where += ` AND ${column} $${params.length}`; }
     }
     if (req.query.reference) { params.push(`%${String(req.query.reference).toLowerCase()}%`); where += ` AND lower(coalesce(e.reference,'')) LIKE $${params.length}`; }
     const rows = await db.query(`SELECT e.entry_date AS date,e.entry_number AS "entryNumber",e.reference,e.description,l.debit::text AS debit,l.credit::text AS credit,j.name AS "journalName" FROM journal_entry_lines l JOIN journal_entries e ON e.id=l.journal_entry_id JOIN journals j ON j.id=e.journal_id WHERE ${where} ORDER BY e.entry_date,e.entry_number,l.line_order`, params);
     let balance = 0;
     const ledger = rows.rows.map((row) => { balance += Number(row.debit) - Number(row.credit); return { ...row, balance: balance.toFixed(2) }; });
     return res.json({ ledger });
   } catch (error) { return next(error); }
 });
 router.get('/accounts/balances',...access,async(req,res,next)=>{try{const params=[];const conditions=[];if(req.query.type){params.push(req.query.type);conditions.push(`a.type=$${params.length}`);}if(req.query.status){params.push(req.query.status);conditions.push(`a.status=$${params.length}`);}const where=conditions.length?`WHERE ${conditions.join(' AND ')}`:'';const rows=await db.query(`SELECT a.id,a.account_code AS "accountCode",a.account_name AS "accountName",a.type,a.status,COALESCE(SUM(l.debit) FILTER (WHERE e.status='POSTED'),0)::text AS "totalDebit",COALESCE(SUM(l.credit) FILTER (WHERE e.status='POSTED'),0)::text AS "totalCredit" FROM accounts a LEFT JOIN journal_entry_lines l ON l.account_id=a.id LEFT JOIN journal_entries e ON e.id=l.journal_entry_id ${where} GROUP BY a.id ORDER BY a.account_code`,params);res.json({accounts:rows.rows.map(r=>({...r,balance:(Number(r.totalDebit)-Number(r.totalCredit)).toFixed(2)}))});}catch(e){next(e);}});
 router.get('/accounting/summary',...access,async(req,res,next)=>{try{const r=await db.query(`SELECT status,COUNT(*)::int AS count,COALESCE(SUM(total_debit),0)::text AS debit,COALESCE(SUM(total_credit),0)::text AS credit FROM (SELECT e.status,e.id,SUM(l.debit) AS total_debit,SUM(l.credit) AS total_credit FROM journal_entries e LEFT JOIN journal_entry_lines l ON l.journal_entry_id=e.id GROUP BY e.id) x GROUP BY status`);res.json({summary:r.rows});}catch(e){next(e);}}); return router; }
module.exports={journalEntriesRoutes,accountingReportsRoutes,queryText};
