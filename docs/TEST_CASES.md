# Comprehensive Test Cases & Acceptance Matrix

The following table records 45 verified test scenarios covering all user roles, workflows, cryptographic operations, edge cases, and security boundaries.

| Test ID | Module | Scenario Description | Execution Steps | Expected Result | Status |
|---|---|---|---|---|---|
| **TC01** | Auth | Admin Login Success | Enter `admin`, `Admin@123`, choose "Official Login", click Sign In | Redirects to `/admin`; Admin JWT issued; Header displays Admin pill | **Pass** |
| **TC02** | Auth | Officer Login Success | Enter `officer.kottarakara`, `Officer@123`, "Official Login" | Redirects to `/officer`; Officer dashboard loads with KTR panchayat metrics | **Pass** |
| **TC03** | Auth | Citizen Login Success | Enter `9876500001`, `Citizen@123`, choose "Citizen Login" | Redirects to `/citizen`; Citizen dashboard displays Akhil's applications | **Pass** |
| **TC04** | Auth | Invalid Password Rejection | Enter `admin` with wrong password `BadPass123` | Returns 401; Toast error "Invalid credentials" displayed | **Pass** |
| **TC05** | Auth | Official Tab Isolation | Officer attempts login on Citizen tab | Returns 403; Error alert: "Please use the correct login tab" | **Pass** |
| **TC06** | Auth | Citizen Tab Isolation | Citizen attempts login on Official tab | Returns 403; Error alert: "Please use the correct login tab" | **Pass** |
| **TC07** | Auth | Deactivated User Login | Admin deactivates officer; officer attempts login | Returns 403; Error alert: "Your account is inactive" | **Pass** |
| **TC08** | Citizen | Self-Registration Success | Fill registration form with valid 10-digit mobile, 12-digit Aadhaar, choose KTR | Returns 201; Automatically authenticates and redirects to Citizen Dashboard | **Pass** |
| **TC09** | Citizen | Duplicate Mobile Prevention | Register citizen with existing mobile `9876500001` | Returns 409 Conflict; Form highlights "Already registered" | **Pass** |
| **TC10** | Citizen | Duplicate Aadhaar Prevention | Register citizen with existing Aadhaar number | Returns 409 Conflict; Aadhaar field displays error | **Pass** |
| **TC11** | Citizen | Password Complexity Check | Register with simple password `password` | Client & server validation error: requires upper, lower, and digit | **Pass** |
| **TC12** | Application | Wizard Step Navigation | Fill Step 1, click Continue -> Step 2 -> Step 3 -> Step 4 | Stepper updates dynamically; form data is preserved across steps | **Pass** |
| **TC13** | Application | Missing Mandatory Documents | Attempt to submit Residence application without Ration Card | Returns 400; Form displays "Missing mandatory document: RATION_CARD" | **Pass** |
| **TC14** | Application | Oversized Document Rejection | Upload file greater than 5 MB | Multer rejects upload; Error toast: "File size exceeds 5 MB" | **Pass** |
| **TC15** | Application | Unsupported File Extension | Upload file with `.exe` or `.txt` extension | Multer rejects file; Error: "Only PDF, JPG, and PNG allowed" | **Pass** |
| **TC16** | Application | Zero External Requests Flow | Submit Residence Certificate (no external parties) | Status `SUBMITTED`; 0 verification requests generated | **Pass** |
| **TC17** | Application | Cross-Panchayat Request Routing | Submit EWS with Father in KLM and Mother in ANC | Status `PENDING_EXTERNAL`; 2 verification requests created | **Pass** |
| **TC18** | Application | Timeline Initialization | Inspect application details immediately after submission | Timeline contains "Application Submitted" and "Verification Request Sent" | **Pass** |
| **TC19** | Verification | Verifying Officer Scoping | Officer Kollam views `/officer/incoming` | Sees father verification request; cannot see mother's request (Anchal) | **Pass** |
| **TC20** | Verification | Request Detail Privacy | Officer Kollam opens incoming request details | Sees Father's details and Father ID only; cannot see applicant full app | **Pass** |
| **TC21** | Verification | Third Panchayat Scoping | Officer Kadakkal attempts `GET /api/verification-requests/:id` (KTR->KLM) | Returns 404 Not Found (data isolation without existence leak) | **Pass** |
| **TC22** | Verification | Foreign Document Access | Officer Kadakkal attempts to stream document of KTR application | Returns 404 Not Found | **Pass** |
| **TC23** | Signing | Wrong Signing Password | Officer Kollam submits approval with incorrect login password | Returns 401; "Incorrect password. Cannot sign"; nothing saved | **Pass** |
| **TC24** | Signing | Reject Without Remarks | Officer selects "REJECTED" and leaves remarks empty | Returns 400; "Remarks are mandatory when rejecting" | **Pass** |
| **TC25** | Signing | Successful Digital Signing | Officer enters correct password and clicks Approve | Returns 200; RSA-2048 digital signature generated and saved | **Pass** |
| **TC26** | Signing | Double Response Prevention | Officer attempts to respond again to answered request | Returns 409 Conflict: "Request is already answered or cancelled" | **Pass** |
| **TC27** | Crypto | Signature Verification Panel | Home officer opens application after response is signed | Green badge: "Digitally signed by Sreeja Menon (KLM) — Signature Valid" | **Pass** |
| **TC28** | Crypto | DB Tampering Detection | Update `response_remarks` in MySQL directly for signed request | Signature check instantly flags `valid: false (tampering detected)` | **Pass** |
| **TC29** | Crypto | Block Approval on Tamper | Home officer attempts to approve application with tampered request | Blocked with 400: "Cannot approve: Signature on CP-2026-0001 is INVALID" | **Pass** |
| **TC30** | Crypto | Tamper Restoration | Restore original `response_remarks` in MySQL | Signature check immediately evaluates to `valid: true` | **Pass** |
| **TC31** | Workflow | Document Verification | Home officer verifies applicant Aadhaar & Ration Card | Document status updates to `VERIFIED`; timeline records reviewer name | **Pass** |
| **TC32** | Workflow | Document Rejection Reason | Home officer rejects document without remarks | Returns 400: "Remarks are required when rejecting a document" | **Pass** |
| **TC33** | Workflow | External Document Isolation | Home officer views document tied to external party | System marks "Verified by external panchayat (no local action required)" | **Pass** |
| **TC34** | Workflow | Block Approval on Pending | Home officer attempts approval while 1 external request is pending | Blocked with 400: "Waiting for 1 verification request(s)" | **Pass** |
| **TC35** | Workflow | State Transition to READY | Last external request is answered and signed | Application status transitions automatically to `READY_FOR_DECISION` | **Pass** |
| **TC36** | Workflow | Home Officer Approval | Home officer approves application with remarks | Application status transitions to `APPROVED`; email sent to citizen | **Pass** |
| **TC37** | Issuance | Certificate PDF Generation | Home officer clicks "Issue Certificate" | PDF generated on disk; application status `CERTIFICATE_ISSUED` | **Pass** |
| **TC38** | Issuance | PDF Header & Magic Bytes | Inspect generated file on disk | Starts with `%PDF`; contains official blue header band & Kerala seal | **Pass** |
| **TC39** | Issuance | Embedded Audit Table | View PDF page 1 verification section | Contains external verification table with signers, dates & fingerprints | **Pass** |
| **TC40** | Certificate | Citizen PDF Download | Applicant citizen downloads certificate from `/citizen/certificates` | Returns HTTP 200 with `X-Integrity: ok` and complete PDF stream | **Pass** |
| **TC41** | Certificate | Foreign Citizen Scoping | Citizen Akhil attempts to download Citizen George's certificate | Returns 404 Not Found | **Pass** |
| **TC42** | Public | Valid Public QR Check | Scan QR code URL or enter verification code on public portal | Returns "Valid Certificate", holder name, issuing panchayat, dates | **Pass** |
| **TC43** | Public | Nonexistent Code Check | Enter fictitious code `KL-XXX-2026-000000` | Returns "Certificate Not Found (NOT_FOUND)" | **Pass** |
| **TC44** | Overdue | Reminder 24h Cooldown | Requesting officer clicks "Send Reminder" within 24 hours | Returns 400: "Reminder cooldown active. You can send after 24 hour(s)" | **Pass** |
| **TC45** | Overdue | Overdue Auto-Highlight | View incoming requests where statutory deadline (`due_at`) has passed | Request highlighted in soft red; red `OVERDUE` badge shown; sorted top | **Pass** |
