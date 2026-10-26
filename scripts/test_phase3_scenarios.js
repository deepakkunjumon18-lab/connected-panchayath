const path = require('path');
const mysql = require(path.resolve(__dirname, '../backend/node_modules/mysql2/promise'));
const assert = require('assert');
const fs = require('fs');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Database config
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'mysql123',
  database: process.env.DB_NAME || 'connected_panchayat'
};

let dbPool;
let passedChecks = 0;
let failedChecks = 0;
const scenarioEvidence = {};

function recordCheck(scenario, desc, pass, details = null) {
  if (pass) {
    passedChecks++;
    console.log(`  ✓ [PASS] [${scenario}] ${desc}`);
  } else {
    failedChecks++;
    console.error(`  ✗ [FAIL] [${scenario}] ${desc}${details ? ` (${details})` : ''}`);
  }
  if (!scenarioEvidence[scenario]) {
    scenarioEvidence[scenario] = [];
  }
  scenarioEvidence[scenario].push({ desc, pass, details });
}

async function apiRequest(endpoint, { method = 'GET', body = null, token = null, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  let reqBody = body;
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    reqHeaders['Content-Type'] = 'application/json';
    reqBody = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: reqHeaders,
    body: reqBody
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else if (contentType.includes('application/pdf')) {
    const arrayBuffer = await res.arrayBuffer();
    data = Buffer.from(arrayBuffer);
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, data };
}

async function loginUser(identifier, password, login_as) {
  const res = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: { identifier, password, login_as }
  });
  return res;
}

