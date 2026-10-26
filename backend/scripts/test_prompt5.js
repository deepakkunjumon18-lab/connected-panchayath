const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/db');

const API = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.message || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function runTests() {
  console.log('--- STARTING PROMPT 5 BACKEND TESTS ---');

  // 1. Login as Officer Kadakkal (Home officer for Rafiq Khan)
  console.log('\n[1] Logging in as Officer Kadakkal...');
  const kdkLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      identifier: 'officer.kadakkal',
      password: 'Officer@123',
      login_as: 'OFFICIAL'
    })
  });
  const kdkToken = kdkLogin.data.token;
  console.log('Officer Kadakkal logged in successfully.');

  // Find Rafiq's application (INCOME-2026-0001)
  const appRows = await query('SELECT * FROM applications WHERE application_no = "INCOME-2026-0001"');
  if (!appRows || !appRows.length) {
    throw new Error('Application INCOME-2026-0001 not found!');
  }
  const app3 = appRows[0];
  console.log(`Found application: ${app3.application_no} (ID: ${app3.application_id}, Status: ${app3.status})`);

  // 2. Approve Application
  console.log('\n[2] Approving application INCOME-2026-0001...');
  const approveRes = await req(`${API}/applications/${app3.application_id}/decision`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kdkToken}` },
    body: JSON.stringify({
      decision: 'APPROVED',
      remarks: 'All documents verified and Anchal GP verified mother registration.'
    })
  });
  console.log('Application approved:', approveRes.data);

  // 3. Issue Certificate
  console.log('\n[3] Issuing certificate for application...');
  const issueRes = await req(`${API}/applications/${app3.application_id}/issue-certificate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kdkToken}` }
  });
  const certData = issueRes.data;
  console.log('Certificate issued successfully:', certData);

  if (!certData.certificate_no || !certData.verification_code) {
    throw new Error('Certificate issuance missing certificate_no or verification_code!');
  }

  // Verify PDF file was generated on disk
  const certPath = path.join(__dirname, `../storage/certificates/${certData.certificate_no}.pdf`);
  if (!fs.existsSync(certPath)) {
    throw new Error(`Certificate PDF file not found at ${certPath}!`);
  }
  const originalFileBytes = fs.readFileSync(certPath);
  console.log(`PDF generated on disk (${originalFileBytes.length} bytes) at ${certPath}`);

  // 4. Test issuing twice (Should fail with 409 Conflict)
  console.log('\n[4] Testing duplicate certificate issuance (expecting 409)...');
  try {
    await req(`${API}/applications/${app3.application_id}/issue-certificate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kdkToken}` }
    });
    throw new Error('Duplicate certificate issue should have failed!');
  } catch (err) {
    if (err.status === 409) {
      console.log('Correctly rejected with 409:', err.message);
    } else {
      throw err;
    }
  }

  // 5. Login as citizen Rafiq Khan (9876500003)
  console.log('\n[5] Logging in as Citizen Rafiq Khan...');
  const rafiqLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      identifier: '9876500003',
      password: 'Citizen@123',
      login_as: 'CITIZEN'
    })
  });
  const rafiqToken = rafiqLogin.data.token;
  console.log('Rafiq Khan logged in successfully.');

  // Fetch Rafiq's certificates list
  console.log('\n[6] Fetching certificates list as Rafiq...');
  const certListRes = await req(`${API}/certificates`, {
    headers: { Authorization: `Bearer ${rafiqToken}` }
  });
  const myCerts = certListRes.data.items;
  console.log(`Found ${myCerts.length} certificates for Rafiq.`);
  const myCert = myCerts.find(c => c.certificate_no === certData.certificate_no);
  if (!myCert) {
    throw new Error('Issued certificate not found in citizen certificates list!');
  }
  console.log(`Found certificate: ${myCert.certificate_no}, Code: ${myCert.verification_code}`);

  // Download PDF as Rafiq
  console.log('\n[7] Downloading certificate PDF as Rafiq...');
  const downloadRes = await fetch(`${API}/certificates/${certData.certificate_id}/download`, {
    headers: { Authorization: `Bearer ${rafiqToken}` }
  });
  if (!downloadRes.ok) {
    throw new Error(`Failed to download certificate: HTTP ${downloadRes.status}`);
  }
  const integrityHeader = downloadRes.headers.get('x-integrity');
  console.log(`Download response status: ${downloadRes.status}, X-Integrity header: ${integrityHeader}`);
  if (integrityHeader !== 'ok') {
    throw new Error(`Expected X-Integrity header to be 'ok', got '${integrityHeader}'`);
  }

  // 6. Test Data Isolation / Unauthorized Download (Expect 404)
  console.log('\n[8] Testing unauthorized download by another citizen (expecting 404)...');
  const akhilLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      identifier: '9876500001',
      password: 'Citizen@123',
      login_as: 'CITIZEN'
    })
  });
  const akhilToken = akhilLogin.data.token;

  const unauthorizedRes = await fetch(`${API}/certificates/${certData.certificate_id}/download`, {
    headers: { Authorization: `Bearer ${akhilToken}` }
  });
  console.log(`Unauthorized citizen download status: ${unauthorizedRes.status}`);
  if (unauthorizedRes.status !== 404) {
    throw new Error(`Expected 404 for unauthorized download, got ${unauthorizedRes.status}`);
  }

  // Unauthorized officer download (Officer Kottarakara)
  console.log('\n[9] Testing unauthorized download by another panchayat officer (expecting 404)...');
  const ktrLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      identifier: 'officer.kottarakara',
      password: 'Officer@123',
      login_as: 'OFFICIAL'
    })
  });
  const ktrToken = ktrLogin.data.token;

  const unauthOfficerRes = await fetch(`${API}/certificates/${certData.certificate_id}/download`, {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });
  console.log(`Unauthorized officer download status: ${unauthOfficerRes.status}`);
  if (unauthOfficerRes.status !== 404) {
    throw new Error(`Expected 404 for unauthorized officer download, got ${unauthOfficerRes.status}`);
  }

  // 7. Public Verification by Code & QR
  console.log('\n[10] Testing public certificate verification via code...');
  const verifyRes = await req(`${API}/certificates/verify/${certData.verification_code}?src=qr`);
  console.log('Verification result:', verifyRes.data);
  if (!verifyRes.data.valid || verifyRes.data.status !== 'VALID') {
    throw new Error('Public verification returned invalid for active certificate!');
  }
  if (!verifyRes.data.integrity.fileHashMatches) {
    throw new Error('fileHashMatches should be true!');
  }
  if (verifyRes.data.aadhaar_no || verifyRes.data.address) {
    throw new Error('Privacy breach: Public verify must NOT return Aadhaar or address!');
  }
  console.log('Public verification passed with proper privacy scoping (holder name only).');

  // Verify verification log was created
  const logRows = await query(
    'SELECT * FROM certificate_verification_logs WHERE verification_code = ? ORDER BY log_id DESC LIMIT 1',
    [certData.verification_code]
  );
  if (!logRows || !logRows.length) {
    throw new Error('No verification log entry was recorded!');
  }
  console.log('Verification log entry recorded:', {
    log_id: logRows[0].log_id,
    method: logRows[0].method,
    result: logRows[0].result
  });
  if (logRows[0].method !== 'QR' || logRows[0].result !== 'VALID') {
    throw new Error('Verification log record mismatch!');
  }

  // Wrong code verification test
  console.log('\n[11] Testing public verification with invalid code...');
  const wrongRes = await req(`${API}/certificates/verify/NON-EXISTENT-CODE`);
  console.log('Invalid code verification result:', wrongRes.data);
  if (wrongRes.data.valid !== false || wrongRes.data.status !== 'NOT_FOUND') {
    throw new Error('Invalid code should return valid: false and status: NOT_FOUND');
  }

  // 8. Test File Tampering / Corruption
  console.log('\n[12] Testing file integrity tampering...');
  fs.writeFileSync(certPath, Buffer.concat([originalFileBytes, Buffer.from('TAMPERED_BYTE')]));

  // Verify should detect mismatch
  const tamperedVerify = await req(`${API}/certificates/verify/${certData.verification_code}`);
  console.log('Tampered verify result:', tamperedVerify.data);
  if (tamperedVerify.data.valid !== false || tamperedVerify.data.status !== 'INVALID') {
    throw new Error('Tampered PDF should return valid: false and status: INVALID!');
  }
  if (tamperedVerify.data.integrity.fileHashMatches !== false) {
    throw new Error('fileHashMatches should be false for tampered file!');
  }
  console.log('File tamper successfully detected by public verification!');

  // Download should return X-Integrity: mismatch
  const tamperedDownload = await fetch(`${API}/certificates/${certData.certificate_id}/download`, {
    headers: { Authorization: `Bearer ${rafiqToken}` }
  });
  const tamperedHeader = tamperedDownload.headers.get('x-integrity');
  console.log(`Tampered download X-Integrity header: ${tamperedHeader}`);
  if (tamperedHeader !== 'mismatch') {
    throw new Error(`Expected X-Integrity to be 'mismatch', got '${tamperedHeader}'`);
  }

  // Restore original PDF
  fs.writeFileSync(certPath, originalFileBytes);
  const restoredVerify = await req(`${API}/certificates/verify/${certData.verification_code}`);
  if (!restoredVerify.data.valid) {
    throw new Error('Restored PDF should be valid!');
  }
  console.log('Original PDF restored and integrity valid again.');

  console.log('\nALL PROMPT 5 BACKEND TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\nTEST FAILED:', err.data || err.message);
  process.exit(1);
});
