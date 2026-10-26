const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
if (env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

function generateEmailHtml({ title, message, actionText, actionUrl }) {
  const url = actionUrl || env.FRONTEND_URL;
  const button = actionText ? `
    <div style="margin-top: 24px; text-align: center;">
      <a href="${url}" style="background-color: #2563EB; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
        ${actionText}
      </a>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F4F7FB; margin: 0; padding: 30px;">
      <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 14px -6px rgba(15,23,42,0.10);">
        <div style="background: #2563EB; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">Connected Panchayat</h1>
          <p style="color: #DBEAFE; margin: 6px 0 0 0; font-size: 13px;">Bridging Panchayats • Empowering Citizens</p>
        </div>
        <div style="padding: 28px;">
          <h2 style="color: #0F172A; margin: 0 0 16px 0; font-size: 18px;">${title}</h2>
          <div style="color: #475569; font-size: 15px; line-height: 1.6; white-space: pre-line;">
            ${message}
          </div>
          ${button}
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0; text-align: center; color: #94A3B8; font-size: 12px;">
            <p style="margin: 0;">Connected Panchayat — Kerala Academic Project</p>
            <p style="margin: 4px 0 0 0;">This is an automated system notification. Please do not reply directly.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Sends an email or logs to console
 * Returns { status: 'SENT' | 'LOGGED' | 'FAILED' }
 */
async function sendEmail({ to, subject, title, message, actionText, actionUrl }) {
  if (!to) {
    return { status: 'FAILED', error: 'No recipient email specified' };
  }

  const html = generateEmailHtml({
    title: title || subject,
    message,
    actionText,
    actionUrl
  });

  if (!env.SMTP_HOST || !transporter) {
    console.log('\n--- [EMAIL CONSOLE MODE] ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Title: ${title || subject}`);
    console.log(`Message:\n${message}`);
    console.log('-----------------------------\n');
    return { status: 'LOGGED' };
  }

  try {
    await transporter.sendMail({
      from: env.MAIL_FROM,
      to,
      subject,
      text: message,
      html
    });
    return { status: 'SENT' };
  } catch (err) {
    console.error('Failed to send email via SMTP:', err.message);
    return { status: 'FAILED', error: err.message };
  }
}

module.exports = {
  sendEmail,
  generateEmailHtml
};
