const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const db = require('../src/config/db');
const env = require('../src/config/env');
const cryptoService = require('../src/services/crypto.service');

// Helper to create placeholder PDF files
function createSamplePdf(filePath, label) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(22).fillColor('#2563EB').text('Connected Panchayat', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).fillColor('#0F172A').text(`Sample document – ${label}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#64748B').text('Demo document generated for college project testing purposes.', { align: 'center' });
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function seed() {
  console.log('Seeding database: connected_panchayat...');

  // 1. Clear existing data in correct order with FK checks disabled
  console.log('Clearing old data...');
  const tables = [
    'audit_logs',
    'notifications',
    'certificate_verification_logs',
    'certificates',
    'application_timeline',
    'verification_requests',
    'application_documents',
    'application_parties',
    'applications',
    'certificate_types',
    'master_data',
    'sequences',
    'panchayat_officers',
    'citizens',
    'users',
    'panchayats',
    'roles'
  ];

  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) {
    await db.query(`TRUNCATE TABLE ${table}`);
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');

  // 2. Roles
  console.log('Seeding roles...');
  await db.query(`
    INSERT INTO roles (role_id, role_name, description) VALUES
    (1, 'CITIZEN', 'Citizen user of a specific panchayat'),
    (2, 'OFFICER', 'Panchayat Officer with cryptographic signing privileges'),
    (3, 'ADMIN', 'System Administrator with overall system oversight')
  `);

  // 3. Panchayats
  console.log('Seeding panchayats...');
  const panchayats = [
    { id: 1, code: 'KTR', name: 'Kottarakara GP', district: 'Kollam', address: 'Panchayat Office, Main Road, Kottarakara, Kollam - 691506', contact: '0474-2450230' },
    { id: 2, code: 'KLM', name: 'Kollam GP', district: 'Kollam', address: 'Panchayat Office, Collectorate Junction, Kollam - 691001', contact: '0474-2741122' },
    { id: 3, code: 'KDK', name: 'Kadakkal GP', district: 'Kollam', address: 'Panchayat Office, Market Junction, Kadakkal, Kollam - 691536', contact: '0474-2422240' },
    { id: 4, code: 'ANC', name: 'Anchal GP', district: 'Kollam', address: 'Panchayat Office, Main Junction, Anchal, Kollam - 691306', contact: '0474-2271230' },
    { id: 5, code: 'CHD', name: 'Chadayamangalam GP', district: 'Kollam', address: 'Panchayat Office, Chadayamangalam, Kollam - 691534', contact: '0474-2475220' },
    { id: 6, code: 'PTN', name: 'Pathanapuram GP', district: 'Kollam', address: 'Panchayat Office, Pathanapuram, Kollam - 691695', contact: '0474-2352210' }
  ];

  for (const p of panchayats) {
    await db.query(`
      INSERT INTO panchayats (panchayat_id, panchayat_code, panchayat_name, district, state, address, contact_no, status)
      VALUES (?, ?, ?, ?, 'Kerala', ?, ?, 'ACTIVE')
    `, [p.id, p.code, p.name, p.district, p.address, p.contact]);
  }

  // 4. Precompute password hashes
  const salt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash('Admin@123', salt);
  const officerHash = await bcrypt.hash('Officer@123', salt);
  const citizenHash = await bcrypt.hash('Citizen@123', salt);

  // 5. Admin User
  console.log('Seeding admin user...');
  const adminResult = await db.query(`
    INSERT INTO users (username, password_hash, email, mobile, role_id, status)
    VALUES ('admin', ?, 'admin@connectedpanchayat.test', '9000000001', 3, 'ACTIVE')
  `, [adminHash]);

  // 6. Officers
  console.log('Seeding officers with RSA keys...');
  const officerDefs = [
    { username: 'officer.kottarakara', name: 'Deepak Kunjumon', desig: 'Panchayat Secretary', empId: 'EMP-KTR-001', pid: 1, mobile: '9000000011' },
    { username: 'officer2.kottarakara', name: 'Meera Nair', desig: 'Assistant Secretary', empId: 'EMP-KTR-002', pid: 1, mobile: '9000000012' },
    { username: 'officer.kollam', name: 'Sreeja Menon', desig: 'Panchayat Secretary', empId: 'EMP-KLM-001', pid: 2, mobile: '9000000013' },
    { username: 'officer.kadakkal', name: 'Rajesh Kumar', desig: 'Panchayat Secretary', empId: 'EMP-KDK-001', pid: 3, mobile: '9000000014' },
    { username: 'officer.anchal', name: 'Fathima Beevi', desig: 'Panchayat Secretary', empId: 'EMP-ANC-001', pid: 4, mobile: '9000000015' },
    { username: 'officer.chadayamangalam', name: 'Anil Varghese', desig: 'Panchayat Secretary', empId: 'EMP-CHD-001', pid: 5, mobile: '9000000016' },
    { username: 'officer.pathanapuram', name: 'Latha Devi', desig: 'Panchayat Secretary', empId: 'EMP-PTN-001', pid: 6, mobile: '9000000017' }
  ];

  const officerMap = {}; // username -> { officer_id, user_id, publicKey, privateKey, fingerprint }

  for (const off of officerDefs) {
    const email = `${off.username}@connectedpanchayat.test`;
    const uRes = await db.query(`
      INSERT INTO users (username, password_hash, email, mobile, role_id, status)
      VALUES (?, ?, ?, ?, 2, 'ACTIVE')
    `, [off.username, officerHash, email, off.mobile]);
    const userId = uRes.insertId;

    const { publicKey, privateKey } = cryptoService.generateOfficerKeyPair();
    const fingerprint = cryptoService.publicKeyFingerprint(publicKey);
    const encryptedPrivKey = cryptoService.encryptPrivateKey(privateKey);

    const oRes = await db.query(`
      INSERT INTO panchayat_officers (
        user_id, panchayat_id, employee_id, designation, full_name, mobile, email,
        status, public_key, private_key_encrypted, key_fingerprint, key_created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, NOW())
    `, [userId, off.pid, off.empId, off.desig, off.name, off.mobile, email, publicKey, encryptedPrivKey, fingerprint]);

    officerMap[off.username] = {
      officer_id: oRes.insertId,
      user_id: userId,
      panchayat_id: off.pid,
      publicKey,
      privateKey,
      fingerprint,
      name: off.name,
      desig: off.desig,
      empId: off.empId
    };
  }

  // 7. Citizens
  console.log('Seeding citizens...');
  const akhilEmail = env.DEMO_CITIZEN_EMAIL || 'akhil@connectedpanchayat.test';
  const citizenDefs = [
    { username: '9876500001', name: 'Akhil K S', mobile: '9876500001', email: akhilEmail, pid: 2, gender: 'MALE', dob: '2002-03-24', aadhaar: '123456789012', address: 'Kalluvila, Kadayam P.O., Kollam - 691536' },
    { username: '9876500002', name: 'Anu Thomas', mobile: '9876500002', email: 'anu@connectedpanchayat.test', pid: 1, gender: 'FEMALE', dob: '2001-07-15', aadhaar: '234567890123', address: 'Thundil House, Kottarakara, Kollam - 691506' },
    { username: '9876500003', name: 'Rafiq Khan', mobile: '9876500003', email: 'rafiq@connectedpanchayat.test', pid: 3, gender: 'MALE', dob: '1999-11-05', aadhaar: '345678901234', address: 'Khan Manzil, Kadakkal, Kollam - 691536' }
  ];

  const citizenMap = {}; // mobile -> { citizen_id, user_id, ... }

  for (const c of citizenDefs) {
    const uRes = await db.query(`
      INSERT INTO users (username, password_hash, email, mobile, role_id, status)
      VALUES (?, ?, ?, ?, 1, 'ACTIVE')
    `, [c.username, citizenHash, c.email, c.mobile]);
    const userId = uRes.insertId;

    const cRes = await db.query(`
      INSERT INTO citizens (user_id, full_name, date_of_birth, gender, aadhaar_no, mobile, email, address, panchayat_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, c.name, c.dob, c.gender, c.aadhaar, c.mobile, c.email, c.address, c.pid]);

    citizenMap[c.mobile] = {
      citizen_id: cRes.insertId,
      user_id: userId,
      ...c
    };
  }

  // 8. Certificate Types
  console.log('Seeding certificate types...');
  const certTypes = [
    {
      code: 'EWS',
      name: 'EWS Certificate',
      desc: 'Economically Weaker Section Certificate for educational and employment reservation.',
      parties: ['FATHER', 'MOTHER'],
      docs: [
        { type: 'AADHAAR', label: 'Applicant Aadhaar', related_to: 'APPLICANT', mandatory: true },
        { type: 'RATION_CARD', label: 'Ration Card', related_to: 'APPLICANT', mandatory: true },
        { type: 'INCOME_PROOF', label: 'Income Proof', related_to: 'APPLICANT', mandatory: true },
        { type: 'PROPERTY_TAX', label: 'Property / Land Tax Receipt', related_to: 'APPLICANT', mandatory: true },
        { type: 'FATHER_ID', label: "Father's ID Proof", related_to: 'FATHER', mandatory: true },
        { type: 'MOTHER_ID', label: "Mother's ID Proof", related_to: 'MOTHER', mandatory: true }
      ]
    },
    {
      code: 'INCOME',
      name: 'Income Certificate',
      desc: 'Official proof of family income for scholarships, government welfare schemes and concessions.',
      parties: ['FATHER', 'MOTHER'],
      docs: [
        { type: 'AADHAAR', label: 'Applicant Aadhaar', related_to: 'APPLICANT', mandatory: true },
        { type: 'RATION_CARD', label: 'Ration Card', related_to: 'APPLICANT', mandatory: true },
        { type: 'INCOME_PROOF', label: 'Income Proof', related_to: 'APPLICANT', mandatory: true },
        { type: 'FATHER_ID', label: "Father's ID Proof", related_to: 'FATHER', mandatory: false },
        { type: 'MOTHER_ID', label: "Mother's ID Proof", related_to: 'MOTHER', mandatory: false }
      ]
    },
    {
      code: 'RESIDENCE',
      name: 'Residence Certificate',
      desc: 'Proof of residential address within the panchayat jurisdiction.',
      parties: [],
      docs: [
        { type: 'AADHAAR', label: 'Applicant Aadhaar', related_to: 'APPLICANT', mandatory: true },
        { type: 'RATION_CARD', label: 'Ration Card', related_to: 'APPLICANT', mandatory: true },
        { type: 'ELECTRICITY_BILL', label: 'Electricity / Water Bill', related_to: 'APPLICANT', mandatory: false }
      ]
    },
    {
      code: 'NATIVITY',
      name: 'Nativity Certificate',
      desc: 'Certificate establishing Kerala nativity for education and state government employment.',
      parties: ['FATHER'],
      docs: [
        { type: 'AADHAAR', label: 'Applicant Aadhaar', related_to: 'APPLICANT', mandatory: true },
        { type: 'SCHOOL_CERT', label: 'School / Birth Certificate', related_to: 'APPLICANT', mandatory: true },
        { type: 'FATHER_ID', label: "Father's ID Proof", related_to: 'FATHER', mandatory: true }
      ]
    },
    {
      code: 'FAMILY_MEMBERSHIP',
      name: 'Family Membership Certificate',
      desc: 'Certificate enumerating living members of a family for legal and welfare purposes.',
      parties: ['FATHER', 'MOTHER'],
      docs: [
        { type: 'AADHAAR', label: 'Applicant Aadhaar', related_to: 'APPLICANT', mandatory: true },
        { type: 'RATION_CARD', label: 'Ration Card', related_to: 'APPLICANT', mandatory: true },
        { type: 'FATHER_ID', label: "Father's ID Proof", related_to: 'FATHER', mandatory: true },
        { type: 'MOTHER_ID', label: "Mother's ID Proof", related_to: 'MOTHER', mandatory: true }
      ]
    },
    {
      code: 'POSSESSION',
      name: 'Possession Certificate',
      desc: 'Proof of physical possession and holding of landed property within the panchayat.',
      parties: ['PROPERTY'],
      docs: [
        { type: 'AADHAAR', label: 'Applicant Aadhaar', related_to: 'APPLICANT', mandatory: true },
        { type: 'LAND_TAX', label: 'Land Tax Receipt', related_to: 'PROPERTY', mandatory: true },
        { type: 'OWNERSHIP_DEED', label: 'Ownership / Title Document', related_to: 'PROPERTY', mandatory: false }
      ]
    }
  ];

  const certTypeMap = {};
  for (const ct of certTypes) {
    const res = await db.query(`
      INSERT INTO certificate_types (certificate_code, certificate_name, description, required_documents, verification_parties, validity_months, status)
      VALUES (?, ?, ?, ?, ?, 12, 'ACTIVE')
    `, [ct.code, ct.name, ct.desc, JSON.stringify(ct.docs), JSON.stringify(ct.parties)]);
    certTypeMap[ct.code] = res.insertId;
  }

  // 9. Master Data
  console.log('Seeding master data...');
  const masterData = [
    { cat: 'SETTING', code: 'OVERDUE_DAYS', val: '3', desc: 'Days before pending verification is considered overdue' },
    { cat: 'SETTING', code: 'REMINDER_COOLDOWN_HOURS', val: '24', desc: 'Cooldown between verification reminders in hours' },

    { cat: 'PURPOSE', code: 'EDUCATION', val: 'Education / Admission', desc: 'School, college, or university admission' },
    { cat: 'PURPOSE', code: 'SCHOLARSHIP', val: 'Scholarship', desc: 'Government or institutional financial scholarship' },
    { cat: 'PURPOSE', code: 'EMPLOYMENT', val: 'Employment / Job Application', desc: 'Recruitment and public service exams' },
    { cat: 'PURPOSE', code: 'GOVT_SCHEME', val: 'Government Scheme', desc: 'Welfare benefit or financial grant scheme' },
    { cat: 'PURPOSE', code: 'LOAN', val: 'Bank Loan', desc: 'Bank loan or financial assistance application' },
    { cat: 'PURPOSE', code: 'OTHER', val: 'Other', desc: 'Other administrative purposes' },

    { cat: 'OCCUPATION', code: 'FARMER', val: 'Farmer', desc: 'Agricultural farming and allied activity' },
    { cat: 'OCCUPATION', code: 'DAILY_WAGE', val: 'Daily wage labourer', desc: 'Daily wage or unorganised sector work' },
    { cat: 'OCCUPATION', code: 'GOVT_EMP', val: 'Government employee', desc: 'State or central government service' },
    { cat: 'OCCUPATION', code: 'PRIVATE_EMP', val: 'Private employee', desc: 'Private sector employment' },
    { cat: 'OCCUPATION', code: 'SELF_EMP', val: 'Self-employed', desc: 'Self employed professional or trader' },
    { cat: 'OCCUPATION', code: 'BUSINESS', val: 'Business', desc: 'Business owner or entrepreneur' },
    { cat: 'OCCUPATION', code: 'HOMEMAKER', val: 'Homemaker', desc: 'Managing domestic household' },
    { cat: 'OCCUPATION', code: 'RETIRED', val: 'Retired', desc: 'Retired from service' },
    { cat: 'OCCUPATION', code: 'UNEMPLOYED', val: 'Unemployed', desc: 'Currently looking for employment' },
    { cat: 'OCCUPATION', code: 'OTHER', val: 'Other', desc: 'Other category' }
  ];

  for (const m of masterData) {
    await db.query(`
      INSERT INTO master_data (category, code, value, description, status)
      VALUES (?, ?, ?, ?, 'ACTIVE')
    `, [m.cat, m.code, m.val, m.desc]);
  }

  // 10. Generate sample placeholder documents on disk
  console.log('Generating placeholder sample PDFs...');
  const uploadsDir = path.resolve(__dirname, '../uploads/documents');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const sampleDocs = [
    { key: 'akhil-aadhaar', label: 'Applicant Aadhaar' },
    { key: 'akhil-ration', label: 'Ration Card' },
    { key: 'akhil-income', label: 'Income Proof' },
    { key: 'akhil-proptax', label: 'Property / Land Tax Receipt' },
    { key: 'akhil-fatherid', label: "Father's ID Proof" },
    { key: 'akhil-motherid', label: "Mother's ID Proof" },
    { key: 'anu-aadhaar', label: 'Applicant Aadhaar' },
    { key: 'anu-ration', label: 'Ration Card' },
    { key: 'anu-income', label: 'Income Proof' },
    { key: 'anu-fatherid', label: "Father's ID Proof" },
    { key: 'rafiq-aadhaar', label: 'Applicant Aadhaar' },
    { key: 'rafiq-ration', label: 'Ration Card' },
    { key: 'rafiq-income', label: 'Income Proof' }
  ];

  for (const sd of sampleDocs) {
    const filePath = path.join(uploadsDir, `${sd.key}.pdf`);
    await createSamplePdf(filePath, sd.label);
  }

  // 11. Seed Demo Applications
  console.log('Seeding demo applications...');

  // (a) Akhil K S: EWS, KLM, overdue request to KTR
  const akhil = citizenMap['9876500001'];
  const appARes = await db.query(`
    INSERT INTO applications (
      application_no, citizen_id, certificate_type_id, home_panchayat_id,
      purpose, declared_family_income, land_holding_cents, house_area_sqft,
      other_property_details, status, submitted_at, updated_at
    ) VALUES (
      'EWS-2026-0001', ?, ?, 2,
      'SCHOLARSHIP', 180000.00, 12.00, 850.00,
      'Ancestral land and residential house', 'PENDING_EXTERNAL',
      DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)
    )
  `, [akhil.citizen_id, certTypeMap['EWS']]);
  const appAId = appARes.insertId;

  // Parties for App A
  const partyFatherARes = await db.query(`
    INSERT INTO application_parties (
      application_id, party_type, full_name, aadhaar_no, occupation,
      annual_income, property_details, panchayat_id, verification_required
    ) VALUES (?, 'FATHER', 'Sasidharan K', '456789012345', 'FARMER', 120000.00, '10 cents land at Kalluvila', 1, 1)
  `, [appAId]);
  const partyFatherAId = partyFatherARes.insertId;

  await db.query(`
    INSERT INTO application_parties (
      application_id, party_type, full_name, aadhaar_no, occupation,
      annual_income, property_details, panchayat_id, verification_required
    ) VALUES (?, 'MOTHER', 'Sreedevi S', '567890123456', 'HOMEMAKER', 0.00, NULL, 2, 0)
  `, [appAId]);

  // Request CP-2026-0001 for App A (KLM -> KTR, OVERDUE)
  const reqARes = await db.query(`
    INSERT INTO verification_requests (
      request_no, application_id, party_id, requesting_panchayat_id, verifying_panchayat_id,
      requested_by_user_id, subject_party, subject_name, subject_aadhaar, subject_details,
      purpose, request_details, status, request_date, due_at
    ) VALUES (
      'CP-2026-0001', ?, ?, 2, 1,
      ?, 'FATHER', 'Sasidharan K', '456789012345', '10 cents land at Kalluvila',
      'SCHOLARSHIP', 'Verification of father income and land records held in Kottarakara GP.',
      'PENDING', DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)
    )
  `, [appAId, partyFatherAId, akhil.user_id]);
  const reqAId = reqARes.insertId;

  // Documents for App A
  const klmOfficer = officerMap['officer.kollam'];
  const docsA = [
    { type: 'AADHAAR', name: 'Applicant Aadhaar', related: 'APPLICANT', file: 'akhil-aadhaar.pdf', status: 'VERIFIED', remarks: 'Verified with Aadhaar records.' },
    { type: 'RATION_CARD', name: 'Ration Card', related: 'APPLICANT', file: 'akhil-ration.pdf', status: 'VERIFIED', remarks: 'Ration card verified.' },
    { type: 'INCOME_PROOF', name: 'Income Proof', related: 'APPLICANT', file: 'akhil-income.pdf', status: 'VERIFIED', remarks: 'Salary certificate verified.' },
    { type: 'PROPERTY_TAX', name: 'Property / Land Tax Receipt', related: 'APPLICANT', file: 'akhil-proptax.pdf', status: 'PENDING', remarks: null },
    { type: 'FATHER_ID', name: "Father's ID Proof", related: 'FATHER', file: 'akhil-fatherid.pdf', status: 'PENDING', remarks: null },
    { type: 'MOTHER_ID', name: "Mother's ID Proof", related: 'MOTHER', file: 'akhil-motherid.pdf', status: 'VERIFIED', remarks: 'Mother ID verified locally.' }
  ];

  for (const d of docsA) {
    const isVer = d.status === 'VERIFIED';
    await db.query(`
      INSERT INTO application_documents (
        application_id, document_type, document_name, related_to, original_file_name,
        file_path, mime_type, file_size, verification_status, verification_remarks,
        verified_by_officer_id, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'application/pdf', 24500, ?, ?, ?, ${isVer ? 'NOW()' : 'NULL'})
    `, [
      appAId, d.type, d.name, d.related, `${d.type.toLowerCase()}.pdf`,
      path.join('uploads/documents', d.file), d.status, d.remarks,
      isVer ? klmOfficer.officer_id : null
    ]);
  }

  // Timeline events for App A
  await db.query(`
    INSERT INTO application_timeline (application_id, event_type, title, description, actor_user_id, created_at)
    VALUES
    (?, 'APPLICATION_SUBMITTED', 'Application Submitted', 'Citizen submitted EWS application', ?, DATE_SUB(NOW(), INTERVAL 5 DAY)),
    (?, 'VERIFICATION_REQUESTED', 'Verification Request Sent', 'Request CP-2026-0001 sent to Kottarakara GP for Father verification', ?, DATE_SUB(NOW(), INTERVAL 5 DAY))
  `, [appAId, akhil.user_id, appAId, klmOfficer.user_id]);

  // Notifications for App A
  const ktrOfficer = officerMap['officer.kottarakara'];
  await db.query(`
    INSERT INTO notifications (user_id, application_id, verification_id, notification_type, title, message, is_read, email_status, created_at)
    VALUES
    (?, ?, ?, 'NEW_VERIFICATION_REQUEST', 'New Verification Request CP-2026-0001', 'Verification requested by Kollam GP for Sasidharan K.', 0, 'LOGGED', DATE_SUB(NOW(), INTERVAL 5 DAY)),
    (?, ?, NULL, 'NEW_APPLICATION', 'New Application EWS-2026-0001', 'New EWS application submitted by Akhil K S.', 1, 'LOGGED', DATE_SUB(NOW(), INTERVAL 5 DAY))
  `, [ktrOfficer.user_id, appAId, reqAId, klmOfficer.user_id, appAId]);


  // (b) Anu Thomas: EWS, KTR, pending request to KLM (1 day ago)
  const anu = citizenMap['9876500002'];
  const appBRes = await db.query(`
    INSERT INTO applications (
      application_no, citizen_id, certificate_type_id, home_panchayat_id,
      purpose, declared_family_income, land_holding_cents, house_area_sqft,
      other_property_details, status, submitted_at, updated_at
    ) VALUES (
      'EWS-2026-0002', ?, ?, 1,
      'EDUCATION', 220000.00, 8.50, 750.00,
      'Residential plot', 'PENDING_EXTERNAL',
      DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)
    )
  `, [anu.citizen_id, certTypeMap['EWS']]);
  const appBId = appBRes.insertId;

  const partyFatherBRes = await db.query(`
    INSERT INTO application_parties (
      application_id, party_type, full_name, aadhaar_no, occupation,
      annual_income, property_details, panchayat_id, verification_required
    ) VALUES (?, 'FATHER', 'Thomas Mathew', '678901234567', 'PRIVATE_EMP', 150000.00, 'Residential plot at Kollam', 2, 1)
  `, [appBId]);
  const partyFatherBId = partyFatherBRes.insertId;

  await db.query(`
    INSERT INTO application_parties (
      application_id, party_type, full_name, aadhaar_no, occupation,
      annual_income, property_details, panchayat_id, verification_required
    ) VALUES (?, 'MOTHER', 'Leela Thomas', '789012345678', 'HOMEMAKER', 0.00, NULL, 1, 0)
  `, [appBId]);

  const reqBRes = await db.query(`
    INSERT INTO verification_requests (
      request_no, application_id, party_id, requesting_panchayat_id, verifying_panchayat_id,
      requested_by_user_id, subject_party, subject_name, subject_aadhaar, subject_details,
      purpose, request_details, status, request_date, due_at
    ) VALUES (
      'CP-2026-0002', ?, ?, 1, 2,
      ?, 'FATHER', 'Thomas Mathew', '678901234567', 'Residential plot at Kollam',
      'EDUCATION', 'Verification of father income and property held in Kollam GP.',
      'PENDING', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY)
    )
  `, [appBId, partyFatherBId, anu.user_id]);

  const docsB = [
    { type: 'AADHAAR', name: 'Applicant Aadhaar', related: 'APPLICANT', file: 'anu-aadhaar.pdf', status: 'VERIFIED' },
    { type: 'RATION_CARD', name: 'Ration Card', related: 'APPLICANT', file: 'anu-ration.pdf', status: 'PENDING' },
    { type: 'INCOME_PROOF', name: 'Income Proof', related: 'APPLICANT', file: 'anu-income.pdf', status: 'PENDING' },
    { type: 'FATHER_ID', name: "Father's ID Proof", related: 'FATHER', file: 'anu-fatherid.pdf', status: 'PENDING' }
  ];

  for (const d of docsB) {
    await db.query(`
      INSERT INTO application_documents (
        application_id, document_type, document_name, related_to, original_file_name,
        file_path, mime_type, file_size, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, 'application/pdf', 24500, ?)
    `, [appBId, d.type, d.name, d.related, `${d.type.toLowerCase()}.pdf`, path.join('uploads/documents', d.file), d.status]);
  }

  await db.query(`
    INSERT INTO application_timeline (application_id, event_type, title, description, actor_user_id, created_at)
    VALUES
    (?, 'APPLICATION_SUBMITTED', 'Application Submitted', 'Citizen submitted EWS application', ?, DATE_SUB(NOW(), INTERVAL 1 DAY)),
    (?, 'VERIFICATION_REQUESTED', 'Verification Request Sent', 'Request CP-2026-0002 sent to Kollam GP for Father verification', ?, DATE_SUB(NOW(), INTERVAL 1 DAY))
  `, [appBId, anu.user_id, appBId, ktrOfficer.user_id]);


  // (c) Rafiq Khan: INCOME, KDK, request to ANC APPROVED & REALLY SIGNED by officer.anchal!
  const rafiq = citizenMap['9876500003'];
  const appCRes = await db.query(`
    INSERT INTO applications (
      application_no, citizen_id, certificate_type_id, home_panchayat_id,
      purpose, declared_family_income, land_holding_cents, house_area_sqft,
      other_property_details, status, submitted_at, updated_at
    ) VALUES (
      'INCOME-2026-0001', ?, ?, 3,
      'GOVT_SCHEME', 95000.00, 5.00, 600.00,
      'Small rural holding', 'READY_FOR_DECISION',
      DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)
    )
  `, [rafiq.citizen_id, certTypeMap['INCOME']]);
  const appCId = appCRes.insertId;

  await db.query(`
    INSERT INTO application_parties (
      application_id, party_type, full_name, aadhaar_no, occupation,
      annual_income, property_details, panchayat_id, verification_required
    ) VALUES (?, 'FATHER', 'Abdul Khan', '890123456789', 'DAILY_WAGE', 95000.00, NULL, 3, 0)
  `, [appCId]);

  const partyMotherCRes = await db.query(`
    INSERT INTO application_parties (
      application_id, party_type, full_name, aadhaar_no, occupation,
      annual_income, property_details, panchayat_id, verification_required
    ) VALUES (?, 'MOTHER', 'Zainaba Khan', '901234567890', 'HOMEMAKER', 0.00, 'Shop room at Anchal', 4, 1)
  `, [appCId]);
  const partyMotherCId = partyMotherCRes.insertId;

  // Insert verification request row first to obtain verification_id
  const reqCRes = await db.query(`
    INSERT INTO verification_requests (
      request_no, application_id, party_id, requesting_panchayat_id, verifying_panchayat_id,
      requested_by_user_id, subject_party, subject_name, subject_aadhaar, subject_details,
      purpose, request_details, status, request_date, due_at, response_date,
      responded_by_officer_id, response_remarks
    ) VALUES (
      'CP-2026-0003', ?, ?, 3, 4,
      ?, 'MOTHER', 'Zainaba Khan', '901234567890', 'Shop room at Anchal',
      'GOVT_SCHEME', 'Verification of mother shop room assets in Anchal GP.',
      'APPROVED', DATE_SUB(NOW(), INTERVAL 3 DAY), NOW(), DATE_SUB(NOW(), INTERVAL 2 DAY),
      ?, 'Verified from Anchal panchayat records.'
    )
  `, [appCId, partyMotherCId, rafiq.user_id, officerMap['officer.anchal'].officer_id]);
  const reqCId = reqCRes.insertId;

  // Real cryptographic signature with officer.anchal's private key
  const ancOfficer = officerMap['officer.anchal'];
  const signedAtDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const signedAtIso = signedAtDate.toISOString();
  const signedAtMysql = signedAtIso.slice(0, 19).replace('T', ' ');

  const payloadData = {
    request_no: 'CP-2026-0003',
    verification_id: reqCId,
    application_id: appCId,
    application_no: 'INCOME-2026-0001',
    requesting_panchayat: { id: 3, code: 'KDK', name: 'Kadakkal GP' },
    verifying_panchayat: { id: 4, code: 'ANC', name: 'Anchal GP' },
    subject_party: 'MOTHER',
    subject_name: 'Zainaba Khan',
    decision: 'APPROVED',
    remarks: 'Verified from Anchal panchayat records.',
    signed_by: {
      officer_id: ancOfficer.officer_id,
      name: ancOfficer.name,
      designation: ancOfficer.desig,
      employee_id: ancOfficer.empId
    },
    signed_at: signedAtIso
  };

  const payloadJson = cryptoService.buildSignaturePayload(payloadData);
  const { payload_hash, signature, signature_algorithm } = cryptoService.signPayload(payloadJson, ancOfficer.privateKey);

  // Update verification request with signature details
  await db.query(`
    UPDATE verification_requests SET
      payload_json = ?,
      payload_hash = ?,
      signature = ?,
      signature_algorithm = ?,
      signer_public_key = ?,
      signer_key_fingerprint = ?,
      signed_at = ?
    WHERE verification_id = ?
  `, [
    payloadJson,
    payload_hash,
    signature,
    signature_algorithm,
    ancOfficer.publicKey,
    ancOfficer.fingerprint,
    signedAtMysql,
    reqCId
  ]);

  // Documents for App C (all VERIFIED)
  const kdkOfficer = officerMap['officer.kadakkal'];
  const docsC = [
    { type: 'AADHAAR', name: 'Applicant Aadhaar', related: 'APPLICANT', file: 'rafiq-aadhaar.pdf' },
    { type: 'RATION_CARD', name: 'Ration Card', related: 'APPLICANT', file: 'rafiq-ration.pdf' },
    { type: 'INCOME_PROOF', name: 'Income Proof', related: 'APPLICANT', file: 'rafiq-income.pdf' }
  ];

  for (const d of docsC) {
    await db.query(`
      INSERT INTO application_documents (
        application_id, document_type, document_name, related_to, original_file_name,
        file_path, mime_type, file_size, verification_status, verification_remarks,
        verified_by_officer_id, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'application/pdf', 24500, 'VERIFIED', 'Verified against panchayat register.', ?, DATE_SUB(NOW(), INTERVAL 2 DAY))
    `, [appCId, d.type, d.name, d.related, `${d.type.toLowerCase()}.pdf`, path.join('uploads/documents', d.file), kdkOfficer.officer_id]);
  }

  // Timeline events for App C
  await db.query(`
    INSERT INTO application_timeline (application_id, event_type, title, description, actor_user_id, created_at)
    VALUES
    (?, 'APPLICATION_SUBMITTED', 'Application Submitted', 'Citizen submitted Income certificate application', ?, DATE_SUB(NOW(), INTERVAL 3 DAY)),
    (?, 'VERIFICATION_REQUESTED', 'Verification Request Sent', 'Request CP-2026-0003 sent to Anchal GP for Mother verification', ?, DATE_SUB(NOW(), INTERVAL 3 DAY)),
    (?, 'VERIFICATION_COMPLETED', 'Verification Approved & Digitally Signed', 'Anchal GP digitally signed approval response for Mother verification', ?, DATE_SUB(NOW(), INTERVAL 2 DAY))
  `, [appCId, rafiq.user_id, appCId, kdkOfficer.user_id, appCId, ancOfficer.user_id]);

  // Notifications for App C
  await db.query(`
    INSERT INTO notifications (user_id, application_id, verification_id, notification_type, title, message, is_read, email_status, created_at)
    VALUES
    (?, ?, ?, 'VERIFICATION_COMPLETED', 'Verification Response Signed', 'Anchal GP has approved and digitally signed verification CP-2026-0003.', 0, 'LOGGED', DATE_SUB(NOW(), INTERVAL 2 DAY))
  `, [kdkOfficer.user_id, appCId, reqCId]);

  // 12. Sequences Table
  console.log('Updating sequences table to match demo data...');
  const currentYear = new Date().getFullYear();
  await db.query(`
    INSERT INTO sequences (seq_key, \`last_value\`) VALUES
    (?, 2),
    (?, 1),
    (?, 3)
    ON DUPLICATE KEY UPDATE \`last_value\` = VALUES(\`last_value\`)
  `, [
    `APP-EWS-${currentYear}`,
    `APP-INCOME-${currentYear}`,
    `REQ-${currentYear}`
  ]);

  console.log('\n========================================================================');
  console.log('DEMO ACCOUNTS READY FOR LOGIN');
  console.log('========================================================================');
  console.table([
    { Role: 'ADMIN', Name: 'System Admin', Username: 'admin', Password: 'Admin@123', LoginTab: 'OFFICIAL' },
    { Role: 'OFFICER', Name: 'Deepak Kunjumon (KTR)', Username: 'officer.kottarakara', Password: 'Officer@123', LoginTab: 'OFFICIAL' },
    { Role: 'OFFICER', Name: 'Sreeja Menon (KLM)', Username: 'officer.kollam', Password: 'Officer@123', LoginTab: 'OFFICIAL' },
    { Role: 'OFFICER', Name: 'Rajesh Kumar (KDK)', Username: 'officer.kadakkal', Password: 'Officer@123', LoginTab: 'OFFICIAL' },
    { Role: 'OFFICER', Name: 'Fathima Beevi (ANC)', Username: 'officer.anchal', Password: 'Officer@123', LoginTab: 'OFFICIAL' },
    { Role: 'CITIZEN', Name: 'Akhil K S (KLM)', Username: '9876500001', Password: 'Citizen@123', LoginTab: 'CITIZEN' },
    { Role: 'CITIZEN', Name: 'Anu Thomas (KTR)', Username: '9876500002', Password: 'Citizen@123', LoginTab: 'CITIZEN' },
    { Role: 'CITIZEN', Name: 'Rafiq Khan (KDK)', Username: '9876500003', Password: 'Citizen@123', LoginTab: 'CITIZEN' }
  ]);
  console.log('========================================================================\n');
}

if (require.main === module) {
  seed().then(() => {
    console.log('Seed completed successfully.');
    process.exit(0);
  }).catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

module.exports = seed;