// Helper to create a dummy PDF file for multipart upload
function createDummyPdfBuffer(title) {
  return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Title (${title}) >>\nendobj\ntrailer\n<<>>\n%%EOF`);
}

async function runPhase3Scenarios() {
  console.log('\n======================================================');
  console.log('STARTING PHASE 3: FULL END-TO-END SCENARIOS (S1 - S7)');
  console.log(`Target Backend: ${BASE_URL}`);
  console.log(`Target DB: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
  console.log('======================================================\n');

  dbPool = mysql.createPool(dbConfig);

  // Authenticate base roles
  const adminLogin = await loginUser('admin', 'Admin@123', 'OFFICIAL');
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  const adminToken = adminLogin.data.data.token;

  const ktrOfficerLogin = await loginUser('officer.kottarakara', 'Officer@123', 'OFFICIAL');
  assert.strictEqual(ktrOfficerLogin.status, 200, 'Kottarakara officer login failed');
  const ktrOfficerToken = ktrOfficerLogin.data.data.token;

  const klmOfficerLogin = await loginUser('officer.kollam', 'Officer@123', 'OFFICIAL');
  assert.strictEqual(klmOfficerLogin.status, 200, 'Kollam officer login failed');
  const klmOfficerToken = klmOfficerLogin.data.data.token;

  const kdkOfficerLogin = await loginUser('officer.kadakkal', 'Officer@123', 'OFFICIAL');
  assert.strictEqual(kdkOfficerLogin.status, 200, 'Kadakkal officer login failed');
  const kdkOfficerToken = kdkOfficerLogin.data.data.token;

  // -----------------------------------------------------------------
  // SCENARIO S1: HAPPY PATH
  // -----------------------------------------------------------------
  console.log('\n>>> SCENARIO S1: HAPPY PATH (EWS Certificate with Cross-Panchayat Signing & Issuance)');
  try {
    // 1. Register a dedicated Citizen in Kottarakara GP (id 1)
    const s1Mobile = `98471${Math.floor(10000 + Math.random() * 90000)}`;
    const regRes = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        full_name: 'Anandhu R S1',
        mobile: s1Mobile,
        email: `anandhu.s1.${Date.now()}@example.com`,
        password: 'Citizen@123',
        aadhaar_no: `776655${Math.floor(100000 + Math.random() * 900000)}`,
        date_of_birth: '1998-05-15',
        gender: 'MALE',
        address: 'Anandhu Bhavan, Kottarakara, Kollam',
        panchayat_id: 1 // Kottarakara
      }
    });
    recordCheck('S1', 'Citizen self-registration in Kottarakara GP', regRes.status === 201);
    const s1CitizenToken = regRes.data.data.token;

    // 2. Submit EWS Application: Applicant in Kottarakara (1), Father in Kollam (2), Mother in Kadakkal (3)
    // Mandatory docs for EWS: AADHAAR, RATION_CARD, INCOME_PROOF, PROPERTY_TAX, FATHER_ID, MOTHER_ID
    const fd = new FormData();
    fd.append('data', JSON.stringify({
      certificate_type_id: 1, // EWS
      purpose: 'College Admission',
      declared_family_income: 120000,
      land_holding_cents: 6,
      house_area_sqft: 750,
      parties: [
        {
          party_type: 'FATHER',
          full_name: 'Ramachandran K',
          aadhaar_no: '887766554433',
          occupation: 'FARMER',
          annual_income: 80000,
          property_details: '4 cents land in Kollam GP',
          panchayat_id: 2 // Kollam GP (external)
        },
        {
          party_type: 'MOTHER',
          full_name: 'Radha P',
          aadhaar_no: '887766554422',
          occupation: 'HOMEMAKER',
          annual_income: 0,
          property_details: 'None',
          panchayat_id: 3 // Kadakkal GP (external)
        },
        {
          party_type: 'PROPERTY',
          full_name: 'Anandhu R Property',
          aadhaar_no: '776655443322',
          occupation: 'OTHER',
          annual_income: 0,
          property_details: '6 cents residential plot in Kottarakara',
          panchayat_id: 1 // Kottarakara GP (home)
        }
      ]
    }));
    fd.append('fileMeta', JSON.stringify([
      { document_type: 'AADHAAR', document_name: 'Applicant Aadhaar', related_to: 'APPLICANT' },
      { document_type: 'RATION_CARD', document_name: 'Ration Card', related_to: 'APPLICANT' },
      { document_type: 'INCOME_PROOF', document_name: 'Applicant Income Proof', related_to: 'APPLICANT' },
      { document_type: 'PROPERTY_TAX', document_name: 'Property Tax Receipt', related_to: 'APPLICANT' },
      { document_type: 'FATHER_ID', document_name: "Father's ID", related_to: 'FATHER' },
      { document_type: 'MOTHER_ID', document_name: "Mother's ID", related_to: 'MOTHER' }
    ]));
    fd.append('files', new Blob([createDummyPdfBuffer('Aadhaar')], { type: 'application/pdf' }), 'aadhaar.pdf');
    fd.append('files', new Blob([createDummyPdfBuffer('Ration Card')], { type: 'application/pdf' }), 'ration.pdf');
    fd.append('files', new Blob([createDummyPdfBuffer('Income Proof')], { type: 'application/pdf' }), 'income.pdf');
    fd.append('files', new Blob([createDummyPdfBuffer('Property Tax')], { type: 'application/pdf' }), 'proptax.pdf');
    fd.append('files', new Blob([createDummyPdfBuffer('Father ID')], { type: 'application/pdf' }), 'fatherid.pdf');
    fd.append('files', new Blob([createDummyPdfBuffer('Mother ID')], { type: 'application/pdf' }), 'motherid.pdf');

    const appSubmitRes = await apiRequest('/api/applications', {
      method: 'POST',
      body: fd,
      token: s1CitizenToken
    });
    recordCheck('S1', 'EWS application submitted with 2 external parties and 6 mandatory docs', appSubmitRes.status === 201, appSubmitRes.data?.message);
    const s1AppId = appSubmitRes.data?.data?.application_id;
    const s1AppNo = appSubmitRes.data?.data?.application_no;
    recordCheck('S1', `Application initial status is PENDING_EXTERNAL (${s1AppNo})`, appSubmitRes.data?.data?.status === 'PENDING_EXTERNAL');

    // 3. SQL Verification: Exactly 2 verification_requests created
    const [vrRows] = await dbPool.query(
      'SELECT verification_id, request_no, verifying_panchayat_id, subject_party, status FROM verification_requests WHERE application_id = ? ORDER BY verification_id ASC',
      [s1AppId]
    );
    recordCheck('S1', 'SQL Count: Exactly 2 verification requests created in DB', vrRows.length === 2, `Found ${vrRows.length} requests`);
    assert.strictEqual(vrRows.length, 2);

    const klmReq = vrRows.find(r => r.verifying_panchayat_id === 2);
    const kdkReq = vrRows.find(r => r.verifying_panchayat_id === 3);
    recordCheck('S1', 'Request 1 routed to Kollam GP and Request 2 routed to Kadakkal GP', !!klmReq && !!kdkReq);

    // 4. Verifying Officer 1 (Kollam GP) reviews and signs APPROVED
    const klmSignRes = await apiRequest(`/api/verification-requests/${klmReq.verification_id}/respond`, {
      method: 'POST',
      token: klmOfficerToken,
      body: {
        decision: 'APPROVED',
        remarks: 'Landholding and income verified from Kollam GP revenue register.',
        password: 'Officer@123'
      }
    });
    recordCheck('S1', 'Officer 1 (Kollam) signs APPROVED with password authentication', klmSignRes.status === 200);

    // 5. Verifying Officer 2 (Kadakkal GP) reviews and signs APPROVED
    const kdkSignRes = await apiRequest(`/api/verification-requests/${kdkReq.verification_id}/respond`, {
      method: 'POST',
      token: kdkOfficerToken,
      body: {
        decision: 'APPROVED',
        remarks: 'Confirmed resident status from Kadakkal GP records.',
        password: 'Officer@123'
      }
    });
    recordCheck('S1', 'Officer 2 (Kadakkal) signs APPROVED with password authentication', kdkSignRes.status === 200);

    // 6. SQL Verification: Application transitioned to READY_FOR_DECISION
    const [appRowsAfterSigning] = await dbPool.query(
      'SELECT status FROM applications WHERE application_id = ?',
      [s1AppId]
    );
    recordCheck('S1', 'Application status auto-refreshed to READY_FOR_DECISION', appRowsAfterSigning[0].status === 'READY_FOR_DECISION');

    // 7. Verify cryptographic signatures on both requests
    const sigCheck1 = await apiRequest(`/api/verification-requests/${klmReq.verification_id}/signature-check`, { token: ktrOfficerToken });
    const sigCheck2 = await apiRequest(`/api/verification-requests/${kdkReq.verification_id}/signature-check`, { token: ktrOfficerToken });
    recordCheck('S1', 'Cryptographic check on Kollam request is 100% VALID', sigCheck1.data.data.valid === true);
    recordCheck('S1', 'Cryptographic check on Kadakkal request is 100% VALID', sigCheck2.data.data.valid === true);

    // 8. Home Officer (Kottarakara) verifies applicant documents
    const appDetailsForOfficer = await apiRequest(`/api/applications/${s1AppId}`, { token: ktrOfficerToken });
    const applicantDocs = appDetailsForOfficer.data.data.documents.filter(d => d.related_to === 'APPLICANT');
    for (const doc of applicantDocs) {
      const vRes = await apiRequest(`/api/applications/${s1AppId}/documents/${doc.document_id}/verify`, {
        method: 'PATCH',
        token: ktrOfficerToken,
        body: { status: 'VERIFIED', remarks: 'Document verified against original' }
      });
      assert.strictEqual(vRes.status, 200);
    }
    recordCheck('S1', 'Home Officer verified all applicant documents', true);

    // 9. Home Officer checks blockers and APPROVES application
    const appCheckAfterDocs = await apiRequest(`/api/applications/${s1AppId}`, { token: ktrOfficerToken });
    recordCheck('S1', 'Application has 0 approval blockers', appCheckAfterDocs.data.data.blockers.length === 0);

    const approveRes = await apiRequest(`/api/applications/${s1AppId}/decision`, {
      method: 'POST',
      token: ktrOfficerToken,
      body: { decision: 'APPROVE', remarks: 'All verifications and documents complete and valid.' }
    });
    recordCheck('S1', 'Home Officer approves application (status -> APPROVED)', approveRes.status === 200 && approveRes.data.data.status === 'APPROVED');

    // 10. Issue Certificate
    const issueRes = await apiRequest(`/api/applications/${s1AppId}/issue-certificate`, {
      method: 'POST',
      token: ktrOfficerToken
    });
    recordCheck('S1', 'Certificate issued (status -> CERTIFICATE_ISSUED)', issueRes.status === 200 || issueRes.status === 201);
    const certData = issueRes.data.data;
    const certCode = certData.verification_code;
    const certId = certData.certificate_id;

    // 11. Citizen downloads PDF
    const downloadRes = await apiRequest(`/api/certificates/${certId}/download`, { token: s1CitizenToken });
    const isPdf = Buffer.isBuffer(downloadRes.data) && downloadRes.data.toString('utf8', 0, 5).startsWith('%PDF-');
    recordCheck('S1', 'Citizen downloads generated certificate PDF (valid %PDF header)', isPdf && downloadRes.data.length > 2000, `Size: ${downloadRes.data?.length} bytes`);

    // 12. Public verify endpoint
    const pubVerifyRes = await apiRequest(`/api/certificates/verify/${certCode}`);
    recordCheck('S1', 'Public verification endpoint returns VALID with fileHashMatches=true',
      pubVerifyRes.status === 200 && pubVerifyRes.data.data.status === 'VALID' && pubVerifyRes.data.data.integrity?.fileHashMatches === true
    );
  } catch (err) {
    recordCheck('S1', `Fatal error during S1 execution: ${err.message}`, false);
  }

  // -----------------------------------------------------------------
  // SCENARIO S2: REJECTION BY OTHER PANCHAYAT
  // -----------------------------------------------------------------
  console.log('\n>>> SCENARIO S2: REJECTION BY OTHER PANCHAYAT');
  try {
    // 1. Citizen applies for Income certificate: Father in Kollam GP (2), Mother in Kottarakara GP (1)
    const s2Mobile = `98472${Math.floor(10000 + Math.random() * 90000)}`;
    const regRes2 = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        full_name: 'Biju V S2',
        mobile: s2Mobile,
        email: `biju.s2.${Date.now()}@example.com`,
        password: 'Citizen@123',
        aadhaar_no: `776644${Math.floor(100000 + Math.random() * 900000)}`,
        date_of_birth: '1995-08-20',
        gender: 'MALE',
        address: 'Biju Villa, Kottarakara',
        panchayat_id: 1 // Kottarakara
      }
    });
    const s2CitizenToken = regRes2.data.data.token;

    const fd2 = new FormData();
    fd2.append('data', JSON.stringify({
      certificate_type_id: 2, // INCOME
      purpose: 'Bank Loan',
      declared_family_income: 95000,
      land_holding_cents: 3,
      house_area_sqft: 500,
      parties: [
        {
          party_type: 'FATHER',
          full_name: 'Varghese P',
          aadhaar_no: '887755443322',
          occupation: 'BUSINESS',
          annual_income: 95000,
          property_details: 'Shop at Kollam town',
          panchayat_id: 2 // Kollam GP (external)
        },
        {
          party_type: 'MOTHER',
          full_name: 'Mary Varghese',
          aadhaar_no: '887755443311',
          occupation: 'HOMEMAKER',
          annual_income: 0,
          property_details: 'None',
          panchayat_id: 1 // Kottarakara GP (home)
        }
      ]
    }));
    fd2.append('fileMeta', JSON.stringify([
      { document_type: 'AADHAAR', document_name: 'Applicant Aadhaar', related_to: 'APPLICANT' },
      { document_type: 'RATION_CARD', document_name: 'Ration Card', related_to: 'APPLICANT' },
      { document_type: 'INCOME_PROOF', document_name: 'Family Income Certificate', related_to: 'APPLICANT' }
    ]));
    fd2.append('files', new Blob([createDummyPdfBuffer('Aadhaar')], { type: 'application/pdf' }), 'aadhaar.pdf');
    fd2.append('files', new Blob([createDummyPdfBuffer('Ration Card')], { type: 'application/pdf' }), 'ration.pdf');
    fd2.append('files', new Blob([createDummyPdfBuffer('Income')], { type: 'application/pdf' }), 'income.pdf');

    const s2AppRes = await apiRequest('/api/applications', {
      method: 'POST',
      body: fd2,
      token: s2CitizenToken
    });
    recordCheck('S2', 'Income application submitted with Kollam verification party', s2AppRes.status === 201, s2AppRes.data?.message);
    const s2AppId = s2AppRes.data?.data?.application_id;

    // 2. Fetch created request
    const [s2VrRows] = await dbPool.query(
      'SELECT verification_id, request_no FROM verification_requests WHERE application_id = ?',
      [s2AppId]
    );
    assert.strictEqual(s2VrRows.length, 1);
    const s2ReqId = s2VrRows[0].verification_id;

    // 3. Verifying Officer (Kollam) REJECTS with remarks
    const rejectRes = await apiRequest(`/api/verification-requests/${s2ReqId}/respond`, {
      method: 'POST',
      token: klmOfficerToken,
      body: {
        decision: 'REJECTED',
        remarks: 'Discrepancy found in declared shop turnover and Kollam tax register.',
        password: 'Officer@123'
      }
    });
    recordCheck('S2', 'Verifying officer signs REJECTED decision with required remarks', rejectRes.status === 200 && rejectRes.data.data.status === 'REJECTED');

    // 4. Home Officer checks application: Approval must be BLOCKED
    const s2AppOfficer = await apiRequest(`/api/applications/${s2AppId}`, { token: ktrOfficerToken });
    const hasRejectionBlocker = s2AppOfficer.data.data.blockers.some(b => b.toLowerCase().includes('rejected'));
    recordCheck('S2', 'Home Officer view displays blocker: "Request was rejected by Kollam"', hasRejectionBlocker);

    // Attempting to approve must fail
    const illegalApproveRes = await apiRequest(`/api/applications/${s2AppId}/decision`, {
      method: 'POST',
      token: ktrOfficerToken,
      body: { decision: 'APPROVE', remarks: 'Trying to approve anyway' }
    });
    recordCheck('S2', 'System forbids approving application with rejected verification', illegalApproveRes.status === 400);

    // 5. Home Officer rejects application
    const s2RejectAppRes = await apiRequest(`/api/applications/${s2AppId}/decision`, {
      method: 'POST',
      token: ktrOfficerToken,
      body: { decision: 'REJECT', remarks: 'Application rejected due to failed external revenue verification.' }
    });
    recordCheck('S2', 'Home Officer rejects application with remarks (status -> REJECTED)', s2RejectAppRes.status === 200 && s2RejectAppRes.data.data.status === 'REJECTED');

    // 6. Citizen notification check
    const citNotifs = await apiRequest('/api/notifications', { token: s2CitizenToken });
    const hasRejectNotif = citNotifs.data.data.items.some(n => n.title.includes('Rejected') || n.message.includes('rejected'));
    recordCheck('S2', 'Citizen receives in-app notification of application rejection', hasRejectNotif);
  } catch (err) {
    recordCheck('S2', `Fatal error during S2 execution: ${err.message}`, false);
  }

  // -----------------------------------------------------------------
  // SCENARIO S3: OVERDUE & REMINDER COOLDOWN
  // -----------------------------------------------------------------
  console.log('\n>>> SCENARIO S3: OVERDUE & REMINDER COOLDOWN');
  try {
    // Seeded request CP-2026-0001 is requesting=Kollam (2) -> verifying=Kottarakara (1), due_at 2 days ago
    const [overdueRows] = await dbPool.query(
      "SELECT verification_id, request_no, requesting_panchayat_id, due_at, reminder_count, last_reminder_at FROM verification_requests WHERE request_no = 'CP-2026-0001'"
    );
    assert.strictEqual(overdueRows.length, 1);
    const s3Req = overdueRows[0];
    const s3ReqId = s3Req.verification_id;

    // 1. Verify counts endpoint reflects overdue requests
    const countsRes = await apiRequest('/api/verification-requests/counts', { token: klmOfficerToken });
    recordCheck('S3', 'Verification counts reports overdue request count > 0', countsRes.status === 200 && (countsRes.data.data.incoming?.overdue > 0 || countsRes.data.data.outgoing?.overdue > 0));

    // 2. Verify single request detail flags is_overdue === true
    const s3Detail = await apiRequest(`/api/verification-requests/${s3ReqId}`, { token: klmOfficerToken });
    recordCheck('S3', 'Request detail computes is_overdue === true', s3Detail.status === 200 && s3Detail.data.data.is_overdue === true);

    // 3. Reset last_reminder_at to NULL so cooldown does not block initial test reminder
    await dbPool.query('UPDATE verification_requests SET last_reminder_at = NULL, reminder_count = 0 WHERE verification_id = ?', [s3ReqId]);

    // 4. Requesting officer (Kollam) sends first reminder
    const remindRes1 = await apiRequest(`/api/verification-requests/${s3ReqId}/remind`, {
      method: 'POST',
      token: klmOfficerToken
    });
    recordCheck('S3', 'Sending reminder succeeds and increments reminder_count', remindRes1.status === 200 && remindRes1.data.data.reminder_count === 1);

    // 5. Send immediate second reminder -> must be BLOCKED by 24h cooldown
    const remindRes2 = await apiRequest(`/api/verification-requests/${s3ReqId}/remind`, {
      method: 'POST',
      token: klmOfficerToken
    });
    recordCheck('S3', 'Immediate second reminder is BLOCKED by 24h cooldown (status 400)', remindRes2.status === 400 && remindRes2.data.message.includes('cooldown'));

    // 6. Simulate cooldown expiration (set last_reminder_at = NOW - 25 hours)
    await dbPool.query(
      'UPDATE verification_requests SET last_reminder_at = DATE_SUB(NOW(), INTERVAL 25 HOUR) WHERE verification_id = ?',
      [s3ReqId]
    );
    const remindRes3 = await apiRequest(`/api/verification-requests/${s3ReqId}/remind`, {
      method: 'POST',
      token: klmOfficerToken
    });
    recordCheck('S3', 'Reminder succeeds after 24h cooldown window passes (reminder_count = 2)', remindRes3.status === 200 && remindRes3.data.data.reminder_count === 2);
  } catch (err) {
    recordCheck('S3', `Fatal error during S3 execution: ${err.message}`, false);
  }

  // -----------------------------------------------------------------
  // SCENARIO S4: MIXED & EDGE CASES
  // -----------------------------------------------------------------
  console.log('\n>>> SCENARIO S4: MIXED & EDGE CASES');
  try {
    const s4CitizenLogin = await loginUser('9876500002', 'Citizen@123', 'CITIZEN'); // Anu Thomas (home: Kottarakara GP, id 1)
    const s4CitToken = s4CitizenLogin.data.data.token;

    // 1. Family Membership where all members are in same home panchayat (1) -> 0 requests created
    // Mandatory docs for FAMILY_MEMBERSHIP: AADHAAR, RATION_CARD, FATHER_ID, MOTHER_ID
    const fdFam = new FormData();
    fdFam.append('data', JSON.stringify({
      certificate_type_id: 5, // FAMILY_MEMBERSHIP
      purpose: 'Ration Card Addition',
      declared_family_income: 140000,
      land_holding_cents: 10,
      house_area_sqft: 800,
      parties: [
        { party_type: 'FATHER', full_name: 'Murugan S4', aadhaar_no: '998811223344', occupation: 'DAILY_WAGE', annual_income: 70000, panchayat_id: 1 },
        { party_type: 'MOTHER', full_name: 'Lakshmi S4', aadhaar_no: '998811223355', occupation: 'HOMEMAKER', annual_income: 0, panchayat_id: 1 }
      ]
    }));
    fdFam.append('fileMeta', JSON.stringify([
      { document_type: 'AADHAAR', document_name: 'Aadhaar', related_to: 'APPLICANT' },
      { document_type: 'RATION_CARD', document_name: 'Ration Card', related_to: 'APPLICANT' },
      { document_type: 'FATHER_ID', document_name: "Father's ID", related_to: 'FATHER' },
      { document_type: 'MOTHER_ID', document_name: "Mother's ID", related_to: 'MOTHER' }
    ]));
    fdFam.append('files', new Blob([createDummyPdfBuffer('Aadhaar')], { type: 'application/pdf' }), 'aadhaar.pdf');
    fdFam.append('files', new Blob([createDummyPdfBuffer('Ration')], { type: 'application/pdf' }), 'ration.pdf');
    fdFam.append('files', new Blob([createDummyPdfBuffer('Father ID')], { type: 'application/pdf' }), 'fatherid.pdf');
    fdFam.append('files', new Blob([createDummyPdfBuffer('Mother ID')], { type: 'application/pdf' }), 'motherid.pdf');

    const famRes = await apiRequest('/api/applications', {
      method: 'POST',
      body: fdFam,
      token: s4CitToken
    });
    recordCheck('S4', 'Family Membership with all members in home panchayat creates 0 external requests', famRes.status === 201 && famRes.data.data.created_requests_count === 0 && famRes.data.data.status === 'SUBMITTED');

    // 2. Residence Certificate -> 0 external requests
    const fdRes = new FormData();
    fdRes.append('data', JSON.stringify({
      certificate_type_id: 3, // RESIDENCE
      purpose: 'Passport Application',
      declared_family_income: 200000,
      land_holding_cents: 5,
      house_area_sqft: 600,
      parties: []
    }));
    fdRes.append('fileMeta', JSON.stringify([
      { document_type: 'AADHAAR', document_name: 'Aadhaar', related_to: 'APPLICANT' },
      { document_type: 'RATION_CARD', document_name: 'Ration Card', related_to: 'APPLICANT' }
    ]));
    fdRes.append('files', new Blob([createDummyPdfBuffer('Aadhaar')], { type: 'application/pdf' }), 'aadhaar.pdf');
    fdRes.append('files', new Blob([createDummyPdfBuffer('Ration')], { type: 'application/pdf' }), 'ration.pdf');

    const resAppRes = await apiRequest('/api/applications', {
      method: 'POST',
      body: fdRes,
      token: s4CitToken
    });
    recordCheck('S4', 'Residence certificate creates 0 external verification requests', resAppRes.status === 201 && resAppRes.data.data.created_requests_count === 0);
    const manualAppId = resAppRes.data.data.application_id;

    // 3. Home officer manually creates a verification request for an application
    const createManRes = await apiRequest('/api/verification-requests', {
      method: 'POST',
      token: ktrOfficerToken,
      body: {
        application_id: manualAppId,
        verifying_panchayat_id: 2, // Kollam GP
        subject_party: 'OTHER',
        subject_name: 'Akhil K S',
        purpose: 'Verify previous residence period in Kollam GP'
      }
    });
    recordCheck('S4', 'Home officer manually creates extra verification request', createManRes.status === 201 && createManRes.data.data.status === 'PENDING');
    const manualReqId = createManRes.data.data.verification_id;

    // Verify application status changed to PENDING_EXTERNAL
    const [appManRow] = await dbPool.query('SELECT status FROM applications WHERE application_id = ?', [manualAppId]);
    recordCheck('S4', 'Application status updated to PENDING_EXTERNAL after manual request', appManRow[0].status === 'PENDING_EXTERNAL');

    // 4. Wrong password when signing (Kollam officer attempts to sign pending manualReqId with wrong password)
    const wrongPassRes = await apiRequest(`/api/verification-requests/${manualReqId}/respond`, {
      method: 'POST',
      token: klmOfficerToken,
      body: {
        decision: 'APPROVED',
        remarks: 'Trying with wrong password',
        password: 'WrongPassword@999'
      }
    });
    recordCheck('S4', 'Signing attempt with incorrect password fails with 401 Unauthorized', wrongPassRes.status === 401);

    // 5. Cancel verification request
    const cancelReqRes = await apiRequest(`/api/verification-requests/${manualReqId}/cancel`, {
      method: 'POST',
      token: ktrOfficerToken
    });
    recordCheck('S4', 'Home officer cancels pending verification request', cancelReqRes.status === 200 && cancelReqRes.data.data.status === 'CANCELLED');
  } catch (err) {
    recordCheck('S4', `Fatal error during S4 execution: ${err.message}`, false);
  }

  // -----------------------------------------------------------------
  // SCENARIO S5: CRYPTOGRAPHIC TAMPER DEMONSTRATION
  // -----------------------------------------------------------------
  console.log('\n>>> SCENARIO S5: CRYPTOGRAPHIC TAMPER DEMONSTRATION');
  try {
    // Seeded CP-2026-0003 is already signed by officer.anchal (KDK -> ANC)
    const [signedReqRows] = await dbPool.query(
      "SELECT verification_id, application_id, response_remarks, signature FROM verification_requests WHERE request_no = 'CP-2026-0003'"
    );
    assert.strictEqual(signedReqRows.length, 1);
    const s5Req = signedReqRows[0];
    const s5ReqId = s5Req.verification_id;
    const originalRemarks = s5Req.response_remarks;

    // 1. Initial integrity check: Must be VALID
    const initialCheck = await apiRequest(`/api/verification-requests/${s5ReqId}/signature-check`, { token: adminToken });
    recordCheck('S5', 'Signed request CP-2026-0003 initially verifies 100% VALID', initialCheck.status === 200 && initialCheck.data.data.valid === true);

    // 2. Tamper directly in MySQL: alter response_remarks
    await dbPool.query(
      "UPDATE verification_requests SET response_remarks = 'TAMPERED: Altered revenue records by unauthorized party.' WHERE verification_id = ?",
      [s5ReqId]
    );

    // 3. Verify signature check detects tampering
    const tamperedCheck = await apiRequest(`/api/verification-requests/${s5ReqId}/signature-check`, { token: adminToken });
    recordCheck('S5', 'Signature check detects tampering and returns valid: false', tamperedCheck.status === 200 && tamperedCheck.data.data.valid === false);
    recordCheck('S5', 'Reason correctly indicates fields/content mismatch', tamperedCheck.data.data.reason?.toLowerCase().includes('match') || tamperedCheck.data.data.reason?.toLowerCase().includes('tamper'));

    // 4. Verify Admin Signature Audit lists the invalid signature
    const sigAuditRes = await apiRequest('/api/admin/signatures/audit', { token: adminToken });
    const auditedRow = sigAuditRes.data.data.rows?.find(r => r.request_no === 'CP-2026-0003');
    recordCheck('S5', 'Admin Signatures Audit workspace flags tampered request as INVALID', auditedRow && (auditedRow.is_valid === false || auditedRow.status === 'INVALID' || auditedRow.valid === false));

    // 5. Restore original remarks in MySQL
    await dbPool.query(
      'UPDATE verification_requests SET response_remarks = ? WHERE verification_id = ?',
      [originalRemarks, s5ReqId]
    );

    // 6. Verify restored record returns VALID again
    const restoredCheck = await apiRequest(`/api/verification-requests/${s5ReqId}/signature-check`, { token: adminToken });
    recordCheck('S5', 'Restoring original remarks restores cryptographic validity (valid: true)', restoredCheck.data.data.valid === true);
  } catch (err) {
    recordCheck('S5', `Fatal error during S5 execution: ${err.message}`, false);
  }

  // -----------------------------------------------------------------
  // SCENARIO S6: PERMISSIONS & RBAC DATA ISOLATION
  // -----------------------------------------------------------------
  console.log('\n>>> SCENARIO S6: PERMISSIONS & RBAC DATA ISOLATION');
  try {
    // 1. Citizen A tries to fetch Citizen B's application -> 404 (or 403)
    const cit1Login = await loginUser('9876500001', 'Citizen@123', 'CITIZEN'); // Akhil
    const cit2Login = await loginUser('9876500002', 'Citizen@123', 'CITIZEN'); // Anu
    const cit1Token = cit1Login.data.data.token;

    // Get an application of citizen 2
    const [c2Apps] = await dbPool.query(
      'SELECT application_id FROM applications WHERE citizen_id = (SELECT citizen_id FROM citizens WHERE user_id = ?) LIMIT 1',
      [cit2Login.data.data.user.user_id]
    );
    if (c2Apps.length > 0) {
      const c2AppId = c2Apps[0].application_id;
      const isolationRes1 = await apiRequest(`/api/applications/${c2AppId}`, { token: cit1Token });
      recordCheck('S6', 'Citizen A accessing Citizen B application returns 404 (Data Isolation)', isolationRes1.status === 404 || isolationRes1.status === 403);
    }

    // 2. Officer of Kollam GP tries to view Kottarakara GP application not assigned to Kollam -> 404
    const [ktrApps] = await dbPool.query(
      `SELECT a.application_id FROM applications a
       WHERE a.home_panchayat_id = 1
         AND a.application_id NOT IN (
           SELECT application_id FROM verification_requests WHERE verifying_panchayat_id = 2
         ) LIMIT 1`
    );
    if (ktrApps.length > 0) {
      const foreignAppRes = await apiRequest(`/api/applications/${ktrApps[0].application_id}`, { token: klmOfficerToken });
      recordCheck('S6', 'Officer accessing foreign application without assigned request returns 404', foreignAppRes.status === 404);
    }

    // 3. Officer tries to download document of unrelated application -> 404
    const [unrelatedDocs] = await dbPool.query(
      `SELECT d.document_id FROM application_documents d
       JOIN applications a ON d.application_id = a.application_id
       WHERE a.home_panchayat_id = 1 AND d.related_to = 'APPLICANT' LIMIT 1`
    );
    if (unrelatedDocs.length > 0) {
      const docRes = await apiRequest(`/api/documents/${unrelatedDocs[0].document_id}/file`, { token: klmOfficerToken });
      recordCheck('S6', 'Verifying officer downloading unrelated applicant document returns 404', docRes.status === 404 || docRes.status === 403);
    }

    // 4. Admin tries to approve an application -> 403 Forbidden
    const adminApproveRes = await apiRequest(`/api/applications/1/decision`, {
      method: 'POST',
      token: adminToken,
      body: { decision: 'APPROVE', remarks: 'Admin trying to approve' }
    });
    recordCheck('S6', 'Admin attempting to approve application returns 403 Forbidden', adminApproveRes.status === 403);

    // 5. Admin tries to sign verification request -> 403 Forbidden
    const adminSignRes = await apiRequest('/api/verification-requests/1/respond', {
      method: 'POST',
      token: adminToken,
      body: { decision: 'APPROVED', remarks: 'Admin sign', password: 'Admin@123' }
    });
    recordCheck('S6', 'Admin attempting to sign verification request returns 403 Forbidden', adminSignRes.status === 403);

    // 6. Citizen tries to access Admin user management -> 403 Forbidden
    const citAdminAccess = await apiRequest('/api/admin/users', { token: cit1Token });
    recordCheck('S6', 'Citizen attempting to access /api/admin/users returns 403 Forbidden', citAdminAccess.status === 403);
  } catch (err) {
    recordCheck('S6', `Fatal error during S6 execution: ${err.message}`, false);
  }

  // -----------------------------------------------------------------
  // SCENARIO S7: OFFICER ACCOUNT LIFECYCLE & SIGNING
  // -----------------------------------------------------------------
  console.log('\n>>> SCENARIO S7: OFFICER ACCOUNT LIFECYCLE & SIGNING');
  try {
    const s7Username = `officer.s7_${Date.now()}`;
    const s7EmpId = `EMP-S7-${Math.floor(1000 + Math.random() * 9000)}`;
    const s7Mobile = `98499${Math.floor(10000 + Math.random() * 90000)}`;

    // 1. Admin provisions new Officer in Pathanapuram GP (id 6)
    const createOffRes = await apiRequest('/api/admin/users', {
      method: 'POST',
      token: adminToken,
      body: {
        role: 'OFFICER',
        username: s7Username,
        password: 'Officer@123',
        full_name: 'Suresh Babu S7',
        email: `${s7Username}@connectedpanchayat.test`,
        mobile: s7Mobile,
        panchayat_id: 6, // Pathanapuram GP
        designation: 'Assistant Secretary',
        employee_id: s7EmpId
      }
    });
    recordCheck('S7', 'Admin provisions new Panchayat Officer', createOffRes.status === 201);
    const newOfficerUserId = createOffRes.data.data.user_id;

    // 2. Verify RSA-2048 keypair, encrypted private key, and SHA-256 fingerprint in DB
    const [officerKeyRows] = await dbPool.query(
      'SELECT officer_id, public_key, private_key_encrypted, key_fingerprint FROM panchayat_officers WHERE user_id = ?',
      [newOfficerUserId]
    );
    recordCheck('S7', 'DB verification: RSA public key and encrypted private key generated', officerKeyRows.length === 1 && !!officerKeyRows[0].public_key && !!officerKeyRows[0].private_key_encrypted);
    recordCheck('S7', 'DB verification: SHA-256 key fingerprint saved (64 hex characters)', officerKeyRows[0].key_fingerprint?.length === 64);
    const newOfficerFingerprint = officerKeyRows[0].key_fingerprint;

    // 3. New Officer logs in
    const newOffLogin = await loginUser(s7Username, 'Officer@123', 'OFFICIAL');
    recordCheck('S7', 'New officer successfully logs in', newOffLogin.status === 200);
    const newOfficerToken = newOffLogin.data.data.token;

    // 4. New Officer signs a verification request directed to Pathanapuram GP (6)
    const [someKtrApp] = await dbPool.query('SELECT application_id FROM applications WHERE home_panchayat_id = 1 LIMIT 1');
    const targetAppId = someKtrApp[0].application_id;

    const [insertReq] = await dbPool.query(
      `INSERT INTO verification_requests
       (request_no, application_id, requesting_panchayat_id, verifying_panchayat_id, subject_party, subject_name, purpose, status, due_at)
       VALUES (?, ?, 1, 6, 'OTHER', 'Test Subject Verification', 'Record Verification', 'PENDING', DATE_ADD(NOW(), INTERVAL 3 DAY))`,
      [`CP-S7-${Date.now().toString().slice(-4)}`, targetAppId]
    );
    const s7ReqId = insertReq.insertId;

    // Sign request with new officer
    const s7SignRes = await apiRequest(`/api/verification-requests/${s7ReqId}/respond`, {
      method: 'POST',
      token: newOfficerToken,
      body: {
        decision: 'APPROVED',
        remarks: 'Signed by newly provisioned officer Suresh Babu',
        password: 'Officer@123'
      }
    });
    recordCheck('S7', 'Newly provisioned officer signs verification request', s7SignRes.status === 200 && s7SignRes.data.data.status === 'APPROVED');

    // Verify cryptographic signature matches new officer's fingerprint
    const s7SigCheck = await apiRequest(`/api/verification-requests/${s7ReqId}/signature-check`, { token: adminToken });
    recordCheck('S7', 'Signature check validates with newly provisioned officer key fingerprint', s7SigCheck.data.data.valid === true && s7SigCheck.data.data.fingerprint === newOfficerFingerprint);

    // 5. Admin deactivates the new officer
    const deactRes = await apiRequest(`/api/admin/users/${newOfficerUserId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'INACTIVE' }
    });
    recordCheck('S7', 'Admin deactivates officer account', deactRes.status === 200);

    // 6. Deactivated officer login attempt is BLOCKED
    const deactLoginRes = await loginUser(s7Username, 'Officer@123', 'OFFICIAL');
    recordCheck('S7', 'Deactivated officer login is rejected with 403 Forbidden', deactLoginRes.status === 403);

    // 7. Verify existing signature by deactivated officer remains VALID
    const sigCheckAfterDeact = await apiRequest(`/api/verification-requests/${s7ReqId}/signature-check`, { token: adminToken });
    recordCheck('S7', 'Existing signature made prior to deactivation remains cryptographically VALID', sigCheckAfterDeact.data.data.valid === true);
  } catch (err) {
    recordCheck('S7', `Fatal error during S7 execution: ${err.message}`, false);
  }

  await dbPool.end();

  console.log('\n======================================================');
  console.log('PHASE 3 SCENARIO TESTING SUMMARY');
  console.log('======================================================');
  console.log(`Total Checks Run: ${passedChecks + failedChecks}`);
  console.log(`Passed: ${passedChecks}`);
  console.log(`Failed: ${failedChecks}`);
  console.log('======================================================\n');

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runPhase3Scenarios().catch(err => {
  console.error('Phase 3 Fatal Error:', err);
  process.exit(1);
});
