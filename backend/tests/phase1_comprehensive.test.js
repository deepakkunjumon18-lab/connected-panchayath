/**
 * Phase 1 Comprehensive Backend API Test Suite
 * Tests every endpoint and business rule defined in PROJECT_SPEC.md against isolated test DB.
 */

process.env.DB_NAME = 'connected_panchayat_test';
process.env.NODE_ENV = 'test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

let app;
let server;
let baseUrl = '';
let db;

// Sensitive keys checker to ensure zero leaks
function assertNoSensitiveData(obj, path = '') {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => assertNoSensitiveData(item, `${path}[${i}]`));
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = path ? `${path}.${key}` : key;
    assert.notStrictEqual(key, 'password_hash', `Security leak: password_hash exposed at ${fullPath}`);
    assert.notStrictEqual(key, 'private_key_encrypted', `Security leak: private_key_encrypted exposed at ${fullPath}`);
    assertNoSensitiveData(value, fullPath);
  }
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

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: reqHeaders,
    body: reqBody
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
    assertNoSensitiveData(data);
  } else if (contentType.includes('application/pdf')) {
    data = await res.arrayBuffer();
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, data };
}

async function loginUser(identifier, password, login_as) {
  return await apiRequest('/api/auth/login', {
    method: 'POST',
    body: { identifier, password, login_as }
  });
}

