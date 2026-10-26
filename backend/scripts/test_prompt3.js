const fs = require('fs');
const path = require('path');

async function runChecklist() {
  console.log('======================================================');
  console.log('RUNNING ACCEPTANCE CHECKLIST FOR PROMPT 3');
  console.log('======================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Log in as Akhil (9876500001 / Citizen@123)
  console.log('\n1. Log in as Akhil (9876500001 / Citizen@123)');
  const loginAkhilRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '9876500001', password: 'Citizen@123', login_as: 'CITIZEN' })
  });
  const loginAkhil = await loginAkhilRes.json();
  assert(loginAkhilRes.status === 200, 'Akhil login returned 200');
  const tokenAkhil = loginAkhil.data?.token;
  assert(!!tokenAkhil, 'Received Akhil token');

  // Check seeded application EWS appears with timeline and pending request info
  const appsRes = await fetch('http://localhost:5000/api/applications', {
    headers: { Authorization: 'Bearer ' + tokenAkhil }
  });
  const appsData = await appsRes.json();
  assert(appsRes.status === 200, 'GET /api/applications returned 200');
  const seededApp = appsData.data?.items?.find(a => a.application_no === 'EWS-2026-0001');
  assert(!!seededApp, 'Found seeded application EWS-2026-0001');
  assert(seededApp?.status === 'PENDING_EXTERNAL', 'Seeded application status is PENDING_EXTERNAL');
  assert(Number(seededApp?.pending_requests_count) === 1, 'Seeded application has 1 pending request');

  const appDetailRes = await fetch(`http://localhost:5000/api/applications/${seededApp.application_id}`, {
    headers: { Authorization: 'Bearer ' + tokenAkhil }
  });
  const appDetail = await appDetailRes.json();
  assert(appDetailRes.status === 200, 'GET /api/applications/:id returned 200');
  assert(appDetail.data?.parties?.length === 2, 'Application has 2 parties (Father and Mother)');
  assert(appDetail.data?.timeline?.length >= 2, 'Application timeline has events');
  assert(appDetail.data?.citizen?.aadhaar_no?.startsWith('XXXX'), 'Citizen Aadhaar is masked');

  // 2. Apply as Akhil for EWS with Father in Kottarakara GP (1) and Mother in Kollam GP (2, own)
  console.log('\n2. Apply as Akhil for EWS (Father in KTR, Mother in KLM)');
  const dummyPdf = Buffer.from('%PDF-1.4 sample test document %%EOF');

  async function submitForm(certId, parties, fileMetaList, filesList, purpose = 'SCHOLARSHIP') {
    const formData = new FormData();
    formData.append('data', JSON.stringify({
      certificate_type_id: certId,
      purpose,
      declared_family_income: 180000,
      land_holding_cents: 12,
      house_area_sqft: 850,
      other_property_details: 'None',
      parties
    }));
    formData.append('fileMeta', JSON.stringify(fileMetaList));
    for (const f of filesList) {
      const blob = new Blob([dummyPdf], { type: 'application/pdf' });
      formData.append('files', blob, f.name);
    }
    const res = await fetch('http://localhost:5000/api/applications', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenAkhil },
      body: formData
    });
    return { status: res.status, data: await res.json() };
  }

  const ewsMeta = [
    { document_type: 'AADHAAR', document_name: 'Applicant Aadhaar', related_to: 'APPLICANT' },
    { document_type: 'RATION_CARD', document_name: 'Ration Card', related_to: 'APPLICANT' },
    { document_type: 'INCOME_PROOF', document_name: 'Income Proof', related_to: 'APPLICANT' },
    { document_type: 'PROPERTY_TAX', document_name: 'Property Tax Receipt', related_to: 'APPLICANT' },
    { document_type: 'FATHER_ID', document_name: "Father's ID Proof", related_to: 'FATHER' },
    { document_type: 'MOTHER_ID', document_name: "Mother's ID Proof", related_to: 'MOTHER' }
  ];
  const ewsFiles = ewsMeta.map(m => ({ name: m.document_type + '.pdf' }));

  const app1 = await submitForm(
    1,
    [
      { party_type: 'FATHER', full_name: 'Sasidharan K', aadhaar_no: '987654321011', occupation: 'FARMER', annual_income: 120000, panchayat_id: 1 },
      { party_type: 'MOTHER', full_name: 'Sreedevi S', aadhaar_no: '987654321012', occupation: 'HOMEMAKER', annual_income: 0, panchayat_id: 2 }
    ],
    ewsMeta,
    ewsFiles
  );
  assert(app1.status === 201, 'Application submission returned 201 Created');
  assert(app1.data.data?.status === 'PENDING_EXTERNAL', 'Application status is PENDING_EXTERNAL');
  assert(app1.data.data?.created_requests_count === 1, 'Exactly 1 verification request created');

  // Verify DB detail for app1
  const app1DetailRes = await fetch(`http://localhost:5000/api/applications/${app1.data.data.application_id}`, {
    headers: { Authorization: 'Bearer ' + tokenAkhil }
  });
  const app1Detail = await app1DetailRes.json();
  assert(app1Detail.data?.parties?.find(p => p.party_type === 'FATHER')?.verification_required === 1, 'Father verification_required is 1');
  assert(app1Detail.data?.parties?.find(p => p.party_type === 'MOTHER')?.verification_required === 0, 'Mother verification_required is 0');
  assert(app1Detail.data?.requests?.length === 1, 'Application has exactly 1 verification request');
  assert(app1Detail.data?.requests?.[0]?.verifying_panchayat_id === 1, 'Request verifying_panchayat_id is 1 (KTR)');

  // 3. Apply with both parents in same other panchayat (KTR)
  console.log('\n3. Apply with both parents in KTR -> TWO requests');
  const app2 = await submitForm(
    1,
    [
      { party_type: 'FATHER', full_name: 'Sasidharan K', aadhaar_no: '987654321011', occupation: 'FARMER', annual_income: 120000, panchayat_id: 1 },
      { party_type: 'MOTHER', full_name: 'Sreedevi S', aadhaar_no: '987654321012', occupation: 'HOMEMAKER', annual_income: 0, panchayat_id: 1 }
    ],
    ewsMeta,
    ewsFiles
  );
  assert(app2.status === 201, 'Two-request submission returned 201');
  assert(app2.data.data?.created_requests_count === 2, 'Exactly 2 verification requests created');
  assert(app2.data.data?.status === 'PENDING_EXTERNAL', 'Status is PENDING_EXTERNAL');

  // Apply for RESIDENCE (no parties)
  console.log('\n3b. Apply for RESIDENCE -> zero requests, status SUBMITTED');
  const resMeta = [
    { document_type: 'AADHAAR', document_name: 'Aadhaar Card', related_to: 'APPLICANT' },
    { document_type: 'RATION_CARD', document_name: 'Ration Card', related_to: 'APPLICANT' }
  ];
  const resFiles = resMeta.map(m => ({ name: m.document_type + '.pdf' }));
  const app3 = await submitForm(3, [], resMeta, resFiles);
  assert(app3.status === 201, 'Residence submission returned 201');
  assert(app3.data.data?.created_requests_count === 0, 'Zero verification requests created');
  assert(app3.data.data?.status === 'SUBMITTED', 'Status is SUBMITTED');

  // 4. Missing mandatory document or wrong file type
  console.log('\n4. Negative checks: missing mandatory doc');
  const missingDocRes = await submitForm(
    1,
    [
      { party_type: 'FATHER', full_name: 'Sasidharan K', aadhaar_no: '987654321011', occupation: 'FARMER', annual_income: 120000, panchayat_id: 1 },
      { party_type: 'MOTHER', full_name: 'Sreedevi S', aadhaar_no: '987654321012', occupation: 'HOMEMAKER', annual_income: 0, panchayat_id: 2 }
    ],
    [{ document_type: 'AADHAAR', document_name: 'Aadhaar', related_to: 'APPLICANT' }],
    [{ name: 'aadhaar.pdf' }]
  );
  assert(missingDocRes.status === 400, 'Missing mandatory doc rejected with 400');
  assert(missingDocRes.data.message.includes('Missing mandatory documents'), 'Error lists missing mandatory documents');

  // 5. Log in as officer.kottarakara: bell shows verification request notification
  console.log('\n5. Officer Kottarakara notifications check');
  const loginOffRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'officer.kottarakara', password: 'Officer@123', login_as: 'OFFICIAL' })
  });
  const loginOff = await loginOffRes.json();
  const tokenOff = loginOff.data?.token;
  assert(loginOffRes.status === 200, 'Officer login returned 200');

  const offNotifRes = await fetch('http://localhost:5000/api/notifications', {
    headers: { Authorization: 'Bearer ' + tokenOff }
  });
  const offNotifs = await offNotifRes.json();
  const foundVR = offNotifs.data?.items?.some(n => n.notification_type === 'VERIFICATION_REQUEST');
  assert(foundVR, 'Officer has VERIFICATION_REQUEST notification');

  // 6. Citizen data isolation: Citizen Anu cannot open Akhil application and cannot stream Akhil document
  console.log('\n6. Citizen data isolation');
  const loginAnuRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '9876500002', password: 'Citizen@123', login_as: 'CITIZEN' })
  });
  const loginAnu = await loginAnuRes.json();
  const tokenAnu = loginAnu.data?.token;

  const anuViewApp1 = await fetch(`http://localhost:5000/api/applications/${app1.data.data.application_id}`, {
    headers: { Authorization: 'Bearer ' + tokenAnu }
  });
  assert(anuViewApp1.status === 404, 'Citizen Anu gets 404 when trying to view Akhil application');

  const docId = app1Detail.data?.documents?.[0]?.document_id;
  const anuViewDoc = await fetch(`http://localhost:5000/api/documents/${docId}/file`, {
    headers: { Authorization: 'Bearer ' + tokenAnu }
  });
  assert(anuViewDoc.status === 404, 'Citizen Anu gets 404 when trying to stream Akhil document');

  // Admin cannot stream document
  const loginAdminRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'Admin@123', login_as: 'OFFICIAL' })
  });
  const loginAdmin = await loginAdminRes.json();
  const tokenAdmin = loginAdmin.data?.token;

  const adminViewDoc = await fetch(`http://localhost:5000/api/documents/${docId}/file`, {
    headers: { Authorization: 'Bearer ' + tokenAdmin }
  });
  assert(adminViewDoc.status === 404, 'Admin gets 404 when trying to stream uploaded citizen document');

  console.log('\n======================================================');
  console.log(`CHECKLIST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================');
  if (failed > 0) process.exit(1);
}

runChecklist().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
