const { chromium } = require('playwright');

const officers = [
  { username: 'officer.kottarakara', panchayat: 'Kottarakara GP', id: 1 },
  { username: 'officer.kollam', panchayat: 'Kollam GP', id: 2 },
  { username: 'officer.kadakkal', panchayat: 'Kadakkal GP', id: 3 },
  { username: 'officer.anchal', panchayat: 'Anchal GP', id: 4 },
];

async function deepOfficerCheck() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Console ${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('response', res => {
    if (res.status() >= 400 && !res.url().includes('favicon')) {
      networkErrors.push(`[HTTP ${res.status()}] ${res.url()}`);
    }
  });

  for (const off of officers) {
    console.log(`\n======================================================`);
    console.log(`Testing Officer: ${off.username} (${off.panchayat})`);
    console.log(`======================================================`);

    // 1. Login
    await page.goto('http://localhost:5173/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:5173/login');
    await page.click('button:has-text("Panchayat Official")');
    await page.fill('input[placeholder*="officer.kottarakara"]', off.username);
    await page.fill('input[type="password"]', 'Officer@123');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => url.pathname.startsWith('/officer'));

    // 2. Verify & Request (/officer/applications)
    console.log('\n--- Checking Verify & Request (/officer/applications) ---');
    await page.goto('http://localhost:5173/officer/applications');
    await page.waitForTimeout(1500);

    // Tab 1: Home Applications
    const homeTabBtn = await page.waitForSelector('button:has-text("Home Applications")');
    const homeTabText = await homeTabBtn.innerText();
    console.log('Home Applications Tab:', homeTabText.replace(/\n+/g, ' '));
    const homeRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
    console.log(`Home Applications rendered rows (${homeRows.length}):`, homeRows.map(r => r.replace(/\n+/g, ' | ')));

    // Check if clicking "Review" on first application works
    const reviewBtn = await page.$('button:has-text("Review")');
    if (reviewBtn) {
      console.log('Found "Review" button. Testing navigation to application detail...');
      await reviewBtn.click();
      await page.waitForTimeout(1500);
      console.log('Current URL after Review click:', page.url());
      const appDetailTitle = await page.$eval('h1, h2, h3', el => el.innerText).catch(() => 'none');
      console.log('App Detail header:', appDetailTitle);
      await page.goto('http://localhost:5173/officer/applications');
      await page.waitForTimeout(1000);
    }

    // Tab 2: Outgoing Requests
    const outgoingTabBtn = await page.waitForSelector('button:has-text("Outgoing Requests")');
    const outTabText = await outgoingTabBtn.innerText();
    console.log('Outgoing Requests Tab:', outTabText.replace(/\n+/g, ' '));
    await outgoingTabBtn.click();
    await page.waitForTimeout(1500);
    const outRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
    console.log(`Outgoing Requests rendered rows (${outRows.length}):`, outRows.map(r => r.replace(/\n+/g, ' | ')));

    // 3. Incoming Requests (/officer/incoming)
    console.log('\n--- Checking Incoming Requests (/officer/incoming) ---');
    await page.goto('http://localhost:5173/officer/incoming');
    await page.waitForTimeout(1500);

    // Tab 1: Pending Requests
    const pendingTabBtn = await page.waitForSelector('button:has-text("Pending Requests")');
    console.log('Pending Tab:', (await pendingTabBtn.innerText()).replace(/\n+/g, ' '));
    const incomingPendingRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
    console.log(`Incoming Pending rendered rows (${incomingPendingRows.length}):`, incomingPendingRows.map(r => r.replace(/\n+/g, ' | ')));

    // If there is a pending request, check review & sign button
    const reviewSignBtn = await page.$('button:has-text("Review & Sign")');
    if (reviewSignBtn) {
      console.log('Found "Review & Sign" button. Testing navigation...');
      await reviewSignBtn.click();
      await page.waitForTimeout(1500);
      console.log('Current URL after Review & Sign click:', page.url());
      const incomingDetailTitle = await page.$eval('h1, h2, h3', el => el.innerText).catch(() => 'none');
      console.log('Incoming Detail header:', incomingDetailTitle);
      await page.goto('http://localhost:5173/officer/incoming');
      await page.waitForTimeout(1000);
    }

    // Tab 2: Approved & Signed
    const approvedTabBtn = await page.waitForSelector('button:has-text("Approved & Signed")');
    console.log('Approved Tab:', (await approvedTabBtn.innerText()).replace(/\n+/g, ' '));
    await approvedTabBtn.click();
    await page.waitForTimeout(1500);
    const incomingApprovedRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
    console.log(`Incoming Approved rendered rows (${incomingApprovedRows.length}):`, incomingApprovedRows.map(r => r.replace(/\n+/g, ' | ')));

    // Tab 3: Rejected
    const rejectedTabBtn = await page.waitForSelector('button:has-text("Rejected")');
    console.log('Rejected Tab:', (await rejectedTabBtn.innerText()).replace(/\n+/g, ' '));
    await rejectedTabBtn.click();
    await page.waitForTimeout(1500);
    const incomingRejectedRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
    console.log(`Incoming Rejected rendered rows (${incomingRejectedRows.length}):`, incomingRejectedRows.map(r => r.replace(/\n+/g, ' | ')));

    // 4. Issued Certificates (/officer/certificates)
    console.log('\n--- Checking Issued Certificates (/officer/certificates) ---');
    await page.goto('http://localhost:5173/officer/certificates');
    await page.waitForTimeout(1500);
    const certRows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.trim()));
    console.log(`Certificates rendered rows (${certRows.length}):`, certRows.map(r => r.replace(/\n+/g, ' | ')));
  }

  console.log('\n======================================================');
  console.log('ERRORS DETECTED DURING TEST:');
  console.log('Console Errors:', consoleErrors);
  console.log('Network Errors:', networkErrors);
  console.log('======================================================');

  await browser.close();
}

deepOfficerCheck().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
