# Viva Presentation & Demonstration Script (8-Minute Guide)

This script is designed for an **8-minute live MCA project evaluation and viva**. It guides you through the exact sequence of clicks, accounts, narration, and technical demonstrations.

---

## Pre-Demo Checklist (1 Minute Before Viva)

1. Open PowerShell and run:
   ```powershell
   npm run db:reset
   npm run dev
   ```
2. Open your browser to `http://localhost:5173`.
3. Open a second browser window (or Incognito tab) for the external officer.
4. Have MySQL command line or Workbench ready for the tamper demonstration.

---

## Timeline & Narrative Breakdown

### [00:00 - 01:15] Introduction & The Governance Problem
- **What to say**:
  > *"Good morning, respected examiners. Local self-governments in Kerala maintain demographic and revenue records strictly for their own resident citizens. When a citizen in Kottarakara applies for an Economically Weaker Section (EWS) or Income certificate, facts often span multiple Panchayats—for example, the applicant's father lives in Kollam, and ancestral land is in Anchal.*  
  > *Until now, this required citizens to travel between offices or wait weeks for postal verification.*  
  > *Connected Panchayat solves this by enabling cross-panchayat digital verification requests where officers check local records and digitally sign simple YES/NO decisions with real RSA-2048 cryptography, without exposing sensitive raw citizen records."*
- **What to show**:
  - Show the clean Landing Page at `http://localhost:5173`.
  - Highlight the 4-step process banner: *Apply -> External Verification -> Digital Signing -> Instant Issuance*.

---

### [01:15 - 02:45] Flow 1: Citizen Application & Smart Routing
- **What to do**:
  1. Click **Sign In** -> Switch to **Citizen Login** tab.
  2. Log in as **Anu Thomas** (`9876500002` / `Citizen@123`).
  3. Click **Apply for Certificate** -> Choose **EWS Certificate**.
  4. Step 1 (*Applicant Details*): Form is pre-filled with Anu's profile (Kottarakara Grama Panchayat). Select Purpose: `Higher Education`. Click **Continue**.
  5. Step 2 (*Family & Property*):
     - Enter Father: `Thomas Mathew`, Annual Income: `150000`, Panchayat: Select **Kollam Corporation (KLM)**.
     - Enter Mother: `Leela Thomas`, Panchayat: Select **Kottarakara Grama Panchayat (KTR)**.
  6. Step 3 (*Document Upload*): Show the mandatory document badges. Upload sample PDFs for Aadhaar, Ration Card, Income Proof, Land Tax, and Father ID.
  7. Step 4 (*Review & Submit*): Point out the dynamic warning:  
     *"1 external verification request will be dispatched to Kollam Corporation for Father."*  
     Mother requires no external request because she resides in the home Panchayat.
  8. Click **Submit Application**.
- **What to say**:
  > *"The system automatically compares the party's residence against the applicant's home Panchayat. Local parties are verified internally; external parties generate discrete digital requests with an automated 7-day statutory deadline."*
  - Log out of the Citizen portal.

---

### [02:45 - 04:30] Flow 2: Overdue Requests, Wrong Password Attempt & Digital Signing
- **What to do**:
  1. Go to **Sign In** -> Select **Official Login** tab.
  2. Log in as **Deepak Kunjumon (Kottarakara GP)** (`officer.kottarakara` / `Officer@123`).
  3. Point out the **Officer Dashboard**:
     - 4 StatCards with 30-day SQL numbers.
     - **Current Urgent Request Card**: Highlights an overdue incoming request (`CP-2026-0001` from Kollam GP for Akhil K S).
  4. Navigate to **Incoming Requests**:
     - Point out the red-tinted row and the amber/red `OVERDUE` badge.
  5. Click **Review & Respond** on request `CP-2026-0001`.
  6. Point out data isolation: Deepak can see the applicant's name and Father's details, but **cannot see the full application or unrelated documents**.
  7. **Demonstrate Wrong Password Security**:
     - Select **Approve**.
     - Enter remarks: *"Verified from Ward 7 revenue register"*.
     - In the Password field, deliberately type a wrong password: `WrongPassword123`.
     - Click **Sign & Submit Decision**.
     - Show the error alert: *"Incorrect password. Cannot sign verification response."*
     - Point out: *The server cannot forge a signature; the private key cannot be decrypted without the officer's true password.*
  8. **Demonstrate Real Cryptographic Signing**:
     - Enter the correct password: `Officer@123`.
     - Click **Sign & Submit Decision**.
     - Show the instant success toast. Request status becomes `APPROVED` with real RSA-2048 digital signature.
  9. Log out of Deepak's account.

