const { chromium } = require('playwright');
const assert = require('assert');

const API_BASE = 'http://localhost:5000/api';
const FRONTEND_URL = 'http://localhost:5173';

async function testBackendAuth() {
  console.log('\n--- 1. Testing Backend Auth API for Citizen ---');

  // Login as Citizen Akhil K S
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: '9876500001',
      password: 'Citizen@123',
      login_as: 'CITIZEN'
    })
  });

  const loginData = await loginRes.json();
  console.log('Login Status:', loginRes.status, 'Success:', loginData.success);
  assert.strictEqual(loginRes.status, 200, 'Login HTTP status should be 200');
  assert.strictEqual(loginData.success, true, 'Login response should have success: true');

  const user = loginData.data.user;
  const token = loginData.data.token;
  console.log('User logged in:', {
    user_id: user.user_id,
    full_name: user.full_name,
    gender: user.gender,
    date_of_birth: user.date_of_birth,
    address: user.address,
    panchayat_name: user.panchayat_name,
    aadhaar_masked: user.aadhaar_masked
  });

  assert.ok(user.gender, 'Citizen gender should be present in login response');
  assert.ok(user.date_of_birth, 'Citizen date_of_birth should be present in login response');
  assert.ok(user.address, 'Citizen address should be present in login response');
  assert.ok(user.panchayat_name, 'Citizen panchayat_name should be present in login response');

  // Test /auth/me
  console.log('\n--- 2. Testing /auth/me API ---');
  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const meData = await meRes.json();
  assert.strictEqual(meRes.status, 200);
  assert.ok(meData.data.gender);
  assert.ok(meData.data.date_of_birth);
  assert.ok(meData.data.address);
  console.log('GET /auth/me profile verified successfully.');

  // Test /auth/profile PUT
  console.log('\n--- 3. Testing /auth/profile PUT ---');
  const updatedAddress = 'Kalluvila House, Kadayam P.O., Kollam - 691536';
  const updateRes = await fetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      email: 'akhil.ks@citizen.local',
      address: updatedAddress,
      gender: 'MALE',
      date_of_birth: '2002-03-24'
    })
  });
  const updateData = await updateRes.json();
  console.log('Update Status:', updateRes.status, 'Message:', updateData.message);
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateData.success, true);
  assert.strictEqual(updateData.data.address, updatedAddress);
  console.log('PUT /auth/profile verified successfully.');
}

async function testFrontendBrowser() {
  console.log('\n--- 4. Testing Frontend in Browser with Playwright ---');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (e) {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  }
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to Login Page
    console.log('Navigating to login page...');
    await page.goto(`${FRONTEND_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Click Citizen tab if present
    const citizenTab = page.locator('button:has-text("Citizen Login"), button:has-text("Citizen")').first();
    if (await citizenTab.isVisible()) {
      await citizenTab.click();
    }

    // Fill credentials
    const idInput = page.locator('input[placeholder*="mobile" i], input[type="text"]').first();
    const pwInput = page.locator('input[type="password"]').first();
    await idInput.fill('9876500001');
    await pwInput.fill('Citizen@123');

    // Submit
    const submitBtn = page.locator('button[type="submit"]:has-text("Sign In"), button[type="submit"]:has-text("Login")').first();
    await submitBtn.click();
    await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    console.log('Current URL after login:', page.url());

    // Navigate to Profile page
    console.log('Navigating to /citizen/profile...');
    await page.goto(`${FRONTEND_URL}/citizen/profile`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify Overview Details are NOT "Not specified" or blank
    const pageContent = await page.content();
    console.log('Checking Profile Page elements...');

    const hasGender = pageContent.includes('male') || pageContent.includes('Male') || pageContent.includes('MALE');
    const hasDob = pageContent.includes('2002') || pageContent.includes('Mar') || pageContent.includes('March');
    const hasAddress = pageContent.includes('Kalluvila') || pageContent.includes('Kadayam');

    console.log('Profile Page Verification:', {
      hasGender,
      hasDob,
      hasAddress
    });

    assert.ok(hasGender, 'Profile page must display citizen gender');
    assert.ok(hasDob, 'Profile page must display citizen date of birth');
    assert.ok(hasAddress, 'Profile page must display citizen address');

    // Test form update on profile page
    console.log('Testing profile update via UI...');
    const addressInput = page.locator('textarea[placeholder*="full address" i]');
    await addressInput.fill('Kalluvila, Kadayam P.O., Kollam - 691536');
    const saveBtn = page.locator('button:has-text("Save Profile Changes")');
    await saveBtn.click();

    // Check for success toast
    await page.waitForTimeout(1500);
    const toastSuccess = await page.locator('.go3958317564, div[role="status"], :has-text("Profile details updated successfully")').count();
    console.log('Toast success elements found:', toastSuccess);

    // Navigate to Citizen Apply Wizard
    console.log('Navigating to /citizen/apply/INCOME (Apply Wizard Step 1)...');
    await page.goto(`${FRONTEND_URL}/citizen/apply/INCOME`);
    await page.waitForSelector('text=Applicant Details', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const wizardContent = await page.content();

    // Verify Step 1 does NOT show "N/A • N/A" and does NOT show "—" for address
    const hasNA_NA = wizardContent.includes('N/A • N/A');
    const hasBlankAddr = wizardContent.includes('Registered Address') && wizardContent.includes('mt-0.5">—<');

    console.log('Wizard Step 1 Verification:', {
      contains_NA_NA: hasNA_NA,
      contains_Blank_Address: hasBlankAddr
    });

    assert.strictEqual(hasNA_NA, false, 'Wizard Step 1 must NOT show "N/A • N/A" for Gender / Date of Birth');
    assert.strictEqual(hasBlankAddr, false, 'Wizard Step 1 must NOT show "—" for Registered Address');

    const wizardHasGender = wizardContent.includes('MALE') || wizardContent.includes('Male');
    const wizardHasAddr = wizardContent.includes('Kalluvila');

    console.log('Wizard Applicant Info Check:', {
      wizardHasGender,
      wizardHasAddr
    });

    assert.ok(wizardHasGender, 'Wizard must display citizen Gender');
    assert.ok(wizardHasAddr, 'Wizard must display citizen Registered Address');

    console.log('\n>>> ALL CITIZEN PROFILE AND WIZARD VERIFICATIONS PASSED SUCCESSFULLY! <<<');
  } finally {
    await browser.close();
  }
}

async function run() {
  try {
    await testBackendAuth();
    await testFrontendBrowser();
    console.log('\nVerification completed with zero errors.');
    process.exit(0);
  } catch (err) {
    console.error('\nVerification failed:', err);
    process.exit(1);
  }
}

run();
