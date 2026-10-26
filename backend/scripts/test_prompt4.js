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
  console.log('--- STARTING PROMPT 4 BACKEND TESTS ---');

  // 1. Login as Officer KTR (Kottarakara)
  console.log('\n[1] Logging in as Officer KTR...');
  const ktrLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      identifier: 'officer.kottarakara',
      password: 'Officer@123',
      login_as: 'OFFICIAL'
    })
  });
  const ktrToken = ktrLogin.data.token;
  console.log('Officer KTR logged in successfully.');

  // 2. Check incoming verification requests for KTR
  console.log('\n[2] Checking incoming verification requests for KTR...');
  const ktrIncoming = await req(`${API}/verification-requests?direction=incoming`, {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });
  console.log(`Incoming requests found: ${ktrIncoming.data.items.length}`);
  const req1 = ktrIncoming.data.items.find(r => r.request_no === 'CP-2026-0001');
  if (!req1) {
    throw new Error('CP-2026-0001 not found in incoming requests for KTR!');
  }
  console.log(`Found CP-2026-0001: subject=${req1.subject_name}, status=${req1.status}`);

  // 3. Check outgoing verification requests for KTR (should NOT contain CP-2026-0001)
  console.log('\n[3] Checking outgoing verification requests for KTR...');
  const ktrOutgoing = await req(`${API}/verification-requests?direction=outgoing`, {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });
  const inOutgoing = ktrOutgoing.data.items.find(r => r.request_no === 'CP-2026-0001');
  if (inOutgoing) {
    throw new Error('CP-2026-0001 should NOT be in outgoing requests for KTR!');
  }
  console.log('CP-2026-0001 is correctly isolated from outgoing requests.');

  // Check that KTR outgoing DOES contain CP-2026-0002
  const req2 = ktrOutgoing.data.items.find(r => r.request_no === 'CP-2026-0002');
  if (!req2) {
    throw new Error('CP-2026-0002 should be in outgoing requests for KTR!');
  }
  console.log('CP-2026-0002 correctly found in outgoing requests for KTR.');

  // 4. Check counts endpoint
  console.log('\n[4] Checking counts endpoint...');
  const counts = await req(`${API}/verification-requests/counts`, {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });
  console.log('Counts:', counts.data);

  // 5. Check request details for CP-2026-0001 (Verifying Officer view)
  console.log('\n[5] Checking request details for CP-2026-0001...');
  const detail = await req(`${API}/verification-requests/${req1.verification_id}`, {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });
  console.log(`Subject Aadhaar: ${detail.data.subject_aadhaar} (Should be unmasked 12 digits)`);
  if (detail.data.subject_aadhaar.includes('X')) {
    throw new Error('Subject Aadhaar should be UNMASKED for the verifying officer!');
  }
  console.log('Required records bullets:', detail.data.required_records);
  if (!detail.data.required_records || detail.data.required_records.length === 0) {
    throw new Error('Required records bullets must not be empty!');
  }

  // 6. Test wrong password for digital signing
  console.log('\n[6] Testing digital signing with wrong password...');
  try {
    await req(`${API}/verification-requests/${req1.verification_id}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ktrToken}` },
      body: JSON.stringify({
        decision: 'APPROVED',
        remarks: 'Confirmed from Ward 4 records',
        password: 'WrongPassword999'
      })
    });
    throw new Error('Signing with wrong password should have failed!');
  } catch (err) {
    if (err.status === 401) {
      console.log('Correctly rejected with 401:', err.message);
    } else {
      throw err;
    }
  }

  // 7. Test digital signing with correct password
  console.log('\n[7] Testing digital signing with correct password...');
  const signRes = await req(`${API}/verification-requests/${req1.verification_id}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ktrToken}` },
    body: JSON.stringify({
      decision: 'APPROVED',
      remarks: 'Confirmed from Ward 4 records. Family lives here.',
      password: 'Officer@123'
    })
  });
  console.log('Signing result:', signRes.data);
  if (!signRes.data.signature_check || !signRes.data.signature_check.valid) {
    throw new Error('Signature check returned invalid on signed response!');
  }
  console.log('Digital signature created and verified successfully!');

  // 8. Test live signature check endpoint
  console.log('\n[8] Testing GET check-signature endpoint...');
  const checkSig = await req(`${API}/verification-requests/${req1.verification_id}/check-signature`, {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });
  console.log('Check signature result:', checkSig.data);
  if (!checkSig.data.valid) {
    throw new Error('check-signature endpoint returned invalid!');
  }

  // 9. Tamper test: modify response_remarks in DB and test check-signature
  console.log('\n[9] Tamper test: Modifying response_remarks in DB...');
  const originalRemarks = 'Confirmed from Ward 4 records. Family lives here.';
  await query(
    'UPDATE verification_requests SET response_remarks = "TAMPERED REMARKS" WHERE verification_id = ?',
    [req1.verification_id]
  );
  const tamperedCheck = await req(`${API}/verification-requests/${req1.verification_id}/check-signature`, {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });
  console.log('Tampered check signature result:', tamperedCheck.data);
  if (tamperedCheck.data.valid !== false) {
    throw new Error('Tampered record should fail signature verification!');
  }
  console.log('Tamper successfully detected! Reason:', tamperedCheck.data.reason);

  // Restore original remarks
  await query(
    'UPDATE verification_requests SET response_remarks = ? WHERE verification_id = ?',
    [originalRemarks, req1.verification_id]
  );
  const restoredCheck = await req(`${API}/verification-requests/${req1.verification_id}/check-signature`, {
    headers: { Authorization: `Bearer ${ktrToken}` }
  });
  if (!restoredCheck.data.valid) {
    throw new Error('Restored record should pass signature verification!');
  }
  console.log('Signature restored and valid again.');

  // 10. Login as Officer KLM (Home officer for CP-2026-0001)
  console.log('\n[10] Logging in as Officer KLM (Home officer)...');
  const klmLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      identifier: 'officer.kollam',
      password: 'Officer@123',
      login_as: 'OFFICIAL'
    })
  });
  const klmToken = klmLogin.data.token;

  // 11. Check Application detail for CP-2026-0001
  console.log('\n[11] Fetching application detail as Officer KLM...');
  const appRes = await req(`${API}/applications/${req1.application_id}`, {
    headers: { Authorization: `Bearer ${klmToken}` }
  });
  const appData = appRes.data;
  console.log(`Application status: ${appData.application.status}`);
  console.log('Blockers:', appData.blockers);
  console.log('Can approve:', appData.can_approve);
  console.log('Can reject:', appData.can_reject);

  // 12. Verify all unverified home documents
  console.log('\n[12] Verifying home documents...');
  for (const doc of appData.documents) {
    if (doc.needs_home_verification && doc.verification_status !== 'VERIFIED') {
      console.log(`Verifying doc ID ${doc.document_id} (${doc.document_name})...`);
      await req(`${API}/applications/${appData.application.application_id}/documents/${doc.document_id}/verify`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${klmToken}` },
        body: JSON.stringify({ status: 'VERIFIED', remarks: 'Physical record checked' })
      });
    }
  }

  // 13. Re-fetch application detail
  console.log('\n[13] Re-fetching application detail after verifying docs...');
  const appRes2 = await req(`${API}/applications/${req1.application_id}`, {
    headers: { Authorization: `Bearer ${klmToken}` }
  });
  console.log('Updated blockers:', appRes2.data.blockers);
  console.log('Can approve now:', appRes2.data.can_approve);
  if (!appRes2.data.can_approve) {
    throw new Error(`Expected can_approve to be true, got false! Blockers: ${JSON.stringify(appRes2.data.blockers)}`);
  }

  // 14. Approve application
  console.log('\n[14] Approving application...');
  const decisionRes = await req(`${API}/applications/${appData.application.application_id}/decision`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${klmToken}` },
    body: JSON.stringify({
      decision: 'APPROVED',
      remarks: 'All records and inter-panchayat verifications verified.'
    })
  });
  console.log('Decision result:', decisionRes.data);
  if (decisionRes.data.status !== 'APPROVED') {
    throw new Error('Application should be APPROVED!');
  }

  console.log('\nALL PROMPT 4 BACKEND TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\nTEST FAILED:', err.data || err.message);
  process.exit(1);
});
