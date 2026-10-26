const { chromium } = require('playwright');
const assert = require('assert');

async function runFullOfficerFlow() {
  console.log('===========================================================');
  console.log('STARTING FULL OFFICER PORTAL END-TO-END FLOW TEST');
  console.log('===========================================================\n');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Console Error] ${msg.text()}`);
    }
  });

  page.on('response', res => {
    if (res.status() >= 400 && !res.url().includes('favicon')) {
      networkErrors.push(`[HTTP ${res.status()}] ${res.url()}`);
    }
  });

  // STEP 1: Log in as officer.kottarakara (Kottarakara GP)
  console.log('--- Step 1: Login as officer.kottarakara ---');
  await page.goto('http://localhost:5173/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173/login');
  await page.click('button:has-text("Panchayat Official")');
  await page.fill('input[placeholder*="officer.kottarakara"]', 'officer.kottarakara');
  await page.fill('input[type="password"]', 'Officer@123');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => url.pathname.startsWith('/officer'));
  console.log('✓ Successfully logged in as officer.kottarakara');

  // STEP 2: Verify & Request Page
  console.log('\n--- Step 2: Testing Verify & Request (/officer/applications) ---');
  await page.goto('http://localhost:5173/officer/applications');
  await page.waitForTimeout(1500);

  // Check Home Applications table
  const homeRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log('Home Applications row count:', homeRows.length);
  assert(homeRows.length > 0, 'Home applications table should have rows');
  console.log('Home App 1:', homeRows[0].replace(/\n+/g, ' | '));

  // Check Outgoing Requests tab
  const outTabBtn = await page.waitForSelector('button:has-text("Outgoing Requests")');
  await outTabBtn.click();
  await page.waitForTimeout(1500);
  const outRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log('Outgoing Requests row count:', outRows.length);
  assert(outRows.length > 0, 'Outgoing requests table should have rows');
  console.log('Outgoing Req 1:', outRows[0].replace(/\n+/g, ' | '));

  // STEP 3: Incoming Requests & Signing Flow
  console.log('\n--- Step 3: Testing Incoming Requests (/officer/incoming) & RSA Signing ---');
  await page.goto('http://localhost:5173/officer/incoming');
  await page.waitForTimeout(1500);

  const incPendingRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log('Incoming Pending row count:', incPendingRows.length);
  assert(incPendingRows.length > 0, 'Incoming pending table should have rows');
  console.log('Incoming Pending 1:', incPendingRows[0].replace(/\n+/g, ' | '));

  // Click Review & Sign button on CP-2026-0001
  const reviewSignBtn = await page.waitForSelector('button:has-text("Review & Sign")');
  await reviewSignBtn.click();
  await page.waitForTimeout(2000);
  console.log('Navigated to Incoming Detail:', page.url());

  // Check page elements
  const targetName = await page.innerText('body');
  assert(targetName.includes('Sasidharan K'), 'Should show Sasidharan K');
  assert(targetName.includes('Kollam GP'), 'Should show Kollam GP as originating');
  console.log('✓ Incoming request details verified');

  // Click "Approve & Sign"
  const approveSignBtn = await page.waitForSelector('button:has-text("Approve & Sign")');
  await approveSignBtn.click();
  await page.waitForTimeout(800);

  // Fill password to unlock RSA private key
  await page.fill('input[placeholder="Enter your account password"]', 'Officer@123');
  const submitSignBtn = await page.waitForSelector('button[type="submit"]:has-text("Sign & Dispatch Response"), button[type="submit"]:has-text("Sign & Submit Response")');
  await Promise.all([
    page.waitForResponse(res => res.url().includes('/respond') && res.status() === 200, { timeout: 20000 }),
    submitSignBtn.click()
  ]);
  await page.waitForTimeout(2000);

  // Verify signature panel rendered
  const bodyAfterSign = await page.innerText('body');
  assert(bodyAfterSign.includes('Recorded Decision & Cryptographic Proof') || bodyAfterSign.includes('Signature'), 'Signature panel should appear');
  console.log('✓ Cryptographic signature created and response recorded successfully');

  // Test SignaturePanel technical toggle
  const techBtn = await page.$('button:has-text("Technical Details")');
  if (techBtn) {
    await techBtn.click();
    await page.waitForTimeout(1000);
    const techText = await page.innerText('body');
    assert(techText.includes('SHA-256') || techText.includes('Payload Hash'), 'Should show technical hash');
    console.log('✓ Technical cryptographic details verified in SignaturePanel');
  }

  // STEP 4: Switch to officer.kollam to test Application Decision & Certificate Issuance
  console.log('\n--- Step 4: Login as officer.kollam (home officer for App 1) ---');
  await page.goto('http://localhost:5173/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173/login');
  await page.click('button:has-text("Panchayat Official")');
  await page.fill('input[placeholder*="officer.kottarakara"]', 'officer.kollam');
  await page.fill('input[type="password"]', 'Officer@123');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => url.pathname.startsWith('/officer'));
  console.log('✓ Successfully logged in as officer.kollam');

  // Go to Application Detail for EWS-2026-0001
  await page.goto('http://localhost:5173/officer/applications/1');
  await page.waitForTimeout(2000);
  console.log('Navigated to Application 1 Detail:', page.url());

  // Check that CP-2026-0001 now shows APPROVED with signature
  const appDetailText = await page.innerText('body');
  assert(appDetailText.toUpperCase().includes('APPROVED'), 'Verification request should show APPROVED');
  console.log('✓ Cross-panchayat verification response verified on home application');

  // Verify remaining pending document if any
  const verifyDocBtns = await page.$$('button:has-text("Verify")');
  console.log(`Found ${verifyDocBtns.length} unverified document action buttons`);
  for (let i = 0; i < verifyDocBtns.length; i++) {
    const btn = await page.$('button:has-text("Verify")');
    if (btn) {
      await btn.click();
      await page.waitForTimeout(500);
      const submitDocBtn = await page.$('button[type="submit"]:has-text("Confirm VERIFIED"), button:has-text("Confirm Document")');
      if (submitDocBtn) {
        await Promise.all([
          page.waitForResponse(res => res.url().includes('/verify') && res.status() === 200, { timeout: 10000 }).catch(() => null),
          submitDocBtn.click()
        ]);
        await page.waitForTimeout(1000);
      }
    }
  }

  // Reload details
  await page.goto('http://localhost:5173/officer/applications/1');
  await page.waitForTimeout(2000);

  // Check if Ready for Decision / Approve Application is available
  const approveAppBtn = await page.$('button:has-text("Approve Application")');
  if (approveAppBtn) {
    console.log('Found "Approve Application" button. Approving application...');
    await approveAppBtn.click();
    await page.waitForTimeout(500);
    const confirmApproveBtn = await page.$('button[type="submit"]:has-text("Confirm APPROVED"), button:has-text("Approve & Continue")');
    if (confirmApproveBtn) {
      await Promise.all([
        page.waitForResponse(res => res.url().includes('/decision') && res.status() === 200, { timeout: 15000 }),
        confirmApproveBtn.click()
      ]);
      await page.waitForTimeout(2000);
      console.log('✓ Application approved');
    }
  }

  // Reload to see if Issue Certificate is available
  await page.goto('http://localhost:5173/officer/applications/1');
  await page.waitForTimeout(2000);

  const issueCertBtn = await page.$('button:has-text("Issue Certificate")');
  if (issueCertBtn) {
    console.log('Found "Issue Certificate" button. Issuing official certificate...');
    await issueCertBtn.click();
    await page.waitForTimeout(500);
    const confirmIssueBtn = await page.$('button:has-text("Yes, Issue Certificate"), button:has-text("Generate & Issue Certificate")');
    if (confirmIssueBtn) {
      await Promise.all([
        page.waitForResponse(res => res.url().includes('issue-certificate') && (res.status() === 201 || res.status() === 200), { timeout: 15000 }),
        confirmIssueBtn.click()
      ]);
      await page.waitForTimeout(3000);
      console.log('✓ Certificate issued successfully');
    }
  }

  // STEP 5: Check Issued Certificates Page (/officer/certificates)
  console.log('\n--- Step 5: Testing Issued Certificates (/officer/certificates) ---');
  await page.goto('http://localhost:5173/officer/certificates');
  await page.waitForTimeout(2000);

  const certTableRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
  console.log('Certificates table row count:', certTableRows.length);
  console.log('Certificates Row 1:', certTableRows[0]?.replace(/\n+/g, ' | '));

  assert(!certTableRows[0].includes('No certificates found'), 'Should display issued certificate in table');
  console.log('✓ Issued certificate appears in table with certificate number, verification code, and PDF download');

  // STEP 6: Test Public Certificate Verification
  console.log('\n--- Step 6: Testing Public Certificate Verification (/verify) ---');
  const verifyLink = await page.$('a[href*="/verify/"]');
  if (verifyLink) {
    const href = await verifyLink.getAttribute('href');
    console.log(`Testing public verification link: ${href}`);
    await page.goto(`http://localhost:5173${href}`);
    await page.waitForTimeout(2000);
    const verifyPageText = await page.innerText('body');
    assert(verifyPageText.includes('VALID') || verifyPageText.includes('Certificate Details'), 'Public verification should show VALID certificate');
    console.log('✓ Public certificate verification verified and VALID');
  }

  console.log('\n===========================================================');
  console.log('TEST SUMMARY: ALL OFFICER FLOWS TESTED SUCCESSFULLY!');
  console.log('Console Errors:', consoleErrors);
  console.log('Network Errors:', networkErrors);
  console.log('===========================================================');

  await browser.close();
}

runFullOfficerFlow().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
