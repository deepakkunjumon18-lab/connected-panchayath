/**
 * End-to-End Automated Test Suite for Connected Panchayat
 * Uses Node.js built-in test runner (node:test) and native fetch.
 * Runs on an isolated test database: connected_panchayat_test.
 */

// Override DB_NAME and NODE_ENV before requiring app/env modules
process.env.DB_NAME = 'connected_panchayat_test';
process.env.NODE_ENV = 'test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

let app;
let server;
let baseUrl = '';
let db;

// Summary trackers
const testResults = [];
function recordResult(name, passed, error = null) {
  testResults.push({ name, passed, error });
}

// HTTP request helpers
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

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: reqHeaders,
    body: reqBody
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else if (contentType.includes('application/pdf')) {
    data = await res.arrayBuffer();
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

// -------------------------------------------------------------
// MAIN TEST SUITE
// -------------------------------------------------------------
describe('Connected Panchayat End-to-End Test Suite', () => {

  before(async () => {
    console.log('\n======================================================');
    console.log('INITIALIZING TEST ENVIRONMENT');
    console.log('Database: connected_panchayat_test');
    console.log('======================================================');

    // 1. Drop and recreate test database with schema
    const rawConn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    await rawConn.query('DROP DATABASE IF EXISTS connected_panchayat_test;');
    const schemaSql = fs.readFileSync(path.resolve(__dirname, '../sql/schema.sql'), 'utf8')
      .replace(/connected_panchayat/g, 'connected_panchayat_test');
    await rawConn.query(schemaSql);
    await rawConn.end();

    // 2. Load DB config and run seed
    db = require('../src/config/db');
    const seed = require('../scripts/seed');
    await seed();

    // 3. Start Express server on ephemeral port
    app = require('../src/app');
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`Test API server running at ${baseUrl}\n`);
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      server.close();
    }
    if (db && db.pool) {
      await db.pool.end();
    }

    console.log('\n======================================================');
    console.log('END-TO-END TEST EXECUTION SUMMARY');
    console.log('======================================================');
    let passedCount = 0;
    let failedCount = 0;
    for (const r of testResults) {
      if (r.passed) {
        passedCount++;
        console.log(`  ✓ ${r.name}`);
      } else {
        failedCount++;
        console.log(`  ✗ ${r.name} - ERROR: ${r.error?.message || r.error}`);
      }
    }
    console.log('------------------------------------------------------');
    console.log(`TOTAL: ${testResults.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log('======================================================\n');
  });

  // Shared state across sequential workflow steps
  let adminToken = '';
  let officerKtrToken = '';
  let officerKlmToken = '';
  let officerKdkToken = '';
  let officerAncToken = '';
  let citizenToken = '';
  let citizenUser = null;
  let newCitizenToken = '';
  let ewsAppId = null;
  let ewsAppNo = '';
  let ewsReqKlmId = null;
  let ewsReqAncId = null;
  let residenceAppId = null;
  let issuedCertId = null;
  let issuedCertCode = '';

  // -------------------------------------------------------------
  // 1. AUTH & ROLE SCENARIOS
  // -------------------------------------------------------------
  describe('1. Authentication and Access Control', () => {
    it('should authenticate Admin, Officer, and Citizen successfully', async () => {
      const resAdmin = await loginUser('admin', 'Admin@123', 'OFFICIAL');
      assert.strictEqual(resAdmin.status, 200);
      assert.strictEqual(resAdmin.data.data.user.role, 'ADMIN');
      adminToken = resAdmin.data.data.token;

      const resKtr = await loginUser('officer.kottarakara', 'Officer@123', 'OFFICIAL');
      assert.strictEqual(resKtr.status, 200);
      assert.strictEqual(resKtr.data.data.user.role, 'OFFICER');
      assert.strictEqual(resKtr.data.data.user.panchayat_id, 1);
      officerKtrToken = resKtr.data.data.token;

      const resKlm = await loginUser('officer.kollam', 'Officer@123', 'OFFICIAL');
      assert.strictEqual(resKlm.status, 200);
      officerKlmToken = resKlm.data.data.token;

      const resKdk = await loginUser('officer.kadakkal', 'Officer@123', 'OFFICIAL');
      assert.strictEqual(resKdk.status, 200);
      officerKdkToken = resKdk.data.data.token;

      const resAnc = await loginUser('officer.anchal', 'Officer@123', 'OFFICIAL');
      assert.strictEqual(resAnc.status, 200);
      officerAncToken = resAnc.data.data.token;

      const resCit = await loginUser('9876500002', 'Citizen@123', 'CITIZEN'); // Anu Thomas (Kottarakara)
      assert.strictEqual(resCit.status, 200);
      assert.strictEqual(resCit.data.data.user.role, 'CITIZEN');
      citizenToken = resCit.data.data.token;
      citizenUser = resCit.data.data.user;

      recordResult('Auth: Valid credentials log in for ADMIN, OFFICER, CITIZEN', true);
    });

    it('should reject login with wrong password (401)', async () => {
      const res = await loginUser('admin', 'IncorrectPassword123', 'OFFICIAL');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
      recordResult('Auth: Wrong password returns 401', true);
    });

    it('should reject login under wrong portal tab (403)', async () => {
      // Officer attempting citizen portal tab
      const res1 = await loginUser('officer.kottarakara', 'Officer@123', 'CITIZEN');
      assert.strictEqual(res1.status, 403);
      assert.match(res1.data.message, /Please use the correct login tab/i);

      // Citizen attempting official portal tab
      const res2 = await loginUser('9876500002', 'Citizen@123', 'OFFICIAL');
      assert.strictEqual(res2.status, 403);
      assert.match(res2.data.message, /Please use the correct login tab/i);

      recordResult('Auth: Wrong login portal tab returns 403', true);
    });

    it('should reject deactivated user login (403)', async () => {
      // Temporarily deactivate a user
      await db.query("UPDATE users SET status = 'INACTIVE' WHERE username = 'officer.anchal'");
      const res = await loginUser('officer.anchal', 'Officer@123', 'OFFICIAL');
      assert.strictEqual(res.status, 403);
      assert.match(res.data.message, /inactive/i);

      // Restore user status
      await db.query("UPDATE users SET status = 'ACTIVE' WHERE username = 'officer.anchal'");
      recordResult('Auth: Inactive user login returns 403', true);
    });
  });

  // -------------------------------------------------------------
  // 2. CITIZEN REGISTRATION
  // -------------------------------------------------------------
  describe('2. Citizen Self-Registration', () => {
    it('should register a new citizen successfully (201)', async () => {
      const regPayload = {
        full_name: 'George Varghese E2E',
        email: 'george.varghese@test.local',
        mobile: '9847099999',
        aadhaar_no: '998877665544',
        date_of_birth: '1998-06-15',
        gender: 'MALE',
        address: 'Varghese Villa, Ward 4, Kottarakara',
        panchayat_id: 1, // Kottarakara
        password: 'Citizen@123'
      };

      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: regPayload
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.user.role, 'CITIZEN');
      assert.strictEqual(res.data.data.user.full_name, 'George Varghese E2E');
      newCitizenToken = res.data.data.token;

      // Verify newly registered user can log in
      const loginCheck = await loginUser('9847099999', 'Citizen@123', 'CITIZEN');
      assert.strictEqual(loginCheck.status, 200);

      recordResult('Registration: Citizen self-registration returns 201 and valid JWT', true);
    });
  });

  // -------------------------------------------------------------
  // 3. APPLICATION WORKFLOWS & INTER-PANCHAYAT REQUEST GENERATION
  // -------------------------------------------------------------
  describe('3. Application Submission and Verification Requests', () => {
    it('should reject application when mandatory documents are missing (400)', async () => {
      const fd = new FormData();
      const appData = {
        certificate_type_id: 3, // RESIDENCE (requires AADHAAR and RATION_CARD)
        purpose: 'School Admission',
        declared_family_income: 120000,
        land_holding_cents: 10,
        house_area_sqft: 800,
        parties: []
      };
      // Provide only 1 document instead of both
      const fileMeta = [
        { document_type: 'AADHAAR', document_name: 'Aadhaar Card', related_to: 'APPLICANT' }
      ];

      fd.append('data', JSON.stringify(appData));
      fd.append('fileMeta', JSON.stringify(fileMeta));
      fd.append('files', new Blob(['fake-pdf-content'], { type: 'application/pdf' }), 'aadhaar.pdf');

      const res = await apiRequest('/api/applications', {
        method: 'POST',
        body: fd,
        token: newCitizenToken
      });

      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /Missing mandatory document/i);
      recordResult('Application: Missing mandatory document rejected with 400', true);
    });

    it('should submit RESIDENCE certificate with 0 external requests (SUBMITTED status)', async () => {
      const fd = new FormData();
      const appData = {
        certificate_type_id: 3, // RESIDENCE
        purpose: 'Passport Application',
        declared_family_income: 150000,
        land_holding_cents: 8,
        house_area_sqft: 750,
        parties: []
      };
      const fileMeta = [
        { document_type: 'AADHAAR', document_name: 'Aadhaar Card', related_to: 'APPLICANT' },
        { document_type: 'RATION_CARD', document_name: 'Ration Card', related_to: 'APPLICANT' }
      ];

      fd.append('data', JSON.stringify(appData));
      fd.append('fileMeta', JSON.stringify(fileMeta));
      fd.append('files', new Blob(['sample-aadhaar-content'], { type: 'application/pdf' }), 'aadhaar.pdf');
      fd.append('files', new Blob(['sample-ration-content'], { type: 'application/pdf' }), 'ration.pdf');

      const res = await apiRequest('/api/applications', {
        method: 'POST',
        body: fd,
        token: newCitizenToken
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.status, 'SUBMITTED');
      assert.strictEqual(res.data.data.created_requests_count, 0);

      residenceAppId = res.data.data.application_id;
      recordResult('Application: RESIDENCE submitted with 0 external requests (status SUBMITTED)', true);
    });

    it('should submit EWS application with parents in 2 other panchayats, creating 2 verification requests', async () => {
      // Citizen George is in Panchayat 1 (Kottarakara)
      // Father in Panchayat 2 (Kollam) -> external request 1
      // Mother in Panchayat 4 (Anchal) -> external request 2
      const fd = new FormData();
      const appData = {
        certificate_type_id: 1, // EWS
        purpose: 'Higher Education Admission',
        declared_family_income: 180000,
        land_holding_cents: 12,
        house_area_sqft: 900,
        parties: [
          {
            party_type: 'FATHER',
            full_name: 'Varghese George Sr',
            aadhaar_no: '889900112233',
            occupation: 'AGRICULTURE',
            annual_income: 100000,
            property_details: '10 cents dry land',
            panchayat_id: 2 // Kollam
          },
          {
            party_type: 'MOTHER',
            full_name: 'Mariamma Varghese',
            aadhaar_no: '990011223344',
            occupation: 'HOMEMAKER',
            annual_income: 0,
            property_details: 'None',
            panchayat_id: 4 // Anchal
          }
        ]
      };

      const fileMeta = [
        { document_type: 'AADHAAR', document_name: 'Applicant Aadhaar', related_to: 'APPLICANT' },
        { document_type: 'RATION_CARD', document_name: 'Ration Card', related_to: 'APPLICANT' },
        { document_type: 'INCOME_PROOF', document_name: 'Income Certificate / Proof', related_to: 'APPLICANT' },
        { document_type: 'PROPERTY_TAX', document_name: 'Land Tax Receipt', related_to: 'APPLICANT' },
        { document_type: 'FATHER_ID', document_name: "Father's ID Proof", related_to: 'FATHER' },
        { document_type: 'MOTHER_ID', document_name: "Mother's ID Proof", related_to: 'MOTHER' }
      ];

      fd.append('data', JSON.stringify(appData));
      fd.append('fileMeta', JSON.stringify(fileMeta));
      for (const m of fileMeta) {
        fd.append('files', new Blob([`pdf-bytes-for-${m.document_type}`], { type: 'application/pdf' }), `${m.document_type}.pdf`);
      }

      const res = await apiRequest('/api/applications', {
        method: 'POST',
        body: fd,
        token: newCitizenToken
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.status, 'PENDING_EXTERNAL');
      assert.strictEqual(res.data.data.created_requests_count, 2);

      ewsAppId = res.data.data.application_id;
      ewsAppNo = res.data.data.application_no;

      // Verify 2 requests exist in DB
      const requests = await db.query(
        'SELECT * FROM verification_requests WHERE application_id = ? ORDER BY verification_id ASC',
        [ewsAppId]
      );
      assert.strictEqual(requests.length, 2);
      assert.strictEqual(requests[0].verifying_panchayat_id, 2); // Kollam
      assert.strictEqual(requests[0].status, 'PENDING');
      assert.strictEqual(requests[1].verifying_panchayat_id, 4); // Anchal
      assert.strictEqual(requests[1].status, 'PENDING');

      ewsReqKlmId = requests[0].verification_id;
      ewsReqAncId = requests[1].verification_id;

      recordResult('Application: EWS creates 2 external verification requests (status PENDING_EXTERNAL)', true);
    });
  });

  // -------------------------------------------------------------
  // 4. DATA ISOLATION & OFFICER SCOPING
  // -------------------------------------------------------------
  describe('4. Data Isolation and Scoping', () => {
    it('officer of a third panchayat gets 404 on foreign application, request, and documents', async () => {
      // Officer Kadakkal (Panchayat 3) tries to access EWS application (Panchayat 1)
      const resApp = await apiRequest(`/api/applications/${ewsAppId}`, {
        token: officerKdkToken
      });
      assert.strictEqual(resApp.status, 404);

      // Officer Kadakkal tries to access request between Panchayat 1 and 2
      const resReq = await apiRequest(`/api/verification-requests/${ewsReqKlmId}`, {
        token: officerKdkToken
      });
      assert.strictEqual(resReq.status, 404);

      // Officer Kadakkal tries to access document of foreign application
      const docs = await db.query('SELECT document_id FROM application_documents WHERE application_id = ? LIMIT 1', [ewsAppId]);
      const resDoc = await apiRequest(`/api/applications/${ewsAppId}/documents/${docs[0].document_id}/file`, {
        token: officerKdkToken
      });
      assert.strictEqual(resDoc.status, 404);

      recordResult('Scoping: Officer of third panchayat gets 404 on foreign app, request, document', true);
    });

    it('admin cannot approve applications or sign verification responses (403)', async () => {
      const resApprove = await apiRequest(`/api/applications/${ewsAppId}/decision`, {
        method: 'POST',
        body: { decision: 'APPROVED' },
        token: adminToken
      });
      assert.strictEqual(resApprove.status, 403);

      const resSign = await apiRequest(`/api/verification-requests/${ewsReqKlmId}/respond`, {
        method: 'POST',
        body: { decision: 'APPROVED', password: 'Admin@123', remarks: 'Admin override' },
        token: adminToken
      });
      assert.strictEqual(resSign.status, 403);

      recordResult('RBAC: Admin cannot approve applications or sign responses (403)', true);
    });
  });

  // -------------------------------------------------------------
  // 5. DIGITAL SIGNING, RESPONSES & CRYPTOGRAPHY
  // -------------------------------------------------------------
  describe('5. Inter-Panchayat Verification Responses and Digital Signatures', () => {
    it('responding with wrong officer password returns 401 and stores nothing', async () => {
      const res = await apiRequest(`/api/verification-requests/${ewsReqKlmId}/respond`, {
        method: 'POST',
        body: {
          decision: 'APPROVED',
          remarks: 'Verified from revenue records',
          password: 'IncorrectOfficerPassword'
        },
        token: officerKlmToken
      });

      assert.strictEqual(res.status, 401);
      assert.match(res.data.message, /Incorrect password/i);

      // Assert request remains in PENDING state in DB
      const row = (await db.query('SELECT status, signature FROM verification_requests WHERE verification_id = ?', [ewsReqKlmId]))[0];
      assert.strictEqual(row.status, 'PENDING');
      assert.strictEqual(row.signature, null);

      recordResult('Signing: Wrong officer password returns 401 and writes nothing to DB', true);
    });

    it('rejecting verification response without remarks returns 400', async () => {
      const res = await apiRequest(`/api/verification-requests/${ewsReqKlmId}/respond`, {
        method: 'POST',
        body: {
          decision: 'REJECTED',
          remarks: '   ',
          password: 'Officer@123'
        },
        token: officerKlmToken
      });

      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /Remarks are mandatory/i);
      recordResult('Signing: Rejecting without remarks returns 400', true);
    });

    it('responding APPROVED with correct password stores RSA-2048 digital signature', async () => {
      const res = await apiRequest(`/api/verification-requests/${ewsReqKlmId}/respond`, {
        method: 'POST',
        body: {
          decision: 'APPROVED',
          remarks: 'Father land holdings and agricultural income verified from ward register',
          password: 'Officer@123'
        },
        token: officerKlmToken
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.status, 'APPROVED');
      assert.strictEqual(res.data.data.signature_check.valid, true);

      // Verify row in DB has valid signature and key fingerprint
      const row = (await db.query('SELECT * FROM verification_requests WHERE verification_id = ?', [ewsReqKlmId]))[0];
      assert.strictEqual(row.status, 'APPROVED');
      assert.ok(row.signature && row.signature.length > 50);
      assert.ok(row.signer_key_fingerprint && row.signer_key_fingerprint.length === 64);
      assert.ok(row.payload_json);

      recordResult('Signing: APPROVED response signed with RSA-2048 and verified valid', true);
    });

    it('double-responding to already answered request returns 409 Conflict', async () => {
      const res = await apiRequest(`/api/verification-requests/${ewsReqKlmId}/respond`, {
        method: 'POST',
        body: {
          decision: 'APPROVED',
          remarks: 'Trying to answer again',
          password: 'Officer@123'
        },
        token: officerKlmToken
      });

      assert.strictEqual(res.status, 409);
      assert.match(res.data.message, /already answered/i);
      recordResult('Signing: Double response returns 409 Conflict', true);
    });

    it('tampering with DB remarks invalidates signature check and blocks application approval', async () => {
      // 1. Tamper with DB row for ewsReqKlmId
      const originalRow = (await db.query('SELECT response_remarks FROM verification_requests WHERE verification_id = ?', [ewsReqKlmId]))[0];
      await db.query(
        'UPDATE verification_requests SET response_remarks = "FORGED FRAUDULENT RECORD" WHERE verification_id = ?',
        [ewsReqKlmId]
      );

      // 2. Fetch request details - signature check must fail
      const resReq = await apiRequest(`/api/verification-requests/${ewsReqKlmId}`, {
        token: officerKlmToken
      });
      assert.strictEqual(resReq.data.data.signature_check.valid, false);
      assert.match(resReq.data.data.signature_check.reason, /tampering detected|signature.*invalid/i);

      // 3. Attempting to approve application must be blocked
      const resApprove = await apiRequest(`/api/applications/${ewsAppId}/decision`, {
        method: 'POST',
        body: { decision: 'APPROVED' },
        token: officerKtrToken
      });
      assert.strictEqual(resApprove.status, 400);
      assert.match(resApprove.data.message, /Signature.*INVALID|Cannot approve/i);

      // 4. Restore original remarks
      await db.query(
        'UPDATE verification_requests SET response_remarks = ? WHERE verification_id = ?',
        [originalRow.response_remarks, ewsReqKlmId]
      );

      // 5. Signature check becomes valid again
      const resRestored = await apiRequest(`/api/verification-requests/${ewsReqKlmId}`, {
        token: officerKlmToken
      });
      assert.strictEqual(resRestored.data.data.signature_check.valid, true);

      recordResult('Tamper Detection: Modified DB remarks invalidate signature and block approval', true);
    });
  });

  // -------------------------------------------------------------
  // 6. REMINDER COOLDOWN & OVERDUE RULES
  // -------------------------------------------------------------
  describe('6. Reminder Rules and Overdue Flags', () => {
    it('enforces reminder cooldown (400 if sent within 24h of request)', async () => {
      // Officer Kottarakara tries to remind Anchal about ewsReqAncId immediately
      const res = await apiRequest(`/api/verification-requests/${ewsReqAncId}/remind`, {
        method: 'POST',
        token: officerKtrToken
      });

      assert.strictEqual(res.status, 400);
      assert.match(res.data.message, /Reminder cooldown active/i);

      // Set due_at in past to simulate overdue condition, which allows reminder
      await db.query('UPDATE verification_requests SET due_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE verification_id = ?', [ewsReqAncId]);

      const resOverdueRemind = await apiRequest(`/api/verification-requests/${ewsReqAncId}/remind`, {
        method: 'POST',
        token: officerKtrToken
      });
      assert.strictEqual(resOverdueRemind.status, 200);
      assert.strictEqual(resOverdueRemind.data.data.reminder_count, 1);

      recordResult('Reminders: 24h cooldown enforced; overdue bypasses cooldown and increments count', true);
    });

    it('computes is_overdue flag correctly on verification requests', async () => {
      const resList = await apiRequest('/api/verification-requests?direction=incoming', {
        token: officerAncToken
      });
      const reqRow = resList.data.data.items.find((r) => r.verification_id === ewsReqAncId);
      assert.ok(reqRow);
      assert.strictEqual(reqRow.is_overdue, true);

      // Reset due_at to future
      await db.query('UPDATE verification_requests SET due_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE verification_id = ?', [ewsReqAncId]);
      const resListFuture = await apiRequest('/api/verification-requests?direction=incoming', {
        token: officerAncToken
      });
      const reqRowFuture = resListFuture.data.data.items.find((r) => r.verification_id === ewsReqAncId);
      assert.strictEqual(reqRowFuture.is_overdue, false);

      recordResult('Overdue: is_overdue dynamically computed based on due_at timestamp', true);
    });
  });

  // -------------------------------------------------------------
  // 7. DOCUMENT VERIFICATION & APPLICATION APPROVAL LIFECYCLE
  // -------------------------------------------------------------
  describe('7. Document Verification and Decision Lifecycle', () => {
    it('blocks application approval while external requests or documents are pending', async () => {
      const resApprove = await apiRequest(`/api/applications/${ewsAppId}/decision`, {
        method: 'POST',
        body: { decision: 'APPROVED' },
        token: officerKtrToken
      });

      assert.strictEqual(resApprove.status, 400);
      assert.ok(
        (resApprove.data.errors && resApprove.data.errors.blockers && resApprove.data.errors.blockers.length > 0) ||
        (resApprove.data.message && resApprove.data.message.includes('Cannot approve'))
      );
      recordResult('Approval: Blocked while external requests or documents are unverified', true);
    });

    it('verifies applicant documents by home panchayat officer', async () => {
      // Fetch documents for ewsAppId
      const appRes = await apiRequest(`/api/applications/${ewsAppId}`, { token: officerKtrToken });
      const docs = appRes.data.data.documents;

      // Home officer verifies all APPLICANT documents
      for (const doc of docs) {
        if (doc.related_to === 'APPLICANT') {
          const vRes = await apiRequest(`/api/applications/${ewsAppId}/documents/${doc.document_id}/verify`, {
            method: 'PATCH',
            body: { status: 'VERIFIED', remarks: 'Verified from Aadhaar / Ration registry' },
            token: officerKtrToken
          });
          assert.strictEqual(vRes.status, 200);
          assert.strictEqual(vRes.data.data.verification_status, 'VERIFIED');
        }
      }

      recordResult('Documents: Home officer successfully verifies applicant documents', true);
    });

    it('officer of Anchal signs remaining request, transitioning application to READY_FOR_DECISION', async () => {
      const res = await apiRequest(`/api/verification-requests/${ewsReqAncId}/respond`, {
        method: 'POST',
        body: {
          decision: 'APPROVED',
          remarks: 'Mother background and household details verified from local ward roster',
          password: 'Officer@123'
        },
        token: officerAncToken
      });
      assert.strictEqual(res.status, 200);

      // Verify application status updated to READY_FOR_DECISION
      const appRow = (await db.query('SELECT status FROM applications WHERE application_id = ?', [ewsAppId]))[0];
      assert.strictEqual(appRow.status, 'READY_FOR_DECISION');

      recordResult('Workflow: Final signed request transitions application to READY_FOR_DECISION', true);
    });

    it('home officer approves application when all conditions are satisfied (APPROVED status)', async () => {
      const resApprove = await apiRequest(`/api/applications/${ewsAppId}/decision`, {
        method: 'POST',
        body: { decision: 'APPROVED', remarks: 'All family details and property verified across panchayats' },
        token: officerKtrToken
      });

      assert.strictEqual(resApprove.status, 200);
      assert.strictEqual(resApprove.data.data.status, 'APPROVED');

      recordResult('Workflow: Home officer approves application with APPROVED status', true);
    });
  });

  // -------------------------------------------------------------
  // 8. CERTIFICATE ISSUANCE, PDF GENERATION & QR VERIFICATION
  // -------------------------------------------------------------
  describe('8. Certificate Issuance, PDF Download, and Public Verification', () => {
    it('issues certificate with valid PDF generated on disk (starts with %PDF)', async () => {
      const resIssue = await apiRequest(`/api/applications/${ewsAppId}/issue-certificate`, {
        method: 'POST',
        token: officerKtrToken
      });

      assert.strictEqual(resIssue.status, 201);
      assert.strictEqual(resIssue.data.success, true);
      assert.ok(resIssue.data.data.certificate_no);
      assert.ok(resIssue.data.data.verification_code);

      issuedCertId = resIssue.data.data.certificate_id;
      issuedCertCode = resIssue.data.data.verification_code;

      // Verify certificate file on disk exists and starts with %PDF
      const certRow = (await db.query('SELECT * FROM certificates WHERE certificate_id = ?', [issuedCertId]))[0];
      const filePath = path.isAbsolute(certRow.certificate_file)
        ? certRow.certificate_file
        : path.join(__dirname, '../', certRow.certificate_file);

      assert.ok(fs.existsSync(filePath), 'Certificate PDF file must exist on disk');
      const fileBytes = fs.readFileSync(filePath);
      const magicBytes = fileBytes.subarray(0, 4).toString('ascii');
      assert.strictEqual(magicBytes, '%PDF', 'Certificate file must be a valid PDF starting with %PDF');

      recordResult('Certificate: Issued with professional PDF starting with %PDF', true);
    });

    it('allows certificate owner citizen to download PDF (200 with X-Integrity ok)', async () => {
      const res = await apiRequest(`/api/certificates/${issuedCertId}/download`, {
        token: newCitizenToken
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
      assert.strictEqual(res.headers.get('x-integrity'), 'ok');

      // Check downloaded buffer magic bytes
      const buf = Buffer.from(res.data);
      assert.strictEqual(buf.subarray(0, 4).toString('ascii'), '%PDF');

      recordResult('Certificate: Owner citizen downloads PDF with valid hash integrity', true);
    });

    it('prevents non-owner citizen from downloading foreign certificate (404)', async () => {
      // Citizen Akhil (KLM) tries to download George's certificate
      const resOtherCit = await loginUser('9876500001', 'Citizen@123', 'CITIZEN');
      const res = await apiRequest(`/api/certificates/${issuedCertId}/download`, {
        token: resOtherCit.data.data.token
      });

      assert.strictEqual(res.status, 404);
      recordResult('Security: Other citizen receives 404 attempting foreign certificate download', true);
    });

    it('verifies certificate publicly by verification code (200, valid)', async () => {
      const res = await apiRequest(`/api/certificates/verify/${issuedCertCode}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.valid, true);
      assert.strictEqual(res.data.data.status, 'VALID');
      assert.strictEqual(res.data.data.holder_name, 'George Varghese E2E');
      assert.strictEqual(res.data.data.integrity.fileHashMatches, true);

      recordResult('Public Verify: Valid verification code returns valid status & holder name', true);
    });

    it('returns NOT_FOUND status for nonexistent certificate verification code', async () => {
      const res = await apiRequest('/api/certificates/verify/NONEXISTENT999');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.data.valid, false);
      assert.strictEqual(res.data.data.status, 'NOT_FOUND');
      recordResult('Public Verify: Nonexistent verification code returns status NOT_FOUND', true);
    });
  });

  // -------------------------------------------------------------
  // 9. AUDIT TRAIL & SYSTEM NOTIFICATIONS
  // -------------------------------------------------------------
  describe('9. Audit Trail and System Notifications', () => {
    it('verifies notifications are generated for each major step in the workflow', async () => {
      const notifs = await db.query(
        'SELECT DISTINCT notification_type FROM notifications WHERE application_id = ?',
        [ewsAppId]
      );
      const types = notifs.map((n) => n.notification_type);

      assert.ok(types.includes('APPLICATION_SUBMITTED'), 'Missing APPLICATION_SUBMITTED notification');
      assert.ok(types.includes('NEW_APPLICATION'), 'Missing NEW_APPLICATION notification');
      assert.ok(types.includes('VERIFICATION_REQUEST'), 'Missing VERIFICATION_REQUEST notification');
      assert.ok(types.includes('VERIFICATION_RESPONSE'), 'Missing VERIFICATION_RESPONSE notification');
      assert.ok(types.includes('APPLICATION_APPROVED'), 'Missing APPLICATION_APPROVED notification');
      assert.ok(types.includes('CERTIFICATE_ISSUED'), 'Missing CERTIFICATE_ISSUED notification');

      recordResult('Audit & Notifications: Generated for submission, request, response, approval, issuance', true);
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (db && db.pool) {
      try {
        await db.pool.end();
      } catch (e) {
        // ignore connection closed
      }
    }
  });
});
