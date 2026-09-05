const { Pool, types } = require('pg');
const { config } = require('../config');

// PostgreSQL DATE (OID 1082) is parsed by `pg` into a JS Date constructed in
// the SERVER's local timezone at midnight. Once that Date is serialized
// (JSON.stringify → toISOString, or reused as a query parameter), it's
// converted to UTC and silently shifts back a calendar day for any timezone
// ahead of UTC (e.g. IST) — corrupting order/invoice/due/period dates and
// the accounting entry date derived from them. Every DATE column in this
// app is a plain calendar date with no time component, so return the raw
// "YYYY-MM-DD" text pg already received from the server instead.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: config.databaseUrl,
});

module.exports = { pool };