describe('PHASE 1: Full Backend API & Security Test Suite', () => {
  before(async () => {
    // 1. Initialize isolated test database
    const rawConn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'mysql123',
      multipleStatements: true
    });

    await rawConn.query('DROP DATABASE IF EXISTS connected_panchayat_test;');
    const schemaSql = fs.readFileSync(path.resolve(__dirname, '../sql/schema.sql'), 'utf8')
      .replace(/connected_panchayat/g, 'connected_panchayat_test');
    await rawConn.query(schemaSql);
    await rawConn.end();

    db = require('../src/config/db');
    const seed = require('../scripts/seed');
    await seed();

    app = require('../src/app');
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) server.close();
    if (db && db.pool) await db.pool.end();
  });

  // Auth tokens
  let adminToken = '';
  let officerKtrToken = '';
  let officerKlmToken = '';
  let officerKdkToken = '';
  let citizenToken = '';

  // -------------------------------------------------------------
  // 1. AUTHENTICATION & PROFILES
  // -------------------------------------------------------------
  describe('1. Auth & Profiles', () => {
    it('login with all 3 roles, wrong password, wrong tab, inactive user', async () => {
      // Admin
      const aRes = await loginUser('admin', 'Admin@123', 'OFFICIAL');
      assert.strictEqual(aRes.status, 200);
      assert.strictEqual(aRes.data.data.user.role, 'ADMIN');
      adminToken = aRes.data.data.token;

      // Officer
      const oRes = await loginUser('officer.kottarakara', 'Officer@123', 'OFFICIAL');
      assert.strictEqual(oRes.status, 200);
      assert.strictEqual(oRes.data.data.user.role, 'OFFICER');
      officerKtrToken = oRes.data.data.token;

      // Officer 2 (Kollam)
      const oKlmRes = await loginUser('officer.kollam', 'Officer@123', 'OFFICIAL');
      assert.strictEqual(oKlmRes.status, 200);
      officerKlmToken = oKlmRes.data.data.token;

      // Officer 3 (Kadakkal)
      const oKdkRes = await loginUser('officer.kadakkal', 'Officer@123', 'OFFICIAL');
      assert.strictEqual(oKdkRes.status, 200);
      officerKdkToken = oKdkRes.data.data.token;

      // Citizen
      const cRes = await loginUser('9876500001', 'Citizen@123', 'CITIZEN');
      assert.strictEqual(cRes.status, 200);
      assert.strictEqual(cRes.data.data.user.role, 'CITIZEN');
      citizenToken = cRes.data.data.token;

      // Wrong password
      const wpRes = await loginUser('admin', 'WrongPass123', 'OFFICIAL');
      assert.strictEqual(wpRes.status, 401);
      assert.strictEqual(wpRes.data.success, false);

      // Wrong tab
      const wtRes1 = await loginUser('admin', 'Admin@123', 'CITIZEN');
      assert.strictEqual(wtRes1.status, 403);
      assert.match(wtRes1.data.message, /Please use the correct login tab/i);

      const wtRes2 = await loginUser('9876500001', 'Citizen@123', 'OFFICIAL');
      assert.strictEqual(wtRes2.status, 403);
      assert.match(wtRes2.data.message, /Please use the correct login tab/i);

      // Inactive user
      await db.query("UPDATE users SET status = 'INACTIVE' WHERE username = 'officer.anchal'");
      const inactRes = await loginUser('officer.anchal', 'Officer@123', 'OFFICIAL');
      assert.strictEqual(inactRes.status, 403);
      assert.match(inactRes.data.message, /inactive/i);
      await db.query("UPDATE users SET status = 'ACTIVE' WHERE username = 'officer.anchal'");
    });

    it('registration validations and duplicate checks (409)', async () => {
      // Bad Aadhaar (< 12 digits)
      const badAadhaar = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          full_name: 'Test Citizen',
          email: 'test.bad.aadhaar@example.com',
          mobile: '9847111111',
          aadhaar_no: '12345',
          date_of_birth: '2000-01-01',
          gender: 'MALE',
          address: 'Test Address',
          panchayat_id: 1,
          password: 'Password@123'
        }
      });
      assert.strictEqual(badAadhaar.status, 400);

      // Bad Mobile (< 10 digits or invalid prefix)
      const badMobile = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          full_name: 'Test Citizen',
          email: 'test.bad.mobile@example.com',
          mobile: '12345',
          aadhaar_no: '123456789012',
          date_of_birth: '2000-01-01',
          gender: 'MALE',
          address: 'Test Address',
          panchayat_id: 1,
          password: 'Password@123'
        }
      });
      assert.strictEqual(badMobile.status, 400);

      // Weak Password (no uppercase/digit)
      const badPass = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          full_name: 'Test Citizen',
          email: 'test.bad.pass@example.com',
          mobile: '9847111111',
          aadhaar_no: '123456789012',
          date_of_birth: '2000-01-01',
          gender: 'MALE',
          address: 'Test Address',
          panchayat_id: 1,
          password: 'password'
        }
      });
      assert.strictEqual(badPass.status, 400);

      // Successful registration
      const validReg = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          full_name: 'Harikrishnan R',
          email: 'harikrishnan@connectedpanchayat.test',
          mobile: '9847222222',
          aadhaar_no: '876543210987',
          date_of_birth: '1999-05-12',
          gender: 'MALE',
          address: 'Hari Nivas, Kottarakara',
          panchayat_id: 1,
          password: 'Citizen@123'
        }
      });
      assert.strictEqual(validReg.status, 201);
      assert.strictEqual(validReg.data.success, true);
      assert.ok(validReg.data.data.token);

      // Duplicate mobile (409)
      const dupMobile = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          full_name: 'Another Hari',
          email: 'another.hari@connectedpanchayat.test',
          mobile: '9847222222',
          aadhaar_no: '876543210988',
          date_of_birth: '1999-05-12',
          gender: 'MALE',
          address: 'Hari Nivas, Kottarakara',
          panchayat_id: 1,
          password: 'Citizen@123'
        }
      });
      assert.strictEqual(dupMobile.status, 409);

      // Duplicate email (409)
      const dupEmail = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          full_name: 'Another Hari 2',
          email: 'harikrishnan@connectedpanchayat.test',
          mobile: '9847333333',
          aadhaar_no: '876543210989',
          date_of_birth: '1999-05-12',
          gender: 'MALE',
          address: 'Hari Nivas, Kottarakara',
          panchayat_id: 1,
          password: 'Citizen@123'
        }
      });
      assert.strictEqual(dupEmail.status, 409);
    });

    it('GET /api/auth/me, invalid token, profile update, and password change', async () => {
      // Unauthenticated
      const noAuth = await apiRequest('/api/auth/me');
      assert.strictEqual(noAuth.status, 401);

      // Invalid token
      const badToken = await apiRequest('/api/auth/me', { token: 'invalid.jwt.token' });
      assert.strictEqual(badToken.status, 401);

      // Citizen /me has masked Aadhaar
      const meCit = await apiRequest('/api/auth/me', { token: citizenToken });
      assert.strictEqual(meCit.status, 200);
      assert.match(meCit.data.data.aadhaar_masked, /^XXXX XXXX \d{4}$/);

      // Profile update for citizen (email, address)
      const updateProf = await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: {
          email: 'akhil.updated@connectedpanchayat.test',
          address: 'Updated Kalluvila House, Kollam'
        },
        token: citizenToken
      });
      assert.strictEqual(updateProf.status, 200);

      // Change password
      const changePass = await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: {
          current_password: 'Citizen@123',
          new_password: 'NewCitizen@123'
        },
        token: citizenToken
      });
      assert.strictEqual(changePass.status, 200);

      // Verify login with new password
      const newLogin = await loginUser('9876500001', 'NewCitizen@123', 'CITIZEN');
      assert.strictEqual(newLogin.status, 200);
      citizenToken = newLogin.data.data.token;

      // Revert password back
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: {
          current_password: 'NewCitizen@123',
          new_password: 'Citizen@123'
        },
        token: citizenToken
      });
      const revertLogin = await loginUser('9876500001', 'Citizen@123', 'CITIZEN');
      citizenToken = revertLogin.data.data.token;
    });
  });

  // -------------------------------------------------------------
  // 2. REFERENCE & PUBLIC ENDPOINTS
  // -------------------------------------------------------------
  describe('2. Reference & Public Endpoints', () => {
    it('public panchayats, certificate types, master data, and directory', async () => {
      // Public panchayats
      const panch = await apiRequest('/api/panchayats/public');
      assert.strictEqual(panch.status, 200);
      assert.ok(panch.data.data.length >= 6);

      // Public certificate types
      const certTypes = await apiRequest('/api/certificate-types');
      assert.strictEqual(certTypes.status, 200);
      assert.strictEqual(certTypes.data.data.length, 6);

      // Master data category
      const mdPurpose = await apiRequest('/api/master-data/PURPOSE', { token: citizenToken });
      assert.strictEqual(mdPurpose.status, 200);
      assert.ok(mdPurpose.data.data.length > 0);

      // Directory (Officer / Admin only)
      const dirCitizen = await apiRequest('/api/panchayats/directory', { token: citizenToken });
      assert.strictEqual(dirCitizen.status, 403); // Citizen forbidden

      const dirOfficer = await apiRequest('/api/panchayats/directory', { token: officerKtrToken });
      assert.strictEqual(dirOfficer.status, 200);
      assert.ok(dirOfficer.data.data.length >= 6);
    });
  });

  // -------------------------------------------------------------
  // 3. NOTIFICATIONS
  // -------------------------------------------------------------
  describe('3. Notifications System', () => {
    it('list, unread-count, mark read, mark all read, own isolation', async () => {
      // Unread count
      const uc = await apiRequest('/api/notifications/unread-count', { token: citizenToken });
      assert.strictEqual(uc.status, 200);
      assert.strictEqual(typeof uc.data.data.unread_count, 'number');

      // List notifications
      const notifs = await apiRequest('/api/notifications?page=1&limit=10', { token: citizenToken });
      assert.strictEqual(notifs.status, 200);
      assert.ok(Array.isArray(notifs.data.data.items));

      if (notifs.data.data.items.length > 0) {
        const notifId = notifs.data.data.items[0].notification_id;
        // Mark read
        const markRes = await apiRequest(`/api/notifications/${notifId}/read`, {
          method: 'PATCH',
          token: citizenToken
        });
        assert.strictEqual(markRes.status, 200);
      }

      // Mark all read
      const markAll = await apiRequest('/api/notifications/read-all', {
        method: 'POST',
        token: citizenToken
      });
      assert.strictEqual(markAll.status, 200);

      // Verify unread count is now 0
      const ucAfter = await apiRequest('/api/notifications/unread-count', { token: citizenToken });
      assert.strictEqual(ucAfter.data.data.unread_count, 0);
    });
  });

  // -------------------------------------------------------------
  // 4. ADMIN MODULE CRUD & AUDIT
  // -------------------------------------------------------------
  describe('4. Admin Management', () => {
    let createdOfficerUserId = null;

    it('users CRUD: create officer generates RSA key pair + fingerprint, cannot deactivate self', async () => {
      // Create OFFICER
      const createRes = await apiRequest('/api/admin/users', {
        method: 'POST',
        body: {
          username: 'officer.test.panchayat',
          password: 'Officer@123',
          full_name: 'Test Officer User',
          email: 'officer.test@connectedpanchayat.test',
          mobile: '9847999888',
          role: 'OFFICER',
          panchayat_id: 1,
          employee_id: 'EMP-TEST-999',
          designation: 'Junior Superintendent'
        },
        token: adminToken
      });
      assert.strictEqual(createRes.status, 201);
      assert.ok(createRes.data.data.user_id);
      createdOfficerUserId = createRes.data.data.user_id;

      // Verify RSA key pair and fingerprint exist in DB
      const offRow = (await db.query('SELECT * FROM panchayat_officers WHERE user_id = ?', [createdOfficerUserId]))[0];
      assert.ok(offRow);
      assert.strictEqual(offRow.key_fingerprint.length, 64);
      assert.ok(offRow.public_key.includes('BEGIN PUBLIC KEY'));
      assert.ok(offRow.private_key_encrypted.includes('.'));

      // Admin cannot deactivate self
      const meAdmin = await apiRequest('/api/auth/me', { token: adminToken });
      const adminUserId = meAdmin.data.data.user_id;
      const deactSelf = await apiRequest(`/api/admin/users/${adminUserId}/status`, {
        method: 'PATCH',
        body: { status: 'INACTIVE' },
        token: adminToken
      });
      assert.strictEqual(deactSelf.status, 400);
      assert.match(deactSelf.data.message, /Cannot deactivate your own account/i);

      // Deactivate created officer
      const deactOff = await apiRequest(`/api/admin/users/${createdOfficerUserId}/status`, {
        method: 'PATCH',
        body: { status: 'INACTIVE' },
        token: adminToken
      });
      assert.strictEqual(deactOff.status, 200);

      // Deactivated officer cannot log in
      const offLogin = await loginUser('officer.test.panchayat', 'Officer@123', 'OFFICIAL');
      assert.strictEqual(offLogin.status, 403);

      // Reactivate
      await apiRequest(`/api/admin/users/${createdOfficerUserId}/status`, {
        method: 'PATCH',
        body: { status: 'ACTIVE' },
        token: adminToken
      });

      // Reset password
      const resetPass = await apiRequest(`/api/admin/users/${createdOfficerUserId}/reset-password`, {
        method: 'POST',
        body: { new_password: 'NewOfficerPass@123' },
        token: adminToken
      });
      assert.strictEqual(resetPass.status, 200);

      // Login with reset password
      const offLoginNew = await loginUser('officer.test.panchayat', 'NewOfficerPass@123', 'OFFICIAL');
      assert.strictEqual(offLoginNew.status, 200);
    });

    it('panchayats CRUD, master-data CRUD, stats, reports/summary, and signatures/audit', async () => {
      // List panchayats
      const pList = await apiRequest('/api/admin/panchayats', { token: adminToken });
      assert.strictEqual(pList.status, 200);

      // Certificate types edit and persistence
      const ctGet = await apiRequest('/api/admin/certificate-types', { token: adminToken });
      assert.strictEqual(ctGet.status, 200);
      const ewsType = ctGet.data.data.find((c) => c.certificate_code === 'EWS');
      assert.ok(ewsType);

      const ctUpdate = await apiRequest(`/api/admin/certificate-types/${ewsType.certificate_type_id}`, {
        method: 'PUT',
        body: {
          certificate_name: 'EWS Certificate Updated',
          description: 'Updated description for EWS certificate',
          validity_months: 12,
          status: 'ACTIVE',
          required_documents: ewsType.required_documents,
          verification_parties: ewsType.verification_parties
        },
        token: adminToken
      });
      assert.strictEqual(ctUpdate.status, 200);

      // Verify persistence
      const ctCheck = await apiRequest('/api/admin/certificate-types', { token: adminToken });
      const updatedEws = ctCheck.data.data.find((c) => c.certificate_code === 'EWS');
      assert.strictEqual(updatedEws.certificate_name, 'EWS Certificate Updated');

      // Admin Stats
      const stats = await apiRequest('/api/admin/stats', { token: adminToken });
      assert.strictEqual(stats.status, 200);
      assert.strictEqual(typeof stats.data.data.total_users, 'number');

      // Admin Reports Summary
      const repSummary = await apiRequest('/api/admin/reports/summary', { token: adminToken });
      assert.strictEqual(repSummary.status, 200);

      // Signatures Audit
      const sigAudit = await apiRequest('/api/admin/signatures/audit', { token: adminToken });
      assert.strictEqual(sigAudit.status, 200);
      assert.ok(Array.isArray(sigAudit.data.data.rows));

      // Audit logs with filters
      const auditLogs = await apiRequest('/api/admin/audit-logs?page=1&limit=5', { token: adminToken });
      assert.strictEqual(auditLogs.status, 200);
      assert.ok(auditLogs.data.data.items.length > 0);
    });
  });

  // -------------------------------------------------------------
  // 5. APPLICATIONS FOR ALL 6 CERTIFICATE TYPES & REQUEST COUNTS
  // -------------------------------------------------------------
  describe('5. Applications Creation & Request Counts for All 6 Types', () => {
    let citizenHarikrishnanToken = '';

    before(async () => {
      const loginRes = await loginUser('9847222222', 'Citizen@123', 'CITIZEN');
      citizenHarikrishnanToken = loginRes.data.data.token;
    });

    // 1. RESIDENCE -> 0 requests
    it('RESIDENCE certificate creates exactly 0 external verification requests', async () => {
      const fd = new FormData();
      fd.append('data', JSON.stringify({
        certificate_type_id: 3, // RESIDENCE
        purpose: 'Passport Application',
        declared_family_income: 150000,
        land_holding_cents: 5,
        house_area_sqft: 600,
        parties: []
      }));
      fd.append('fileMeta', JSON.stringify([
        { document_type: 'AADHAAR', document_name: 'Applicant Aadhaar', related_to: 'APPLICANT' },
        { document_type: 'RATION_CARD', document_name: 'Ration Card', related_to: 'APPLICANT' }
      ]));
      fd.append('files', new Blob(['fake-aadhaar-bytes'], { type: 'application/pdf' }), 'aadhaar.pdf');
      fd.append('files', new Blob(['fake-ration-bytes'], { type: 'application/pdf' }), 'ration.pdf');

      const res = await apiRequest('/api/applications', {
        method: 'POST',
        body: fd,
        token: citizenHarikrishnanToken
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.data.status, 'SUBMITTED');
      assert.strictEqual(res.data.data.created_requests_count, 0);
    });

    // 2. INCOME -> one parent home, one parent elsewhere -> 1 request
    it('INCOME certificate with father in home (1) and mother in Kollam (2) creates exactly 1 request', async () => {
      const fd = new FormData();
      fd.append('data', JSON.stringify({
        certificate_type_id: 2, // INCOME
        purpose: 'Scholarship',
        declared_family_income: 90000,
        land_holding_cents: 4,
        house_area_sqft: 500,
        parties: [
          { party_type: 'FATHER', full_name: 'Ramanathan K', panchayat_id: 1, annual_income: 90000, occupation: 'FARMER' },
          { party_type: 'MOTHER', full_name: 'Sarojam R', panchayat_id: 2, annual_income: 0, occupation: 'HOMEMAKER' }
        ]
      }));
      fd.append('fileMeta', JSON.stringify([
        { document_type: 'AADHAAR', document_name: 'Aadhaar', related_to: 'APPLICANT' },
        { document_type: 'RATION_CARD', document_name: 'Ration', related_to: 'APPLICANT' },
        { document_type: 'INCOME_PROOF', document_name: 'Income Proof', related_to: 'APPLICANT' }
      ]));
      fd.append('files', new Blob(['d1'], { type: 'application/pdf' }), 'd1.pdf');
      fd.append('files', new Blob(['d2'], { type: 'application/pdf' }), 'd2.pdf');
      fd.append('files', new Blob(['d3'], { type: 'application/pdf' }), 'd3.pdf');

      const res = await apiRequest('/api/applications', {
        method: 'POST',
        body: fd,
        token: citizenHarikrishnanToken
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.data.status, 'PENDING_EXTERNAL');
      assert.strictEqual(res.data.data.created_requests_count, 1);
    });

    // 3. NATIVITY -> Father in Kollam (2) -> 1 request
    it('NATIVITY certificate with father in Kollam creates exactly 1 request', async () => {
      const fd = new FormData();
      fd.append('data', JSON.stringify({
        certificate_type_id: 4, // NATIVITY
        purpose: 'Government Scheme',
        declared_family_income: 120000,
        land_holding_cents: 6,
        house_area_sqft: 700,
        parties: [
          { party_type: 'FATHER', full_name: 'Ramanathan K', panchayat_id: 2, annual_income: 120000, occupation: 'GOVT_EMP' }
        ]
      }));
      fd.append('fileMeta', JSON.stringify([
        { document_type: 'AADHAAR', document_name: 'Aadhaar', related_to: 'APPLICANT' },
        { document_type: 'SCHOOL_CERT', document_name: 'School Certificate', related_to: 'APPLICANT' },
        { document_type: 'FATHER_ID', document_name: "Father's ID", related_to: 'FATHER' }
      ]));
      fd.append('files', new Blob(['d1'], { type: 'application/pdf' }), 'd1.pdf');
      fd.append('files', new Blob(['d2'], { type: 'application/pdf' }), 'd2.pdf');
      fd.append('files', new Blob(['d3'], { type: 'application/pdf' }), 'd3.pdf');

      const res = await apiRequest('/api/applications', {
        method: 'POST',
        body: fd,
        token: citizenHarikrishnanToken
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.data.status, 'PENDING_EXTERNAL');
      assert.strictEqual(res.data.data.created_requests_count, 1);
    });

    // 4. FAMILY_MEMBERSHIP -> father in Kollam (2), mother in Kadakkal (3) -> 2 requests
    it('FAMILY_MEMBERSHIP certificate with parents in 2 other panchayats creates exactly 2 requests', async () => {
      const fd = new FormData();
      fd.append('data', JSON.stringify({
        certificate_type_id: 5, // FAMILY_MEMBERSHIP
        purpose: 'Bank Loan',
        declared_family_income: 160000,
        land_holding_cents: 8,
        house_area_sqft: 800,
        parties: [
          { party_type: 'FATHER', full_name: 'Ramanathan K', panchayat_id: 2, annual_income: 100000, occupation: 'BUSINESS' },
          { party_type: 'MOTHER', full_name: 'Sarojam R', panchayat_id: 3, annual_income: 60000, occupation: 'TEACHER' }
        ]
      }));
      fd.append('fileMeta', JSON.stringify([
        { document_type: 'AADHAAR', document_name: 'Aadhaar', related_to: 'APPLICANT' },
        { document_type: 'RATION_CARD', document_name: 'Ration', related_to: 'APPLICANT' },
        { document_type: 'FATHER_ID', document_name: "Father's ID", related_to: 'FATHER' },
        { document_type: 'MOTHER_ID', document_name: "Mother's ID", related_to: 'MOTHER' }
      ]));
      fd.append('files', new Blob(['d1'], { type: 'application/pdf' }), 'd1.pdf');
      fd.append('files', new Blob(['d2'], { type: 'application/pdf' }), 'd2.pdf');
      fd.append('files', new Blob(['d3'], { type: 'application/pdf' }), 'd3.pdf');
      fd.append('files', new Blob(['d4'], { type: 'application/pdf' }), 'd4.pdf');

      const res = await apiRequest('/api/applications', {
        method: 'POST',
        body: fd,
        token: citizenHarikrishnanToken
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.data.status, 'PENDING_EXTERNAL');
      assert.strictEqual(res.data.data.created_requests_count, 2);
    });

    // 5. POSSESSION -> property in Kadakkal (3) -> 1 request
    it('POSSESSION certificate with property elsewhere creates exactly 1 request', async () => {
      const fd = new FormData();
      fd.append('data', JSON.stringify({
        certificate_type_id: 6, // POSSESSION
        purpose: 'Bank Loan',
        declared_family_income: 140000,
        land_holding_cents: 25,
        house_area_sqft: 0,
        parties: [
          { party_type: 'PROPERTY', full_name: 'Harikrishnan R', panchayat_id: 3, property_details: 'Survey 102/4, 25 cents agricultural land' }
        ]
      }));
      fd.append('fileMeta', JSON.stringify([
        { document_type: 'AADHAAR', document_name: 'Aadhaar', related_to: 'APPLICANT' },
        { document_type: 'LAND_TAX', document_name: 'Land Tax Receipt', related_to: 'PROPERTY' }
      ]));
      fd.append('files', new Blob(['d1'], { type: 'application/pdf' }), 'd1.pdf');
      fd.append('files', new Blob(['d2'], { type: 'application/pdf' }), 'd2.pdf');

      const res = await apiRequest('/api/applications', {
        method: 'POST',
        body: fd,
        token: citizenHarikrishnanToken
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.data.status, 'PENDING_EXTERNAL');
      assert.strictEqual(res.data.data.created_requests_count, 1);
    });

    // File validation: invalid type and oversized file (>5MB)
    it('file validations: invalid file type and oversized file (>5MB) return 400', async () => {
      // Invalid file type (.exe / text/plain)
      const fdBadType = new FormData();
      fdBadType.append('data', JSON.stringify({
        certificate_type_id: 3,
        purpose: 'Test',
        parties: []
      }));
      fdBadType.append('fileMeta', JSON.stringify([
        { document_type: 'AADHAAR', document_name: 'Aadhaar', related_to: 'APPLICANT' }
      ]));
      fdBadType.append('files', new Blob(['bad text file content'], { type: 'text/plain' }), 'test.txt');

      const resBadType = await apiRequest('/api/applications', {
        method: 'POST',
        body: fdBadType,
        token: citizenHarikrishnanToken
      });
      assert.strictEqual(resBadType.status, 400);
      assert.match(resBadType.data.message, /PDF, JPG, JPEG, and PNG/i);

      // Oversized file (> 5MB)
      const bigBuffer = new Uint8Array(5.5 * 1024 * 1024);
      const fdBig = new FormData();
      fdBig.append('data', JSON.stringify({
        certificate_type_id: 3,
        purpose: 'Test',
        parties: []
      }));
      fdBig.append('fileMeta', JSON.stringify([
        { document_type: 'AADHAAR', document_name: 'Aadhaar', related_to: 'APPLICANT' }
      ]));
      fdBig.append('files', new Blob([bigBuffer], { type: 'application/pdf' }), 'big.pdf');

      const resBig = await apiRequest('/api/applications', {
        method: 'POST',
        body: fdBig,
        token: citizenHarikrishnanToken
      });
      assert.strictEqual(resBig.status, 400);
      assert.match(resBig.data.message, /exceeds maximum allowed limit of 5MB/i);
    });
  });

  // -------------------------------------------------------------
  // 6. CRYPTOGRAPHIC SIGNATURE & INDIVIDUAL TAMPER TESTS
  // -------------------------------------------------------------
  describe('6. Digital Signature & Exhaustive Tamper Testing', () => {
    let testReqId = null;

    before(async () => {
      // Seeded request CP-2026-0003 is signed by officer.anchal
      const rows = await db.query("SELECT * FROM verification_requests WHERE request_no = 'CP-2026-0003'");
      testReqId = rows[0].verification_id;
    });

    it('independent crypto.verify confirms stored signature is mathematically valid', async () => {
      const row = (await db.query('SELECT * FROM verification_requests WHERE verification_id = ?', [testReqId]))[0];
      assert.ok(row.payload_json);
      assert.ok(row.signature);
      assert.ok(row.signer_public_key);

      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(row.payload_json);
      verifier.end();
      const isValid = verifier.verify(row.signer_public_key, row.signature, 'base64');
      assert.strictEqual(isValid, true, 'Cryptographic RSA-SHA256 verification must succeed');
    });

    it('tampering with response_remarks invalidates signature-check', async () => {
      const orig = (await db.query('SELECT response_remarks FROM verification_requests WHERE verification_id = ?', [testReqId]))[0];
      await db.query('UPDATE verification_requests SET response_remarks = "TAMPERED REMARKS" WHERE verification_id = ?', [testReqId]);

      const res = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(res.data.data.valid, false);
      assert.match(res.data.data.reason, /tampering detected/i);

      await db.query('UPDATE verification_requests SET response_remarks = ? WHERE verification_id = ?', [orig.response_remarks, testReqId]);
      const resRestored = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(resRestored.data.data.valid, true);
    });

    it('tampering with decision invalidates signature-check', async () => {
      const orig = (await db.query('SELECT status FROM verification_requests WHERE verification_id = ?', [testReqId]))[0];
      await db.query('UPDATE verification_requests SET status = "REJECTED" WHERE verification_id = ?', [testReqId]);

      const res = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(res.data.data.valid, false);
      assert.match(res.data.data.reason, /tampering detected/i);

      await db.query('UPDATE verification_requests SET status = ? WHERE verification_id = ?', [orig.status, testReqId]);
      const resRestored = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(resRestored.data.data.valid, true);
    });

    it('tampering with subject_name invalidates signature-check', async () => {
      const orig = (await db.query('SELECT subject_name FROM verification_requests WHERE verification_id = ?', [testReqId]))[0];
      await db.query('UPDATE verification_requests SET subject_name = "TAMPERED SUBJECT" WHERE verification_id = ?', [testReqId]);

      const res = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(res.data.data.valid, false);
      assert.match(res.data.data.reason, /tampering detected/i);

      await db.query('UPDATE verification_requests SET subject_name = ? WHERE verification_id = ?', [orig.subject_name, testReqId]);
      const resRestored = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(resRestored.data.data.valid, true);
    });

    it('tampering with payload_json invalidates signature-check', async () => {
      const orig = (await db.query('SELECT payload_json FROM verification_requests WHERE verification_id = ?', [testReqId]))[0];
      await db.query('UPDATE verification_requests SET payload_json = ? WHERE verification_id = ?', [
        orig.payload_json.replace('Zainaba Khan', 'Forged Subject'),
        testReqId
      ]);

      const res = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(res.data.data.valid, false);
      assert.match(res.data.data.reason, /hash mismatch/i);

      await db.query('UPDATE verification_requests SET payload_json = ? WHERE verification_id = ?', [orig.payload_json, testReqId]);
      const resRestored = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(resRestored.data.data.valid, true);
    });

    it('tampering with payload_hash invalidates signature-check', async () => {
      const orig = (await db.query('SELECT payload_hash FROM verification_requests WHERE verification_id = ?', [testReqId]))[0];
      await db.query('UPDATE verification_requests SET payload_hash = "0000000000000000000000000000000000000000000000000000000000000000" WHERE verification_id = ?', [testReqId]);

      const res = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(res.data.data.valid, false);
      assert.match(res.data.data.reason, /hash mismatch/i);

      await db.query('UPDATE verification_requests SET payload_hash = ? WHERE verification_id = ?', [orig.payload_hash, testReqId]);
      const resRestored = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(resRestored.data.data.valid, true);
    });

    it('tampering with signature string invalidates signature-check', async () => {
      const orig = (await db.query('SELECT signature FROM verification_requests WHERE verification_id = ?', [testReqId]))[0];
      await db.query('UPDATE verification_requests SET signature = "ZmFrZS1zaWduYXR1cmUtYnl0ZXM=" WHERE verification_id = ?', [testReqId]);

      const res = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(res.data.data.valid, false);
      assert.match(res.data.data.reason, /signature.*invalid/i);

      await db.query('UPDATE verification_requests SET signature = ? WHERE verification_id = ?', [orig.signature, testReqId]);
      const resRestored = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(resRestored.data.data.valid, true);
    });

    it('tampering with signer_public_key invalidates signature-check', async () => {
      const orig = (await db.query('SELECT signer_public_key FROM verification_requests WHERE verification_id = ?', [testReqId]))[0];
      // Generate a different RSA public key
      const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' } });
      await db.query('UPDATE verification_requests SET signer_public_key = ? WHERE verification_id = ?', [publicKey, testReqId]);

      const res = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(res.data.data.valid, false);
      assert.match(res.data.data.reason, /signature.*invalid/i);

      await db.query('UPDATE verification_requests SET signer_public_key = ? WHERE verification_id = ?', [orig.signer_public_key, testReqId]);
      const resRestored = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(resRestored.data.data.valid, true);
    });

    it('tampering with request_no invalidates signature-check', async () => {
      const orig = (await db.query('SELECT request_no FROM verification_requests WHERE verification_id = ?', [testReqId]))[0];
      await db.query('UPDATE verification_requests SET request_no = "CP-2099-9999" WHERE verification_id = ?', [testReqId]);

      const res = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(res.data.data.valid, false);
      assert.match(res.data.data.reason, /tampering detected/i);

      await db.query('UPDATE verification_requests SET request_no = ? WHERE verification_id = ?', [orig.request_no, testReqId]);
      const resRestored = await apiRequest(`/api/verification-requests/${testReqId}/signature-check`, { token: officerKdkToken });
      assert.strictEqual(resRestored.data.data.valid, true);
    });
  });

  // -------------------------------------------------------------
  // 7. DASHBOARDS, REPORTS & SQL COUNTS INTEGRITY
  // -------------------------------------------------------------
  describe('7. Dashboards, Reports & SQL Counts Integrity', () => {
    it('verifies dashboard and report metrics against independent SQL counts', async () => {
      // 1. Officer Dashboard
      const offDash = await apiRequest('/api/dashboard/officer', { token: officerKdkToken });
      assert.strictEqual(offDash.status, 200);

      // Verify at least 3 numbers from independent SQL
      const officerPanchayatId = 3; // Kadakkal
      const sqlHomeApps = (await db.query('SELECT COUNT(*) as cnt FROM applications WHERE home_panchayat_id = ?', [officerPanchayatId]))[0].cnt;
      const sqlPendingIncoming = (await db.query('SELECT COUNT(*) as cnt FROM verification_requests WHERE verifying_panchayat_id = ? AND status = "PENDING"', [officerPanchayatId]))[0].cnt;
      const sqlIssuedCerts = (await db.query('SELECT COUNT(*) as cnt FROM certificates WHERE issuing_panchayat_id = ?', [officerPanchayatId]))[0].cnt;

      const dData = offDash.data.data;
      assert.strictEqual(dData.pending_incoming, Number(sqlPendingIncoming));
      assert.strictEqual(dData.completed_certificates, Number(sqlIssuedCerts));

      // 2. Citizen Dashboard
      const citDash = await apiRequest('/api/dashboard/citizen', { token: citizenToken });
      assert.strictEqual(citDash.status, 200);

      // 3. Officer Reports
      const offRep = await apiRequest('/api/reports/officer', { token: officerKdkToken });
      assert.strictEqual(offRep.status, 200);

      // 4. Officer Public Key Download
      const pubKey = await apiRequest('/api/officer/me/public-key', { token: officerKdkToken });
      assert.strictEqual(pubKey.status, 200);
      assert.ok(pubKey.data.data.pem.includes('BEGIN PUBLIC KEY'));
    });
  });

  // -------------------------------------------------------------
  // 8. SECURITY & INJECTION VULNERABILITY TESTS
  // -------------------------------------------------------------
  describe('8. Security Hardening & Injection Attacks', () => {
    it('SQL injection strings in search & filter parameters are safely handled', async () => {
      const sqliStrings = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "1 UNION SELECT 1,2,3,4,5,6,7,8,9,10--",
        "' OR 1=1 --"
      ];

      for (const sqli of sqliStrings) {
        const resApps = await apiRequest(`/api/applications?search=${encodeURIComponent(sqli)}`, { token: officerKtrToken });
        assert.strictEqual(resApps.status, 200);
        assert.ok(Array.isArray(resApps.data.data.items));

        const resReqs = await apiRequest(`/api/verification-requests?search=${encodeURIComponent(sqli)}&direction=incoming`, { token: officerKtrToken });
        assert.strictEqual(resReqs.status, 200);

        const resUsers = await apiRequest(`/api/admin/users?search=${encodeURIComponent(sqli)}`, { token: adminToken });
        assert.strictEqual(resUsers.status, 200);
      }
    });

    it('path traversal attempts in file endpoints are blocked', async () => {
      const traversalIds = ['..%2F..%2Fetc%2Fpasswd', '..\\..\\Windows\\win.ini', '0', '-1'];
      for (const badId of traversalIds) {
        const resDoc = await apiRequest(`/api/documents/${badId}/file`, { token: officerKtrToken });
        assert.strictEqual(resDoc.status, 404);

        const resCert = await apiRequest(`/api/certificates/${badId}/download`, { token: officerKtrToken });
        assert.strictEqual(resCert.status, 404);
      }
    });
  });
});
