const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function setup() {
  console.log(`Connecting to MySQL server at ${env.DB_HOST}:${env.DB_PORT} as ${env.DB_USER}...`);
  let connection;
  try {
    connection = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      multipleStatements: true
    });
  } catch (err) {
    console.error('\n======================================================');
    console.error('DATABASE SETUP ERROR: Could not connect to MySQL server.');
    console.error(`Host: ${env.DB_HOST}:${env.DB_PORT}, User: ${env.DB_USER}`);
    console.error('Reason: ' + err.message);
    console.error('Please check that MySQL is running and fix DB_PASSWORD in backend/.env.');
    console.error('======================================================\n');
    process.exit(1);
  }

  try {
    const schemaPath = path.resolve(__dirname, '../sql/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema.sql...');
    await connection.query(sql);

    // Verify tables
    const [tables] = await connection.query('SHOW TABLES FROM connected_panchayat');
    console.log(`Created ${tables.length} tables in database 'connected_panchayat'.`);
    console.log('Database ready');
  } catch (err) {
    console.error('Error executing schema.sql:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  setup().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = setup;
