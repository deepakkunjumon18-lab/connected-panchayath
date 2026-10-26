const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env or .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredKeys = [
  'JWT_SECRET',
  'KEY_ENCRYPTION_SECRET'
];

for (const key of requiredKeys) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    console.error(`Please configure ${key} in backend/.env`);
    process.exit(1);
  }
}

if (process.env.KEY_ENCRYPTION_SECRET && process.env.KEY_ENCRYPTION_SECRET.length < 32) {
  console.error('FATAL: KEY_ENCRYPTION_SECRET must be at least 32 characters long.');
  process.exit(1);
}

module.exports = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  DB_NAME: process.env.DB_NAME || 'connected_panchayat',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  KEY_ENCRYPTION_SECRET: process.env.KEY_ENCRYPTION_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM: process.env.MAIL_FROM || 'Connected Panchayat <no-reply@connectedpanchayat.test>',
  DEMO_CITIZEN_EMAIL: process.env.DEMO_CITIZEN_EMAIL || ''
};
