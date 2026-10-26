const fs = require('fs');
const path = require('path');
const { generateEmailHtml } = require('../src/services/email.service');
const env = require('../src/config/env');

const previewDir = path.join(__dirname, '../storage/mail-preview');
if (!fs.existsSync(previewDir)) {
  fs.mkdirSync(previewDir, { recursive: true });
}

const templates = [
  {
    fileName: '1-new-verification-request.html',
    title: 'New Verification Request: CP-2026-0001',
    message: `A new verification request CP-2026-0001 has been dispatched from Kollam Grama Panchayat for Sasidharan K (Father of applicant Akhil K S) for EWS Certificate.\n\nPlease inspect your local Panchayat registers and record your digitally signed decision before the due date.`,
    actionText: 'Review Verification Request',
    actionUrl: `${env.FRONTEND_URL}/login`
  },
  {
    fileName: '2-verification-response.html',
    title: 'Verification Response: CP-2026-0001',
    message: `Kottarakara Grama Panchayat Secretary Deepak Kunjumon has APPROVED and digitally signed verification request CP-2026-0001 for Sasidharan K (Father).\n\nRemarks: Verified against Ward 4 birth and residence registers. Family resides here.`,
    actionText: 'View Application Workspace',
    actionUrl: `${env.FRONTEND_URL}/login`
  },
  {
    fileName: '3-urgent-reminder.html',
    title: 'Urgent Reminder: Verification Request CP-2026-0001 Pending',
    message: `This is an official reminder from Kollam Grama Panchayat regarding pending verification request CP-2026-0001 for Sasidharan K (Father).\n\nThe due date for this verification is 24/10/2026. Under Kerala service standards, please verify and submit your response promptly.`,
    actionText: 'Open Verification Request',
    actionUrl: `${env.FRONTEND_URL}/login`
  },
  {
    fileName: '4-application-rejected.html',
    title: 'Application Rejected: EWS-2026-0001',
    message: `Your application EWS-2026-0001 for EWS Certificate has been rejected by Kollam Grama Panchayat.\n\nReason: Declared family income exceeds the prescribed EWS ceiling as per verified revenue records.`,
    actionText: 'Check Application Status',
    actionUrl: `${env.FRONTEND_URL}/login`
  },
  {
    fileName: '5-certificate-issued.html',
    title: 'Your EWS Certificate is ready',
    message: `Your certificate has been issued by Kollam Grama Panchayat. Log in to Connected Panchayat and open My Certificates to download it.\n\nCertificate Number: CERT-KLM-2026-00001\nVerification Code: A7B2-9F4X-3K8M`,
    actionText: 'Download Certificate',
    actionUrl: `${env.FRONTEND_URL}/login`
  }
];

console.log('Generating email previews into backend/storage/mail-preview/ ...');

templates.forEach(({ fileName, title, message, actionText, actionUrl }) => {
  const html = generateEmailHtml({ title, message, actionText, actionUrl });
  const outPath = path.join(previewDir, fileName);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`✓ Generated: ${fileName}`);
});

console.log(`\nAll 5 email previews successfully created in: ${previewDir}`);
