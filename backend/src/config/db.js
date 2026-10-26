const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  timezone: '+00:00',
  dateStrings: true
});

// Helper for parameterised queries
async function query(sql, params = []) {
  try {
    const [rows, fields] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ECONNREFUSED') {
      console.error('\n======================================================');
      console.error('DATABASE CONNECTION ERROR:');
      console.error(`Could not connect to MySQL at ${env.DB_HOST}:${env.DB_PORT} as user '${env.DB_USER}'.`);
      console.error('Please check that MySQL is running and fix DB_PASSWORD in backend/.env.');
      console.error('======================================================\n');
    }
    throw err;
  }
}

// Transaction helper
async function withTransaction(fn) {
  let conn;
  try {
    conn = await pool.getConnection();
  } catch (err) {
    if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ECONNREFUSED') {
      console.error('\n======================================================');
      console.error('DATABASE CONNECTION ERROR:');
      console.error(`Could not connect to MySQL at ${env.DB_HOST}:${env.DB_PORT} as user '${env.DB_USER}'.`);
      console.error('Please check that MySQL is running and fix DB_PASSWORD in backend/.env.');
      console.error('======================================================\n');
    }
    throw err;
  }

  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  pool,
  query,
  withTransaction
};