---

### [04:30 - 06:15] Flow 3: Home Officer Verification & The Live Database Tamper Test
- **What to do**:
  1. Log in as **Sreeja Menon (Kollam Corporation)** (`officer.kollam` / `Officer@123`).
  2. Open **Applications** -> Click on Akhil K S's application (`EWS-2026-0001`).
  3. Show the **Digital Signature Panel**:
     - Green badge: *"Digitally signed by Deepak Kunjumon (KTR) on ... Signature Valid"*.
     - Click to show the SHA-256 Key Fingerprint and Section 3 IT Act compliance.
  4. **The Live Database Tamper Test (Viva Highlight)**:
     - Open MySQL CLI or Workbench and run:
       ```sql
       UPDATE verification_requests 
       SET response_remarks = "Forged altered decision - applicant has 50 acres land" 
       WHERE request_no = 'CP-2026-0001';
       ```
     - Return to the browser and refresh the page.
     - **Show the Examiner**: The signature panel turns bright red:  
       *"Digital Signature INVALID — Database record values do not match signed payload values (tampering detected)"*.
     - Try clicking **Approve Application**: Show that approval is **completely blocked by the system**!
     - Now restore the original remarks in MySQL:
       ```sql
       UPDATE verification_requests 
       SET response_remarks = "Father land holding verified from Kottarakara land register. Meets EWS criteria." 
       WHERE request_no = 'CP-2026-0001';
       ```
     - Refresh the browser: The panel turns green again: *"Signature Valid"*.
- **What to say**:
  > *"Because the digital signature is cryptographically bound to the canonical JSON digest of the decision and remarks, even a direct database modification by a rogue database administrator is detected immediately and prevents illegal certificate issuance."*

---

### [06:15 - 07:15] Flow 4: Document Review, Approval & Certificate Issuance
- **What to do**:
  1. Under **Applicant Documents**, click **Verify** on Akhil's Aadhaar and Ration Card.
  2. Click **Approve Application** -> Enter remarks: *"All local documents and external Kottarakara records verified"*.
  3. Click **Issue Certificate**:
     - The system generates the official A4 PDF, calculates the SHA-256 hash, and issues `CERT-EWS-2026-0001`.
  4. Log out and log in as citizen **Akhil K S** (`9876500001` / `Citizen@123`).
  5. Go to **My Certificates** -> Click **Download PDF**.
  6. Open the downloaded PDF and show:
     - Government of Kerala header band.
     - Clear applicant statement.
     - **External Verification Summary Table**: Lists Kottarakara GP, Deepak Kunjumon, response date, and key fingerprint.
     - Embedded high-resolution **QR Code** and verification code.

---

### [07:15 - 08:00] Flow 5: Public QR Verification & Admin Audit Dashboard
- **What to do**:
  1. Log out. Click **Verify Certificate** on the public navigation bar.
  2. Enter the verification code from the certificate (or copy from the screen).
  3. Click **Verify Authenticity**:
     - Displays green checkmark: *"Valid Certificate"*.
     - Shows holder name, issuing authority, issue date, and validity without leaking sensitive Aadhaar or income numbers.
  4. Log in as **System Admin** (`admin` / `Admin@123`).
  5. Open **Signature Integrity Audit** (`/admin/signatures`):
     - Click **Run Cryptographic Integrity Check**.
     - Shows all platform signatures scanned: *100% Cryptographically Valid*.
- **What to conclude**:
  > *"To conclude, Connected Panchayat demonstrates how local government autonomy and digital efficiency can coexist through real cryptographic non-repudiation. Thank you, and I am now ready for your questions."*
