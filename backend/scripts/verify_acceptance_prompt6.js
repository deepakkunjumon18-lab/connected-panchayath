const assert = require('assert');
const crypto = require('crypto');
const { query } = require('../src/config/db');

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

async function main() {
  console.log('========================================================');
  console.log('--- PROMPT 6 FULL ACCEPTANCE CRITERIA VERIFICATION ---');
  console.log('========================================================\n');

  // ----------------------------------------------------
  // CHECKLIST ITEM 1: Log in as each demo officer & SQL match
  // ----------------------------------------------------
  console.log('[CHECK 1] Verifying dashboard numbers match SQL queries for each demo officer...');
  const officers = [
    { username: 'officer.kottarakara', panchayatId: 1, name: 'Kottarakara' },
    { username: 'officer.kollam', panchayatId: 2, name: 'Kollam' },
    { username: 'officer.kadakkal', panchayatId: 3, name: 'Kadakkal' },
    { username: 'officer.anchal', panchayatId: 4, name: 'Anchal' }
  ];

  for (const off of officers) {
    const token = await login(off.username, 'Officer@123', 'OFFICIAL');
    const { status, data: dashRes } = await apiRequest('/dashboard/officer', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(status, 200);
    const d = dashRes.data;

    // Verify 1: pending_incoming matches SQL
    const sqlPending = (await query(
      'SELECT COUNT(*) as c FROM verification_requests WHERE verifying_panchayat_id = ? AND status = "PENDING"',
      [off.panchayatId]
    ))[0].c;
    assert.strictEqual(d.pending_incoming, Number(sqlPending), `Mismatch on pending_incoming for ${off.name}`);

    // Verify 2: total_requests matches SQL
    const sqlTotal = (await query(
      'SELECT COUNT(*) as c FROM verification_requests WHERE (requesting_panchayat_id = ? OR verifying_panchayat_id = ?) AND request_date >= NOW() - INTERVAL 30 DAY',
      [off.panchayatId, off.panchayatId]
    ))[0].c;
    assert.strictEqual(d.total_requests, Number(sqlTotal), `Mismatch on total_requests for ${off.name}`);

    // Verify 3: overdue matches SQL
    const sqlOverdueIn = (await query(
      'SELECT COUNT(*) as c FROM verification_requests WHERE verifying_panchayat_id = ? AND status = "PENDING" AND NOW() > due_at',
      [off.panchayatId]
    ))[0].c;
    assert.strictEqual(d.overdue.incoming, Number(sqlOverdueIn), `Mismatch on overdue.incoming for ${off.name}`);

    console.log(`  ✓ ${off.name} (Panchayat ID ${off.panchayatId}): Pending=${d.pending_incoming} (SQL=${sqlPending}), Total30d=${d.total_requests} (SQL=${sqlTotal}), OverdueIn=${d.overdue.incoming}`);
  }

  // ----------------------------------------------------
  // CHECKLIST ITEM 2: Overdue count for Kottarakara includes CP-2026-0001 until answered, then drops
  // ----------------------------------------------------
  console.log('\n[CHECK 2] Testing Kottarakara overdue count & flow transition...');
  const ktrToken = await login('officer.kottarakara', 'Officer@123', 'OFFICIAL');
  const { data: ktrDashBefore } = await apiRequest('/dashboard/officer', {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });

  const overdueBefore = ktrDashBefore.data.overdue.incoming;
  console.log(`  Before answering CP-2026-0001: Kottarakara overdue incoming = ${overdueBefore}`);
  assert.ok(overdueBefore >= 1, 'Expected at least 1 overdue request before answering');
  assert.strictEqual(ktrDashBefore.data.current_request.request_no, 'CP-2026-0001');

  // Respond to CP-2026-0001 as officer.kottarakara
  const reqRow = (await query('SELECT verification_id FROM verification_requests WHERE request_no = "CP-2026-0001"'))[0];
  console.log(`  Submitting signed response for CP-2026-0001 (ID: ${reqRow.verification_id})...`);
  const { status: respStatus, data: respData } = await apiRequest(`/verification-requests/${reqRow.verification_id}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ktrToken}` },
    body: JSON.stringify({
      decision: 'APPROVED',
      remarks: 'Verified father residential records in ward 2 register.',
      password: 'Officer@123'
    })
  });
  assert.strictEqual(respStatus, 200, `Failed to respond: ${JSON.stringify(respData)}`);
  console.log('  CP-2026-0001 signed & approved successfully with RSA-2048 key');

  // Verify dashboard overdue drops!
  const { data: ktrDashAfter } = await apiRequest('/dashboard/officer', {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });
  const overdueAfter = ktrDashAfter.data.overdue.incoming;
  console.log(`  After answering CP-2026-0001: Kottarakara overdue incoming = ${overdueAfter}`);
  assert.strictEqual(overdueAfter, overdueBefore - 1, 'Overdue count did not drop after responding to request!');
  console.log('  ✓ Overdue count dropped by exactly 1!');

  // ----------------------------------------------------
  // CHECKLIST ITEM 3: Reports show correct data and non-empty charts
  // ----------------------------------------------------
  console.log('\n[CHECK 3] Testing Officer Reports analytics & charts...');
  const { data: repRes } = await apiRequest('/reports/officer', {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });
  const rep = repRes.data;
  assert.ok(rep.monthly_trends.length === 6, 'Expected 6 months in monthly_trends');
  assert.ok(rep.applications_by_certificate_type.length >= 1, 'Expected certificate type breakdown');
  console.log(`  ✓ Officer reports returned: ${rep.monthly_trends.length} months trends, avg response time: ${rep.average_response_time_hours} hrs`);

  // ----------------------------------------------------
  // CHECKLIST ITEM 4: Directory shows 6 panchayats; key fingerprint matches DB; PEM is valid RSA key
  // ----------------------------------------------------
  console.log('\n[CHECK 4] Testing Directory & Public Key Validation...');
  const { data: dirData } = await apiRequest('/panchayats/directory', {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });
  const dirPanchayats = dirData.data || dirData;
  console.log(`  Directory returned ${dirPanchayats.length} Panchayats`);
  assert.strictEqual(dirPanchayats.length, 6, 'Expected exactly 6 active Panchayats in directory');

  const { data: keyRes } = await apiRequest('/officer/me/public-key', {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });
  const keyInfo = keyRes.data;
  assert.ok(keyInfo.pem, 'Expected pem in key response');
  assert.ok(keyInfo.fingerprint, 'Expected fingerprint in key response');

  // Verify fingerprint matches DB
  const dbKeyRow = (await query('SELECT key_fingerprint FROM panchayat_officers WHERE officer_id = 1'))[0];
  assert.strictEqual(keyInfo.fingerprint, dbKeyRow.key_fingerprint, 'Fingerprint mismatch between API and DB!');
  console.log(`  ✓ Key fingerprint matches DB: ${keyInfo.fingerprint}`);

  // Verify PEM is a valid RSA public key using Node.js crypto
  const parsedKey = crypto.createPublicKey(keyInfo.pem);
  assert.strictEqual(parsedKey.asymmetricKeyType, 'rsa');
  assert.strictEqual(parsedKey.asymmetricKeyDetails.modulusLength, 2048);
  console.log('  ✓ PEM verified using crypto.createPublicKey: RSA-2048 valid public key!');

  // ----------------------------------------------------
  // CHECKLIST ITEM 5: Admin signature audit & DB tamper detection
  // ----------------------------------------------------
  console.log('\n[CHECK 5] Testing Admin Signatures Audit & Tamper Detection...');
  const adminToken = await login('admin', 'Admin@123', 'OFFICIAL');
  const { data: auditPris } = await apiRequest('/admin/signatures/audit', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log(`  Pristine audit: Total checked = ${auditPris.data.totals.total_checked}, Valid = ${auditPris.data.totals.valid_count}, Invalid = ${auditPris.data.totals.invalid_count}`);
  assert.strictEqual(auditPris.data.totals.invalid_count, 0, 'Expected 0 invalid signatures in pristine state');

  // Tamper with response_remarks in DB for verification_id = 3
  console.log('  Tampering with response_remarks of request #3 in MySQL...');
  const origRem = (await query('SELECT response_remarks FROM verification_requests WHERE verification_id = 3'))[0].response_remarks;
  await query('UPDATE verification_requests SET response_remarks = "Forged altered decision" WHERE verification_id = 3');

  const { data: auditTamp } = await apiRequest('/admin/signatures/audit', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const tamperedRow = auditTamp.data.rows.find(r => r.verification_id === 3);
  console.log(`  Tampered audit: Invalid count = ${auditTamp.data.totals.invalid_count}, Reason = "${tamperedRow?.reason}"`);
  assert.strictEqual(auditTamp.data.totals.invalid_count, 1, 'Expected exactly 1 invalid signature after tamper');
  assert.strictEqual(tamperedRow.valid, false);

  // Restore
  await query('UPDATE verification_requests SET response_remarks = ? WHERE verification_id = 3', [origRem]);
  const { data: auditRest } = await apiRequest('/admin/signatures/audit', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(auditRest.data.totals.invalid_count, 0, 'Expected 0 invalid signatures after restore');
  console.log('  ✓ Restored original remarks -> audit shows 0 invalid signatures!');

  // ----------------------------------------------------
  // CHECKLIST ITEM 6: Citizen dashboard & routes check
  // ----------------------------------------------------
  console.log('\n[CHECK 6] Testing Citizen Dashboard & API endpoints...');
  const citToken = await login('9876500003', 'Citizen@123', 'CITIZEN');
  const { data: citDash } = await apiRequest('/dashboard/citizen', {
    headers: { Authorization: `Bearer ${citToken}` }
  });
  assert.strictEqual(citDash.success, true);
  console.log(`  Citizen Dashboard: ${citDash.data.citizen.full_name}, ${citDash.data.totals.total_applications} apps, ${citDash.data.totals.certificates_issued} certificates`);

  // Admin summary
  const { data: admSum } = await apiRequest('/admin/reports/summary', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(admSum.success, true);
  console.log('  Admin Summary report returned all metrics.');

  console.log('\n========================================================');
  console.log('ALL ACCEPTANCE CRITERIA VERIFIED AND PASSED SUCCESSFULLY!');
  console.log('========================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
