const { chromium } = require('playwright');

async function testUserIssues() {
  console.log('Testing User Reported Issues in Real Chrome...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const report = {};

  // 1. ADMIN MODULE TESTS
  console.log('\n--- 1. Testing Admin Module ---');
  await page.goto('http://localhost:5173/login');
  await page.click('button:has-text("Panchayat Official")');
  await page.fill('input[placeholder*="officer.kottarakara"]', 'admin');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => url.pathname.startsWith('/admin'));

  // 1a. Users
  await page.goto('http://localhost:5173/admin/users');
  await page.waitForSelector('table tbody tr');
  await page.waitForTimeout(1000);
  const userRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log(`Admin Users rows count: ${userRows.length}`);
  const firstUser = userRows[0];
  console.log('First User row sample:', firstUser.replace(/\n+/g, ' | '));
  report.adminUsers = {
    count: userRows.length,
    hasRealData: !firstUser.includes('— | — | —') && firstUser.includes('admin')
  };

  // 1b. Panchayats
  await page.goto('http://localhost:5173/admin/panchayats');
  await page.waitForSelector('table tbody tr');
  await page.waitForTimeout(1000);
  const panchayatRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log(`Admin Panchayats rows count: ${panchayatRows.length}`);
  const firstPanchayat = panchayatRows[0];
  console.log('First Panchayat row sample:', firstPanchayat.replace(/\n+/g, ' | '));
  report.adminPanchayats = {
    count: panchayatRows.length,
    hasRealData: !firstPanchayat.includes('— | — | —') && (firstPanchayat.includes('Kottarakara') || firstPanchayat.includes('GP'))
  };

  // 1c. Master Data
  await page.goto('http://localhost:5173/admin/master-data');
  await page.waitForSelector('table tbody tr');
  await page.waitForTimeout(1000);
  const masterRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log(`Admin Master Data rows count: ${masterRows.length}`);
  const firstMaster = masterRows[0];
  console.log('First Master Data row sample:', firstMaster.replace(/\n+/g, ' | '));
  report.adminMasterData = {
    count: masterRows.length,
    hasRealData: !firstMaster.includes('— | — | —')
  };

  // 1d. Audit Logs
  await page.goto('http://localhost:5173/admin/audit-logs');
  await page.waitForSelector('table tbody tr');
  await page.waitForTimeout(1000);
  const auditRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log(`Admin Audit Logs rows count: ${auditRows.length}`);
  const firstAudit = auditRows[0];
  console.log('First Audit Log row sample:', firstAudit.replace(/\n+/g, ' | '));
  report.adminAuditLogs = {
    count: auditRows.length,
    hasRealData: !firstAudit.includes('— | — | —')
  };

  // 2. CITIZEN MODULE TESTS
  console.log('\n--- 2. Testing Citizen Module ---');
  // Logout
  await page.click('button:has-text("Sign out")');
  await page.waitForTimeout(1000);

  // Login as Citizen (Akhil K S - 9876500001)
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="text"]', '9876500001');
  await page.fill('input[type="password"]', 'Citizen@123');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => url.pathname.startsWith('/citizen'));

  // Citizen My Applications
  await page.goto('http://localhost:5173/citizen/applications');
  await page.waitForSelector('table tbody tr');
  await page.waitForTimeout(1000);
  const citAppRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log(`Citizen Applications rows count: ${citAppRows.length}`);
  const firstCitApp = citAppRows[0];
  console.log('First Citizen App row sample:', firstCitApp.replace(/\n+/g, ' | '));
  report.citizenApplications = {
    count: citAppRows.length,
    hasRealData: !firstCitApp.includes('— | — | —') && (firstCitApp.includes('EWS') || firstCitApp.includes('CP-') || firstCitApp.includes('SUBMITTED') || firstCitApp.includes('PENDING'))
  };

  // 3. OFFICER MODULE TESTS - ANCHAL GP (officer.anchal)
  console.log('\n--- 3. Testing Officer Module (Anchal GP - officer.anchal) ---');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173/login');
  await page.click('button:has-text("Panchayat Official")');
  await page.fill('input[placeholder*="officer.kottarakara"]', 'officer.anchal');
  await page.fill('input[type="password"]', 'Officer@123');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => url.pathname.startsWith('/officer'));

  // 3a. Incoming Requests - Check tabs
  await page.goto('http://localhost:5173/officer/incoming');
  await page.waitForTimeout(1000);
  // Pending tab
  const pendingText = await page.innerText('main');
  console.log('Incoming Pending Tab contains "No pending requests found":', pendingText.includes('No pending requests found'));

  // Click "Approved & Signed" tab
  const approvedTabBtn = await page.waitForSelector('button:has-text("Approved & Signed")');
  await approvedTabBtn.click();
  await page.waitForTimeout(1000);
  const approvedIncomingRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log(`Incoming Approved tab rows: ${approvedIncomingRows.length}`);
  console.log('First Approved incoming request:', approvedIncomingRows[0]?.replace(/\n+/g, ' | '));
  report.anchalIncomingApproved = {
    count: approvedIncomingRows.length,
    firstRow: approvedIncomingRows[0]
  };

  // 4. OFFICER MODULE TESTS - KOTTARAKARA GP (officer.kottarakara)
  console.log('\n--- 4. Testing Officer Module (Kottarakara GP - officer.kottarakara) ---');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173/login');
  await page.click('button:has-text("Panchayat Official")');
  await page.fill('input[placeholder*="officer.kottarakara"]', 'officer.kottarakara');
  await page.fill('input[type="password"]', 'Officer@123');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => url.pathname.startsWith('/officer'));

  // 4a. Verify & Request (/officer/applications)
  await page.goto('http://localhost:5173/officer/applications');
  await page.waitForTimeout(1000);
  const ktrHomeApps = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log(`Kottarakara Home Applications rows: ${ktrHomeApps.length}`);
  console.log('First KTR Home App:', ktrHomeApps[0]?.replace(/\n+/g, ' | '));

  // 4b. Outgoing Requests tab
  const outgoingTabBtn = await page.waitForSelector('button:has-text("Outgoing Requests")');
  await outgoingTabBtn.click();
  await page.waitForTimeout(1000);
  const ktrOutgoingRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log(`Kottarakara Outgoing Requests rows: ${ktrOutgoingRows.length}`);
  console.log('First KTR Outgoing:', ktrOutgoingRows[0]?.replace(/\n+/g, ' | '));

  // 4c. Incoming Requests (/officer/incoming)
  await page.goto('http://localhost:5173/officer/incoming');
  await page.waitForTimeout(1000);
  const ktrIncomingPending = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log(`Kottarakara Incoming Pending rows: ${ktrIncomingPending.length}`);
  console.log('First KTR Incoming Pending:', ktrIncomingPending[0]?.replace(/\n+/g, ' | '));

  report.kottarakara = {
    homeAppsCount: ktrHomeApps.length,
    firstHomeApp: ktrHomeApps[0],
    outgoingCount: ktrOutgoingRows.length,
    firstOutgoing: ktrOutgoingRows[0],
    incomingPendingCount: ktrIncomingPending.length,
    firstIncoming: ktrIncomingPending[0]
  };

  await browser.close();

  console.log('\n=============================================');
  console.log('FINAL REPORT SUMMARY:');
  console.log(JSON.stringify(report, null, 2));
  console.log('=============================================');
}

testUserIssues().catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
});
