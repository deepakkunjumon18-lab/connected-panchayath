const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function login(identifier, password, login_as = 'OFFICIAL') {
  const { data } = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, login_as })
  });
  if (!data?.data?.token) {
    throw new Error(`Login failed for ${identifier}: ${JSON.stringify(data)}`);
  }
  return data.data.token;
}

async function runTests() {
  console.log('--- TESTING PROMPT 6 BACKEND ENDPOINTS ---');

  // 1. Officer Kottarakara
  console.log('\n[1] Testing Officer Kottarakara Dashboard & Reports...');
  const ktrToken = await login('officer.kottarakara', 'Officer@123', 'OFFICIAL');
  const authHeaders = { Authorization: `Bearer ${ktrToken}` };

  const { status: dashStatus, data: dashRes } = await apiRequest('/dashboard/officer', {
    headers: authHeaders
  });
  assert.strictEqual(dashStatus, 200);
  assert.strictEqual(dashRes.success, true);
  const ktrDash = dashRes.data;
  console.log('Kottarakara Dashboard:', {
    total_requests: ktrDash.total_requests,
    pending_incoming: ktrDash.pending_incoming,
    completed_certificates: ktrDash.completed_certificates,
    overdue: ktrDash.overdue,
    has_current_request: !!ktrDash.current_request,
    current_request_no: ktrDash.current_request?.request_no,
    recent_requests_count: ktrDash.recent_requests.length
  });

  // Verify Overdue logic: In demo data, CP-2026-0001 (due 2026-03-05) is overdue and pending incoming to Kottarakara!
  assert.ok(ktrDash.overdue.incoming >= 1, 'Expected at least 1 overdue incoming request for Kottarakara');
  assert.ok(ktrDash.current_request !== null, 'Expected current_request to be present');
  console.log('✓ Kottarakara Dashboard passed');

  // 2. Officer Reports
  console.log('\n[2] Testing Officer Reports...');
  const { status: repStatus, data: repRes } = await apiRequest('/reports/officer', {
    headers: authHeaders
  });
  assert.strictEqual(repStatus, 200);
  assert.strictEqual(repRes.success, true);
  const ktrReports = repRes.data;
  console.log('Officer Reports Summary:', {
    requests_by_status: ktrReports.requests_by_status.combined,
    cert_types_count: ktrReports.applications_by_certificate_type.length,
    monthly_trends_count: ktrReports.monthly_trends.length,
    average_response_time_hours: ktrReports.average_response_time_hours,
    overdue_count: ktrReports.overdue_list.length
  });
  assert.ok(Array.isArray(ktrReports.monthly_trends), 'monthly_trends must be array');
  assert.ok(Array.isArray(ktrReports.overdue_list), 'overdue_list must be array');
  console.log('✓ Officer Reports passed');

  // 3. Officer Public Key
  console.log('\n[3] Testing Officer Public Key Endpoint...');
  const { status: keyStatus, data: keyRes } = await apiRequest('/officer/me/public-key', {
    headers: authHeaders
  });
  assert.strictEqual(keyStatus, 200);
  assert.strictEqual(keyRes.success, true);
  const ktrKey = keyRes.data;
  assert.ok(ktrKey.pem.includes('BEGIN PUBLIC KEY'), 'Expected valid PEM string');
  assert.ok(ktrKey.fingerprint.length === 64, 'Expected 64-character SHA-256 fingerprint');
  console.log('Officer Public Key Fingerprint:', ktrKey.fingerprint);
  console.log('✓ Officer Public Key passed');

  // 4. Citizen Dashboard
  console.log('\n[4] Testing Citizen Dashboard (Rafiq Khan)...');
  const rafiqToken = await login('9876500003', 'Citizen@123', 'CITIZEN');
  const { status: citStatus, data: citRes } = await apiRequest('/dashboard/citizen', {
    headers: { Authorization: `Bearer ${rafiqToken}` }
  });
  assert.strictEqual(citStatus, 200);
  assert.strictEqual(citRes.success, true);
  const citDash = citRes.data;
  console.log('Citizen Dashboard Data:', {
    citizen: citDash.citizen.full_name,
    totals: citDash.totals,
    recent_applications_count: citDash.recent_applications.length
  });
  assert.ok(citDash.totals.total_applications >= 1, 'Expected at least 1 application for Rafiq');
  console.log('✓ Citizen Dashboard passed');

  // 5. Admin Reports Summary & Stats
  console.log('\n[5] Testing Admin Reports Summary & Audit...');
  const adminToken = await login('admin', 'Admin@123', 'OFFICIAL');
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  const { status: sumStatus, data: sumRes } = await apiRequest('/admin/reports/summary', {
    headers: adminHeaders
  });
  assert.strictEqual(sumStatus, 200);
  assert.strictEqual(sumRes.success, true);
  const summary = sumRes.data;
  console.log('Admin Summary Stats:', {
    users_by_role: summary.users_by_role,
    panchayats_count: summary.panchayats_count,
    applications_by_status: summary.applications_by_status,
    pairs_count: summary.requests_between_panchayats.length,
    overdue_count: summary.overdue_requests.length
  });
  assert.ok(summary.panchayats_count.total >= 6, 'Expected at least 6 panchayats');
  console.log('✓ Admin Reports Summary passed');

  // 6. Admin Signatures Audit
  console.log('\n[6] Testing Admin Signatures Audit...');
  const { status: auditStatus, data: auditRes } = await apiRequest('/admin/signatures/audit', {
    headers: adminHeaders
  });
  assert.strictEqual(auditStatus, 200);
  assert.strictEqual(auditRes.success, true);
  const auditData = auditRes.data;
  console.log('Signatures Audit Result:', auditData.totals);
  assert.ok(auditData.totals.total_checked >= 1, 'Expected at least 1 signed request in demo data');
  assert.strictEqual(auditData.totals.invalid_count, 0, 'Expected 0 invalid signatures in pristine demo data');
  console.log('✓ Admin Signatures Audit passed: all signed requests verified cryptographically');

  // 6b. Test Tamper Detection on Signature Audit
  console.log('\n[6b] Testing Signature Tamper Detection in DB...');
  const { query } = require('../src/config/db');
  const originalRow = (await query('SELECT response_remarks FROM verification_requests WHERE verification_id = 3'))[0];
  
  // Tamper response_remarks
  await query('UPDATE verification_requests SET response_remarks = "Tampered unauthorized text" WHERE verification_id = 3');
  const { data: tamperedAudit } = await apiRequest('/admin/signatures/audit', { headers: adminHeaders });
  assert.strictEqual(tamperedAudit.data.totals.invalid_count, 1, 'Expected 1 invalid signature after tamper');
  assert.strictEqual(tamperedAudit.data.rows[0].valid, false);
  console.log('Tamper successfully caught by audit:', tamperedAudit.data.rows[0].reason);

  // Restore original
  await query('UPDATE verification_requests SET response_remarks = ? WHERE verification_id = 3', [originalRow.response_remarks]);
  const { data: restoredAudit } = await apiRequest('/admin/signatures/audit', { headers: adminHeaders });
  assert.strictEqual(restoredAudit.data.totals.invalid_count, 0, 'Expected 0 invalid signatures after restore');
  console.log('✓ Restored row is cryptographically valid again');

  // 7. Directory Search
  console.log('\n[7] Testing Directory Search...');
  const { status: d1Status, data: d1Res } = await apiRequest('/panchayats/directory?search=Kottarakara', {
    headers: authHeaders
  });
  assert.strictEqual(d1Status, 200);
  assert.strictEqual(d1Res.data.length, 1);
  assert.strictEqual(d1Res.data[0].panchayat_code, 'KTR');

  const { status: d2Status, data: d2Res } = await apiRequest('/panchayats/directory?search=deepak', {
    headers: authHeaders
  });
  assert.strictEqual(d2Status, 200);
  assert.strictEqual(d2Res.data.length, 1);
  assert.strictEqual(d2Res.data[0].panchayat_code, 'KTR');
  console.log('✓ Directory Search passed');

  console.log('\nALL PROMPT 6 BACKEND TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
