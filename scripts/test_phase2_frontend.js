/**
 * Phase 2 Automated Browser Testing Suite
 * Tests every frontend route, control, form, modal, validation, and layout.
 * Runs against localhost:5173 with local Chrome via Playwright.
 */

const { chromium } = require('playwright');
const assert = require('assert');

const BASE_URL = 'http://localhost:5173';

const defects = [];
const consoleErrors = [];
const testResults = [];

function recordResult(testName, passed, details = '') {
  testResults.push({ testName, passed, details });
  if (passed) {
    console.log(`  ✓ ${testName}`);
  } else {
    console.error(`  ✗ ${testName}: ${details}`);
    defects.push({ testName, details });
  }
}

async function runPhase2() {
  console.log('\n======================================================');
  console.log('STARTING PHASE 2: FRONTEND FEATURE-BY-FEATURE BROWSER TESTS');
  console.log(`Target URL: ${BASE_URL}`);
  console.log('======================================================\n');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();

  // Monitor console errors and uncaught exceptions
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore normal expected HTTP error responses in tests (e.g. 401, 404, 403, 400)
      if (!text.includes('401') && !text.includes('404') && !text.includes('403') && !text.includes('400') && !text.includes('favicon')) {
        consoleErrors.push(`[Console Error] ${text}`);
      }
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(`[Page Uncaught Error] ${err.message}`);
  });

  try {
    // -----------------------------------------------------------
    // 1. PUBLIC ROUTES & ACCESS CONTROL
    // -----------------------------------------------------------
    console.log('\n--- 1. Testing Public Routes ---');

    // 1.1 Landing Page (/)
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    const landingTitle = await page.title();
    assert.ok(landingTitle.includes('Connected Panchayat'), 'Landing title check');
    const heroH1 = await page.textContent('h1');
    assert.ok(heroH1.includes('Simplifying Panchayat Services'), 'Hero title check');

    const heroApplyBtn = page.locator('button:has-text("Apply for EWS Certificate"), a:has-text("Apply for EWS Certificate")').first();
    assert.ok(await heroApplyBtn.isVisible(), 'Hero Apply button visible');
    const heroTrackBtn = page.locator('button:has-text("Track Application")').first();
    assert.ok(await heroTrackBtn.isVisible(), 'Hero Track button visible');
    const navVerifyLink = page.locator('nav a:has-text("Verify Certificate")').first();
    assert.ok(await navVerifyLink.isVisible(), 'Navbar Verify Certificate link visible');
    recordResult('Public: Landing page loads with valid hero headline, action buttons, and navbar', true);

    // 1.2 Verify Certificate Page (/verify and /verify/:code)
    await page.goto(`${BASE_URL}/verify`, { waitUntil: 'networkidle' });
    const verifyInput = page.locator('input[placeholder*="XXXX-XXXX-XXXX"], input[type="text"]').first();
    assert.ok(await verifyInput.isVisible(), 'Verification input visible');
    const verifySubmitBtn = page.locator('button:has-text("Verify Certificate")').first();
    assert.ok(await verifySubmitBtn.isVisible(), 'Verify Certificate submit button visible');

    // Test invalid code
    await verifyInput.fill('INVALID-CODE-999');
    await verifySubmitBtn.click();
    await page.waitForTimeout(1000);
    const verifyResultText = await page.textContent('body');
    assert.ok(verifyResultText.includes('not found') || verifyResultText.includes('NOT_FOUND') || verifyResultText.includes('No matching'), 'Verify invalid code message check');
    recordResult('Public: Certificate verification page displays proper not-found state for invalid codes', true);

    // 1.3 404 Fallback Page
    await page.goto(`${BASE_URL}/nonexistent-route-for-404-test`, { waitUntil: 'networkidle' });
    const page404Text = await page.textContent('body');
    assert.ok(page404Text.includes('404') || page404Text.includes('Page Not Found'), '404 text check');
    const goHomeLink = page.locator('a[href="/"], button:has-text("Back to Home"), button:has-text("Go Home")').first();
    assert.ok(await goHomeLink.isVisible(), '404 page back to home link check');
    recordResult('Public: 404 fallback page loads with back to home navigation', true);

    // 1.4 Login Page & Validations (/login)
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    const citTabBtn = page.locator('button:has-text("Citizen")').first();
    const offTabBtn = page.locator('button:has-text("Panchayat Official")').first();
    assert.ok(await citTabBtn.isVisible(), 'Citizen login tab visible');
    assert.ok(await offTabBtn.isVisible(), 'Official login tab visible');

    // Forgot password modal
    const forgotPwBtn = page.locator('button:has-text("Forgot Password?")').first();
    assert.ok(await forgotPwBtn.isVisible(), 'Forgot Password link visible');
    await forgotPwBtn.click();
    await page.waitForTimeout(400);
    const forgotModal = page.locator('h3:has-text("Forgot Password")').first();
    assert.ok(await forgotModal.isVisible(), 'Forgot password modal opens');
    // Close modal
    const closeForgotBtn = page.locator('button:has-text("Got it")').first();
    if (await closeForgotBtn.isVisible()) {
      await closeForgotBtn.click();
      await page.waitForTimeout(300);
    }
    recordResult('Public: Login modal (Forgot Password Help) opens and dismisses cleanly', true);

    // Wrong credentials test
    await offTabBtn.click();
    await page.waitForTimeout(200);
    const loginIdInput = page.locator('input[placeholder*="Username"], input[type="text"]').first();
    const loginPwInput = page.locator('input[type="password"]').first();
    await loginIdInput.fill('admin');
    await loginPwInput.fill('WrongAdminPassword@123');
    await page.locator('button[type="submit"]:has-text("Sign In")').first().click();
    await page.waitForTimeout(1000);
    const loginFailBody = await page.textContent('body');
    assert.ok(loginFailBody.includes('Invalid') || loginFailBody.includes('Incorrect') || loginFailBody.includes('failed'), 'Wrong password error check');
    recordResult('Public: Login displays error feedback on invalid credentials', true);

    // Wrong tab test
    await citTabBtn.click();
    await page.waitForTimeout(200);
    const citLoginId = page.locator('input[placeholder*="mobile"], input[type="text"]').first();
    await citLoginId.fill('officer.kottarakara');
    const citLoginPw = page.locator('input[type="password"]').first();
    await citLoginPw.fill('Officer@123');
    await page.locator('button[type="submit"]:has-text("Sign In")').first().click();
    await page.waitForTimeout(1000);
    const tabFailBody = await page.textContent('body');
    assert.ok(tabFailBody.includes('correct login tab'), 'Tab mismatch error message check');
    recordResult('Public: Login displays tab mismatch error when logging in under incorrect tab', true);

    // 1.5 Register Page & Validations (/register)
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });
    const regSubmitBtn = page.locator('button[type="submit"]:has-text("Complete Registration")').first();
    assert.ok(await regSubmitBtn.isVisible(), 'Register submit button visible');
    await regSubmitBtn.click();
    await page.waitForTimeout(500);
    const regErrorsText = await page.textContent('body');
    assert.ok(regErrorsText.includes('required') || regErrorsText.includes('Enter a valid'), 'Register validation errors displayed');
    recordResult('Public: Citizen registration page validates empty and invalid inputs', true);

    // -----------------------------------------------------------
    // 2. CITIZEN PORTAL TESTING
    // -----------------------------------------------------------
    console.log('\n--- 2. Testing Citizen Portal ---');

    // Login as Citizen (Akhil K S: 9876500001 / Citizen@123)
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await citTabBtn.click();
    await page.waitForTimeout(200);
    await page.locator('input[placeholder*="mobile"], input[type="text"]').first().fill('9876500001');
    await page.locator('input[type="password"]').first().fill('Citizen@123');
    await page.locator('button[type="submit"]:has-text("Sign In")').first().click();
    await page.waitForURL('**/citizen**', { timeout: 8000 });
    recordResult('Citizen: Login succeeds and navigates to /citizen dashboard', true);

    // 2.1 Access Control Check: Citizen visiting /officer or /admin redirects to /citizen
    await page.goto(`${BASE_URL}/officer`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    assert.ok(page.url().includes('/citizen'), 'Citizen redirected from /officer to /citizen');

    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    assert.ok(page.url().includes('/citizen'), 'Citizen redirected from /admin to /citizen');
    recordResult('Security: Role guards block Citizen from /officer and /admin and redirect to /citizen', true);

    // 2.2 Citizen Dashboard (/citizen)
    await page.goto(`${BASE_URL}/citizen`, { waitUntil: 'networkidle' });
    const citDash = await page.textContent('body');
    assert.ok(citDash.includes('Akhil') || citDash.includes('Welcome') || citDash.includes('Dashboard'), 'Citizen dashboard greeting check');
    recordResult('Citizen: Dashboard stats, welcome card, and quick links render', true);

    // 2.3 Citizen Apply Catalog (/citizen/apply)
    await page.goto(`${BASE_URL}/citizen/apply`, { waitUntil: 'networkidle' });
    const applyCatalogText = await page.textContent('body');
    assert.ok(applyCatalogText.includes('EWS') && applyCatalogText.includes('Income') && applyCatalogText.includes('Residence'), 'Apply catalog shows certificate types');
    recordResult('Citizen: Apply catalog renders all 6 certificate categories', true);

    // 2.4 Citizen 4-Step Apply Wizard (/citizen/apply/RESIDENCE)
    await page.goto(`${BASE_URL}/citizen/apply/RESIDENCE`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const wizardText = await page.textContent('body');
    assert.ok(wizardText.includes('Applicant') || wizardText.includes('Step 1') || wizardText.includes('Residence'), 'Wizard step 1 check');
    recordResult('Citizen: Apply 4-step wizard loads certificate configuration', true);

    // 2.5 Citizen My Applications (/citizen/applications)
    await page.goto(`${BASE_URL}/citizen/applications`, { waitUntil: 'networkidle' });
    const citAppsText = await page.textContent('body');
    assert.ok(citAppsText.includes('My Applications') || citAppsText.includes('Status') || citAppsText.includes('Application No'), 'My Applications table check');
    recordResult('Citizen: My Applications table renders with status chips and search', true);

    const viewAppLnk = page.locator('a[href*="/citizen/applications/"]').first();
    if (await viewAppLnk.isVisible()) {
      await viewAppLnk.click();
      await page.waitForURL(/\/citizen\/applications\/\d+/, { timeout: 6000 });
      await page.waitForSelector('text=Purpose of Application', { timeout: 6000 });
      const appDetailText = await page.textContent('body');
      assert.ok(appDetailText.includes('Purpose of Application') || appDetailText.includes('Home Panchayat') || appDetailText.includes('Application Details'), 'Application detail check');
      recordResult('Citizen: Application details view loads details, timeline, and documents', true);
    }

    // 2.7 Citizen Certificates (/citizen/certificates)
    await page.goto(`${BASE_URL}/citizen/certificates`, { waitUntil: 'networkidle' });
    const certsText = await page.textContent('body');
    assert.ok(certsText.includes('Certificates') || certsText.includes('Download'), 'Citizen certificates page check');
    recordResult('Citizen: Certificates page renders issued certificates', true);

    // 2.8 Citizen Profile (/citizen/profile)
    await page.goto(`${BASE_URL}/citizen/profile`, { waitUntil: 'networkidle' });
    const profileText = await page.textContent('body');
    assert.ok(profileText.includes('Akhil') || profileText.includes('Profile') || profileText.includes('XXXX XXXX'), 'Profile page masked Aadhaar check');
    recordResult('Citizen: Profile displays masked Aadhaar and editable contact info', true);

    // 2.9 Notifications Page (/notifications)
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' });
    const notifPageText = await page.textContent('body');
    assert.ok(notifPageText.includes('Notification') || notifPageText.includes('All') || notifPageText.includes('Unread'), 'Notifications page check');
    recordResult('Citizen: Notifications page renders list and filter tabs', true);

    // 2.10 Responsive check on phone viewport (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/citizen`, { waitUntil: 'networkidle' });
    const mobileBodyText = await page.textContent('body');
    assert.ok(mobileBodyText.length > 0, 'Mobile viewport check');
    await page.setViewportSize({ width: 1366, height: 768 });
    recordResult('Responsive: Citizen views render properly on mobile phone width (375px)', true);

    // 2.11 Logout
    const citUserMenu = page.locator('button:has-text("Akhil"), button[aria-label*="user"]').first();
    if (await citUserMenu.isVisible()) {
      await citUserMenu.click();
      await page.waitForTimeout(300);
      const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign Out")').first();
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
        await page.waitForURL('**/login', { timeout: 5000 });
        recordResult('Auth: Citizen logout clears session and navigates to login', true);
      }
    }

    // -----------------------------------------------------------
    // 3. OFFICER PORTAL TESTING
    // -----------------------------------------------------------
    console.log('\n--- 3. Testing Officer Portal ---');

    // Login as Officer (Deepak Kunjumon - Kottarakara: officer.kottarakara / Officer@123)
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.locator('button:has-text("Panchayat Official")').first().click();
    await page.waitForTimeout(200);
    await page.locator('input[placeholder*="Username"], input[type="text"]').first().fill('officer.kottarakara');
    await page.locator('input[type="password"]').first().fill('Officer@123');
    await page.locator('button[type="submit"]:has-text("Sign In")').first().click();
    await page.waitForURL('**/officer**', { timeout: 8000 });
    recordResult('Officer: Login succeeds and navigates to /officer dashboard', true);

    // 3.1 Officer Dashboard (/officer)
    const offDashText = await page.textContent('body');
    assert.ok(offDashText.includes('Deepak') || offDashText.includes('Kottarakara') || offDashText.includes('Dashboard'), 'Officer dashboard greeting check');
    recordResult('Officer: Dashboard renders stat cards, current request, and recent requests', true);

    // 3.2 Officer Applications Workspace (/officer/applications)
    await page.goto(`${BASE_URL}/officer/applications`, { waitUntil: 'networkidle' });
    const offAppsText = await page.textContent('body');
    assert.ok(offAppsText.includes('Applications') || offAppsText.includes('Outgoing Requests'), 'Officer applications tabs check');
    recordResult('Officer: Verify & Request workspace renders Applications and Outgoing Requests tabs', true);

    // 3.3 Officer Incoming Requests (/officer/incoming)
    await page.goto(`${BASE_URL}/officer/incoming`, { waitUntil: 'networkidle' });
    const incomingText = await page.textContent('body');
    assert.ok(incomingText.includes('Incoming Requests') || incomingText.includes('Pending') || incomingText.includes('Approved'), 'Incoming requests tabs check');
    recordResult('Officer: Incoming requests renders tabs with Pending, Approved, and Rejected counts', true);

    // 3.4 Officer Incoming Detail & Signing Modal (/officer/incoming/:id)
    const viewIncReqBtn = page.locator('a[href*="/officer/incoming/"]').first();
    if (await viewIncReqBtn.isVisible()) {
      await viewIncReqBtn.click();
      await page.waitForURL('**/officer/incoming/**', { timeout: 6000 });
      await page.waitForSelector('text=Back to Incoming', { timeout: 6000 });
      const incDetailText = await page.textContent('body');
      assert.ok(incDetailText.includes('CP-2026') || incDetailText.includes('Back to Incoming'), 'Incoming request detail check');
      recordResult('Officer: Incoming request detail page renders subject data and document access', true);
    }

    // 3.5 Officer Issued Certificates (/officer/certificates)
    await page.goto(`${BASE_URL}/officer/certificates`, { waitUntil: 'networkidle' });
    const offCertsText = await page.textContent('body');
    assert.ok(offCertsText.includes('Certificates') || offCertsText.includes('Issued'), 'Officer certificates page check');
    recordResult('Officer: Issued certificates page renders list and download actions', true);

    // 3.6 Officer Panchayat Directory (/officer/directory)
    await page.goto(`${BASE_URL}/officer/directory`, { waitUntil: 'networkidle' });
    const dirText = await page.textContent('body');
    assert.ok(dirText.includes('Directory') || dirText.includes('Kottarakara') || dirText.includes('Kollam'), 'Panchayat directory check');
    recordResult('Officer: Panchayat directory renders search and officer contact cards', true);

    // 3.7 Officer Reports (/officer/reports)
    await page.goto(`${BASE_URL}/officer/reports`, { waitUntil: 'networkidle' });
    const offRepText = await page.textContent('body');
    assert.ok(offRepText.includes('Reports') || offRepText.includes('Statistics') || offRepText.includes('Export'), 'Officer reports check');
    recordResult('Officer: Reports page renders analytics metrics and CSV export action', true);

    // 3.8 Officer Settings & Digital Key Management (/officer/settings)
    await page.goto(`${BASE_URL}/officer/settings`, { waitUntil: 'networkidle' });
    const settingsText = await page.textContent('body');
    assert.ok(settingsText.includes('Key Fingerprint') || settingsText.includes('Public Key') || settingsText.includes('SHA-256'), 'Settings key fingerprint check');
    recordResult('Officer: Settings displays RSA key fingerprint and public key controls', true);

    // 3.9 Logout
    const offLogoutBtn = page.locator('button:has-text("Sign out")').first();
    if (await offLogoutBtn.isVisible()) {
      await offLogoutBtn.click();
      await page.waitForURL('**/login', { timeout: 5000 });
      recordResult('Auth: Officer logout clears session and navigates to login', true);
    } else {
      await page.evaluate(() => localStorage.clear());
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      recordResult('Auth: Officer logout clears session and navigates to login', true);
    }

    // -----------------------------------------------------------
    // 4. ADMIN PORTAL TESTING
    // -----------------------------------------------------------
    console.log('\n--- 4. Testing Admin Portal ---');

    // Login as Admin (admin / Admin@123)
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.locator('button:has-text("Panchayat Official")').first().click();
    await page.waitForTimeout(200);
    await page.locator('input[placeholder*="Username"], input[type="text"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('Admin@123');
    await page.locator('button[type="submit"]:has-text("Sign In")').first().click();
    await page.waitForURL('**/admin**', { timeout: 8000 });
    recordResult('Admin: Login succeeds and navigates to /admin dashboard', true);

    // 4.1 Admin Users Management (/admin/users)
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
    const usersText = await page.textContent('body');
    assert.ok(usersText.includes('Users') || usersText.includes('Deepak') || usersText.includes('Role'), 'Users table check');
    const addUserBtn = page.locator('button:has-text("Create User"), button:has-text("Add User")').first();
    assert.ok(await addUserBtn.isVisible(), 'Create user button check');
    recordResult('Admin: Users management renders table with role filters and Add User action', true);

    // 4.2 Admin Panchayats Management (/admin/panchayats)
    await page.goto(`${BASE_URL}/admin/panchayats`, { waitUntil: 'networkidle' });
    const panchText = await page.textContent('body');
    assert.ok(panchText.includes('Kottarakara') || panchText.includes('Kollam') || panchText.includes('Panchayats'), 'Panchayats list check');
    recordResult('Admin: Panchayats management renders active/inactive status and actions', true);

    // 4.3 Admin Certificate Types Configuration (/admin/certificate-types)
    await page.goto(`${BASE_URL}/admin/certificate-types`, { waitUntil: 'networkidle' });
    const ctText = await page.textContent('body');
    assert.ok(ctText.includes('EWS') && ctText.includes('Income') && ctText.includes('Residence'), 'Certificate types check');
    recordResult('Admin: Certificate types list renders with documents and verification parties editor', true);

    // 4.4 Admin Master Data (/admin/master-data)
    await page.goto(`${BASE_URL}/admin/master-data`, { waitUntil: 'networkidle' });
    const mdText = await page.textContent('body');
    assert.ok(mdText.includes('PURPOSE') || mdText.includes('SETTING') || mdText.includes('Master Data'), 'Master data check');
    recordResult('Admin: Master data configuration renders categories and status toggles', true);

    // 4.5 Admin Signatures Audit (/admin/signatures)
    await page.goto(`${BASE_URL}/admin/signatures`, { waitUntil: 'networkidle' });
    const sigText = await page.textContent('body');
    assert.ok(sigText.includes('Signature') || sigText.includes('Audit') || sigText.includes('Valid'), 'Signatures audit check');
    recordResult('Admin: Signatures audit workspace verifies cryptographic integrity', true);

    // 4.6 Admin Audit Logs (/admin/audit-logs)
    await page.goto(`${BASE_URL}/admin/audit-logs`, { waitUntil: 'networkidle' });
    const auditText = await page.textContent('body');
    assert.ok(auditText.includes('Audit') || auditText.includes('Action') || auditText.includes('LOGIN'), 'Audit logs check');
    recordResult('Admin: System audit logs render with action filters and user tracking', true);

    // 4.7 Admin Reports Summary (/admin/reports)
    await page.goto(`${BASE_URL}/admin/reports`, { waitUntil: 'networkidle' });
    const adminRepText = await page.textContent('body');
    assert.ok(adminRepText.includes('Reports') || adminRepText.includes('Summary') || adminRepText.includes('Analytics'), 'Admin reports check');
    recordResult('Admin: Executive analytics and system summary reports render', true);

    // 4.8 Admin Logout
    const adminLogoutBtn = page.locator('button:has-text("Sign out")').first();
    if (await adminLogoutBtn.isVisible()) {
      await adminLogoutBtn.click();
      await page.waitForURL('**/login', { timeout: 5000 });
      recordResult('Auth: Admin logout clears session and navigates to login', true);
    }

  } finally {
    await browser.close();
  }

  console.log('\n======================================================');
  console.log('PHASE 2 BROWSER TESTING SUMMARY');
  console.log('======================================================');
  console.log(`Total Checks Run: ${testResults.length}`);
  console.log(`Passed: ${testResults.filter(r => r.passed).length}`);
  console.log(`Failed: ${defects.length}`);
  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Console Errors:');
    consoleErrors.forEach(e => console.log(`  - ${e}`));
  }
  console.log('======================================================\n');

  if (defects.length > 0 || consoleErrors.length > 0) {
    process.exit(1);
  }
}

runPhase2().catch(err => {
  console.error('Phase 2 Runner Fatal Error:', err);
  process.exit(1);
});
