const app = require('./app');
const env = require('./config/env');
const db = require('./config/db');

const PORT = env.PORT || 5000;

async function startServer() {
  try {
    // Quick DB check
    await db.query('SELECT 1');
  } catch (err) {
    console.error('\n======================================================');
    console.error('DATABASE STARTUP WARNING:');
    console.error(`Could not verify database connection at ${env.DB_HOST}:${env.DB_PORT}.`);
    console.error('Please verify DB_PASSWORD and DB_PORT in backend/.env.');
    console.error('======================================================\n');
  }

  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

startServer();
