const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

// Deep inspect object for forbidden keys
function hasForbiddenKeys(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if ('password_hash' in obj || 'private_key_encrypted' in obj) return true;
  for (const key of Object.keys(obj)) {
    if (hasForbiddenKeys(obj[key])) return true;
  }
  return false;
}

async function runSmokeTests() {
  console.log(`\n======================================================`);
  console.log(`RUNNING SMOKE TESTS AGAINST ${BASE_URL}`);
  console.log(`======================================================\n`);

  // 1. Health check
  console.log('1. Health check');
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const json = await res.json();
    assert(res.status === 200, 'GET /health returned status 200');
    assert(json.success === true, 'GET /health returned success: true');
  } catch (err) {
    assert(false, `Server is reachable on ${BASE_URL}: ${err.message}`);
    console.error('\nEnsure server is running before running smoke test!\n');
    process.exit(1);
  }

  // 2. Public Endpoints
  console.log('\n2. Public Endpoints');
  const panchRes = await fetch(`${BASE_URL}/api/panchayats/public`);
  const panchJson = await panchRes.json();
  assert(panchRes.status === 200, 'GET /api/panchayats/public returned 200');
  assert(Array.isArray(panchJson.data) && panchJson.data.length >= 6, 'Found at least 6 active panchayats');
  assert(!hasForbiddenKeys(panchJson), 'No sensitive keys in public panchayats response');

  const certRes = await fetch(`${BASE_URL}/api/certificate-types`);
  const certJson = await certRes.json();
  assert(certRes.status === 200, 'GET /api/certificate-types returned 200');
  assert(Array.isArray(certJson.data) && certJson.data.length === 6, 'Found exactly 6 certificate types');
  assert(!hasForbiddenKeys(certJson), 'No sensitive keys in certificate types response');

  // 3. Login as CITIZEN
  console.log('\n3. Login as CITIZEN (Akhil K S)');
  const citLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: '9876500001',
      password: 'Citizen@123',
      login_as: 'CITIZEN'
    })
  });
  const citLoginJson = await citLoginRes.json();
  assert(citLoginRes.status === 200, 'Citizen login returned 200');
  assert(!!citLoginJson.data?.token, 'Citizen login returned JWT token');
  assert(citLoginJson.data?.user?.role === 'CITIZEN', 'Citizen role is CITIZEN');
  assert(!hasForbiddenKeys(citLoginJson), 'No sensitive keys in citizen login response');

  const citizenToken = citLoginJson.data?.token;

  // 4. Login as OFFICER
  console.log('\n4. Login as OFFICER (Deepak Kunjumon)');
  const offLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'officer.kottarakara',
      password: 'Officer@123',
      login_as: 'OFFICIAL'
    })
  });
  const offLoginJson = await offLoginRes.json();
  assert(offLoginRes.status === 200, 'Officer login returned 200');
  assert(!!offLoginJson.data?.token, 'Officer login returned JWT token');
  assert(offLoginJson.data?.user?.role === 'OFFICER', 'Officer role is OFFICER');
  assert(!hasForbiddenKeys(offLoginJson), 'No sensitive keys in officer login response');

  const officerToken = offLoginJson.data?.token;

  // 5. Login as ADMIN
  console.log('\n5. Login as ADMIN');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin',
      password: 'Admin@123',
      login_as: 'OFFICIAL'
    })
  });
  const adminLoginJson = await adminLoginRes.json();
  assert(adminLoginRes.status === 200, 'Admin login returned 200');
  assert(!!adminLoginJson.data?.token, 'Admin login returned JWT token');
  assert(adminLoginJson.data?.user?.role === 'ADMIN', 'Admin role is ADMIN');
  assert(!hasForbiddenKeys(adminLoginJson), 'No sensitive keys in admin login response');

  // 6. GET /api/auth/me for citizen and officer
  console.log('\n6. GET /api/auth/me');
  const meCitRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${citizenToken}` }
  });
  const meCitJson = await meCitRes.json();
  assert(meCitRes.status === 200, 'GET /me for Citizen returned 200');
  assert(meCitJson.data?.aadhaar_masked?.startsWith('XXXX XXXX'), 'Aadhaar is masked for Citizen');
  assert(!hasForbiddenKeys(meCitJson), 'No sensitive keys in GET /me response');

  const meOffRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${officerToken}` }
  });
  const meOffJson = await meOffRes.json();
  assert(meOffRes.status === 200, 'GET /me for Officer returned 200');
  assert(!!meOffJson.data?.key_fingerprint, 'Officer has key_fingerprint');
  assert(!hasForbiddenKeys(meOffJson), 'No sensitive keys in Officer GET /me response');

  // 7. Negative checks: wrong password
  console.log('\n7. Negative checks: Wrong password');
  const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'officer.kottarakara',
      password: 'WrongPassword@123',
      login_as: 'OFFICIAL'
    })
  });
  assert(wrongPassRes.status === 401, 'Wrong password rejected with 401');

  // 8. Negative checks: wrong tab (Officer trying CITIZEN tab)
  console.log('\n8. Negative checks: Wrong tab login');
  const wrongTabRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'officer.kottarakara',
      password: 'Officer@123',
      login_as: 'CITIZEN'
    })
  });
  const wrongTabJson = await wrongTabRes.json();
  assert(wrongTabRes.status === 403, 'Officer on CITIZEN tab rejected with 403');
  assert(wrongTabJson.message === 'Please use the correct login tab', 'Expected wrong tab error message');

  // 9. Master Data Endpoint
  console.log('\n9. Master Data Endpoint');
  const mdRes = await fetch(`${BASE_URL}/api/master-data/PURPOSE`, {
    headers: { Authorization: `Bearer ${citizenToken}` }
  });
  const mdJson = await mdRes.json();
  assert(mdRes.status === 200, 'GET /api/master-data/PURPOSE returned 200');
  assert(Array.isArray(mdJson.data) && mdJson.data.length >= 5, 'Found purpose master data items');

  // 10. Notifications Endpoints
  console.log('\n10. Notifications Endpoints');
  const notifCountRes = await fetch(`${BASE_URL}/api/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${officerToken}` }
  });
  const notifCountJson = await notifCountRes.json();
  assert(notifCountRes.status === 200, 'GET /api/notifications/unread-count returned 200');
  assert(typeof notifCountJson.data?.unread_count === 'number', 'Unread count is a number');

  const notifListRes = await fetch(`${BASE_URL}/api/notifications?page=1&limit=5`, {
    headers: { Authorization: `Bearer ${officerToken}` }
  });
  const notifListJson = await notifListRes.json();
  assert(notifListRes.status === 200, 'GET /api/notifications returned 200');
  assert(Array.isArray(notifListJson.data?.items), 'Returned notifications items array');

  // 11. Register new Citizen and login
  console.log('\n11. Register new Citizen & login');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const newMobile = `987654${randomSuffix}`;
  const newEmail = `citizen.${randomSuffix}@connectedpanchayat.test`;
  const newAadhaar = `8888${randomSuffix}${randomSuffix}`;

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: `Test Citizen ${randomSuffix}`,
      mobile: newMobile,
      email: newEmail,
      password: 'Citizen@123',
      aadhaar_no: newAadhaar,
      date_of_birth: '1998-05-12',
      gender: 'MALE',
      address: 'Test House, Near Temple, Kollam - 691001',
      panchayat_id: 2
    })
  });
  const regJson = await regRes.json();
  assert(regRes.status === 201, 'Registration returned 201 Created');
  assert(!!regJson.data?.token, 'Registration returned JWT token');
  assert(!hasForbiddenKeys(regJson), 'No sensitive keys in registration response');

  // Login with newly registered citizen
  const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: newMobile,
      password: 'Citizen@123',
      login_as: 'CITIZEN'
    })
  });
  const newLoginJson = await newLoginRes.json();
  assert(newLoginRes.status === 200, 'Login as newly registered citizen succeeded with 200');
  assert(newLoginJson.data?.user?.full_name === `Test Citizen ${randomSuffix}`, 'Profile full_name matches registered name');

  // 12. Admin Module Tests
  console.log('\n12. Admin Module Tests');
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminLoginJson.data.token}`
  };

  // 12a. Stats
  const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, { headers: adminHeaders });
  const statsJson = await statsRes.json();
  assert(statsRes.status === 200, 'GET /api/admin/stats returned 200');
  assert(statsJson.data?.total_users > 0, 'Stats returned total_users count');

  // 12b. List users
  const usersRes = await fetch(`${BASE_URL}/api/admin/users?page=1&limit=5`, { headers: adminHeaders });
  const usersJson = await usersRes.json();
  assert(usersRes.status === 200, 'GET /api/admin/users returned 200');
  assert(Array.isArray(usersJson.data?.items), 'Admin users returned list');

  // 12c. Create new Officer with auto-generated RSA key
  const offSuffix = Math.floor(1000 + Math.random() * 9000);
  const newOfficerUsername = `officer.test${offSuffix}`;
  const newOfficerEmail = `officer.test${offSuffix}@connectedpanchayat.test`;
  const newOfficerMobile = `900000${offSuffix}`;
  const newOfficerEmpId = `EMP-TEST-${offSuffix}`;

  const createOffRes = await fetch(`${BASE_URL}/api/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      role: 'OFFICER',
      username: newOfficerUsername,
      password: 'Officer@123',
      email: newOfficerEmail,
      mobile: newOfficerMobile,
      full_name: `Test Officer ${offSuffix}`,
      panchayat_id: 1,
      employee_id: newOfficerEmpId,
      designation: 'Junior Superintendent'
    })
  });
  const createOffJson = await createOffRes.json();
  assert(createOffRes.status === 201, 'Admin created officer returned 201');
  assert(!!createOffJson.data?.key_fingerprint, 'Officer creation returned RSA key_fingerprint');
  const createdOfficerId = createOffJson.data?.user_id;

  // 12d. Officer login works
  const offLogRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: newOfficerUsername,
      password: 'Officer@123',
      login_as: 'OFFICIAL'
    })
  });
  assert(offLogRes.status === 200, 'Newly created officer logged in successfully');

  // 12e. Deactivate officer -> login now fails
  const deactRes = await fetch(`${BASE_URL}/api/admin/users/${createdOfficerId}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'INACTIVE' })
  });
  assert(deactRes.status === 200, 'Admin deactivated officer successfully');

  const deactLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: newOfficerUsername,
      password: 'Officer@123',
      login_as: 'OFFICIAL'
    })
  });
  assert(deactLoginRes.status === 403, 'Deactivated officer login rejected with 403');

  // 12f. Edit certificate type and verify persistence
  const certsListRes = await fetch(`${BASE_URL}/api/admin/certificate-types`, { headers: adminHeaders });
  const certsListJson = await certsListRes.json();
  const ewsType = certsListJson.data.find((c) => c.certificate_code === 'EWS');
  assert(!!ewsType, 'Found EWS certificate type');

  const updatedDocs = [...ewsType.required_documents, {
    type: 'EXTRA_DOC',
    label: 'Extra Test Document',
    related_to: 'APPLICANT',
    mandatory: false
  }];

  const updateCertRes = await fetch(`${BASE_URL}/api/admin/certificate-types/${ewsType.certificate_type_id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      certificate_name: ewsType.certificate_name,
      description: 'Updated EWS description by Admin',
      validity_months: 12,
      status: 'ACTIVE',
      required_documents: updatedDocs,
      verification_parties: ['FATHER', 'MOTHER', 'PROPERTY']
    })
  });
  assert(updateCertRes.status === 200, 'PUT /api/admin/certificate-types returned 200');

  // Verify reload persists changes
  const reloadCertRes = await fetch(`${BASE_URL}/api/certificate-types`);
  const reloadCertJson = await reloadCertRes.json();
  const reloadedEws = reloadCertJson.data.find((c) => c.certificate_code === 'EWS');
  assert(reloadedEws.description === 'Updated EWS description by Admin', 'Certificate type update persisted in DB');
  assert(reloadedEws.verification_parties.includes('PROPERTY'), 'Verification parties update persisted');

  // 12g. Audit logs
  const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs?limit=5`, { headers: adminHeaders });
  const auditJson = await auditRes.json();
  assert(auditRes.status === 200, 'GET /api/admin/audit-logs returned 200');
  assert(Array.isArray(auditJson.data?.items) && auditJson.data.items.length > 0, 'Audit logs contains state changes');

  // Summary
  console.log(`\n======================================================`);
  console.log(`SMOKE TESTS COMPLETED: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log(`======================================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSmokeTests().catch((err) => {
  console.error('Smoke test suite error:', err);
  process.exit(1);
});
