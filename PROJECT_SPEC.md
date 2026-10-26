# PROJECT_SPEC.md — Connected Panchayat (source of truth)

If any later prompt, your own idea, or common practice conflicts with this file, THIS FILE WINS. Never rename tables, columns, endpoints, routes, statuses or env variables defined here.

## 1. What the project is

Kerala has many Panchayats (local governments). Each Panchayat holds records about its own residents. To issue certificates (EWS, Income, etc.) a Panchayat sometimes needs to confirm facts that only ANOTHER Panchayat holds (for example, the father lives in Panchayat B, the mother in Panchayat C, while the applicant lives in Panchayat A).

CORE IDEA: Panchayat A sends a digital verification request to Panchayat B. An officer of B checks it MANUALLY (outside the system, from their own records), then records a simple decision (APPROVED or REJECTED + remarks) and DIGITALLY SIGNS it with real cryptography (RSA-2048 + SHA-256). A receives the signed response, the system verifies the signature, and A's officer then approves the application and issues the certificate. The citizen gets an email and logs in to download the certificate PDF.

The system returns only YES/NO decisions with remarks. It never returns raw data from B's records.

This is an MVP for a college project: every feature must really work end to end with a clean UI, but it is NOT production/deployment ready (no Docker, no cloud, no real SMS, no Aadhaar/DSC integration, no Digital Seva login).

## 2. Tech stack (fixed, do not substitute)

- Language: JavaScript only (NO TypeScript).
- Backend: Node.js 18+, Express 4, CommonJS modules (require / module.exports). Port 5000.
- Database: ONE MySQL 8 database named `connected_panchayat`. Raw SQL with `mysql2/promise` pool. NO ORM. Always parameterised queries. Use transactions (getConnection / beginTransaction) for multi-table writes.
- Auth: JWT (jsonwebtoken, 8h expiry) + bcryptjs. Role-based access control (RBAC) middleware.
- Validation: zod.
- Uploads: multer (disk storage). Files: pdf, jpg, jpeg, png, max 5 MB each.
- Email: nodemailer (SMTP configurable; falls back to console-log mode if SMTP_HOST is empty).
- PDF: pdfkit. QR: qrcode.
- Crypto: Node built-in `crypto` module ONLY (no external crypto library).
- Backend extras: cors, helmet, morgan, dotenv. Dev: nodemon.
- Frontend: React 18 + Vite, React Router v6, Tailwind CSS v3 (install `tailwindcss@3`, postcss, autoprefixer), axios, lucide-react (icons), react-hot-toast, recharts, date-fns, @fontsource/inter. Port 5173. Vite dev proxy: `/api` -> http://localhost:5000.
- No Docker. No external image URLs or CDN (must work offline): illustrations are inline SVG / CSS gradients.
- OS: Windows 10/11 friendly (no bash-only scripts; use node scripts and npm scripts).

## 3. Folder structure (create exactly this)

```
connected-panchayat/
  PROJECT_SPEC.md
  README.md
  package.json                 (root: scripts "dev", "install:all", "db:reset" using concurrently)
  .gitignore
  backend/
    package.json
    .env.example   .env        (.env is a copy of .env.example)
    sql/schema.sql
    scripts/setupDb.js         (npm run db:setup)
    scripts/seed.js            (npm run db:seed)
    uploads/documents/         (gitignored, keep .gitkeep)
    storage/certificates/      (gitignored, keep .gitkeep)
    src/
      server.js                (starts app)
      app.js                   (express app, middleware, routes, error handler)
      config/env.js  config/db.js
      middleware/auth.js       (authenticate, authorize(...roles))
      middleware/upload.js  middleware/validate.js  middleware/errorHandler.js
      routes/*.routes.js       (one file per module)
      controllers/*.controller.js
      services/crypto.service.js  email.service.js  notification.service.js
               audit.service.js  sequence.service.js  application.service.js
               certificate.service.js  verification.service.js
      utils/asyncHandler.js  utils/apiResponse.js  utils/dates.js
  frontend/
    package.json  vite.config.js  tailwind.config.js  postcss.config.js  index.html
    src/
      main.jsx  App.jsx  index.css
      api/axios.js  api/*.js   (small api modules per area)
      context/AuthContext.jsx
      hooks/*.js
      components/ui/*          (design-system components, see section 11)
      components/layout/*      (PublicLayout, CitizenLayout, OfficerLayout, AdminLayout, Sidebar, Topbar, NotificationBell)
      components/common/*      (StatusBadge, SignaturePanel, Timeline, DocumentList, etc.)
      pages/public/*  pages/citizen/*  pages/officer/*  pages/admin/*
      utils/*.js               (format, constants)
```

## 4. Roles and permissions

Three roles stored in table `roles`: CITIZEN, OFFICER, ADMIN.

- CITIZEN: registers himself/herself; belongs to ONE home panchayat (chosen at registration). Applies for certificates, uploads documents, tracks status, downloads issued certificates. Sees only their own data.
- OFFICER: belongs to exactly ONE panchayat. The same role acts as "Home Panchayat officer" (for applications of their own panchayat's citizens) and as "Other Panchayat officer" (for verification requests received from other panchayats). Officers are created ONLY by the ADMIN (no self-registration). Each officer has an RSA key pair created at creation time.
- ADMIN: manages users, panchayats, certificate types, master data, sees reports, audit logs and the signature integrity audit. ADMIN cannot approve/reject applications or sign anything, and cannot open uploaded documents.

Data isolation rules (enforce in SQL WHERE clauses, not only in the UI):
- Citizen: only rows where application.citizen_id = their citizen_id.
- Officer as home officer: only applications where home_panchayat_id = their panchayat_id.
- Officer as verifying officer: only verification_requests where verifying_panchayat_id = their panchayat_id (incoming) or requesting_panchayat_id = their panchayat_id (outgoing). A verifying officer must NEVER be able to open the full application; they only see the request detail (applicant name, subject party details, purpose, and ONLY the documents whose related_to equals the request's subject_party for that application).
- Accessing something you are not allowed to see returns 404 (not 403) to avoid leaking existence.

## 5. Core workflow (follow exactly)

1. Citizen registers (picks home panchayat) and logs in.
2. Citizen opens "Apply", picks a certificate type, and completes 4 steps: (1) Applicant Details, (2) Family & Property Details, (3) Document Upload, (4) Review & Submit.
3. In step 2, for every "verification party" required by that certificate type (see section 8: FATHER, MOTHER, PROPERTY) the citizen enters the party's details AND chooses "Panchayat where this person's/property's records are held" from a dropdown of all active panchayats.
4. On submit (single transaction):
   - application row is created with status SUBMITTED; application_no generated.
   - for each party: if party.panchayat_id == application.home_panchayat_id -> verification_required = 0 (home officer checks manually, no request). Otherwise verification_required = 1 and ONE verification_request row is created (status PENDING) to that panchayat. Two parties in the same other panchayat still produce two separate requests.
   - if at least one request was created, application.status = PENDING_EXTERNAL.
   - timeline events, in-app notifications and emails to the active officers of each verifying panchayat ("new verification request"), and an in-app notification to home officers ("new application").
5. Home officer (A) opens the application, verifies each applicant document (VERIFIED / REJECTED with remarks). Documents related to an externally verified party are NOT verified by the home officer (the other panchayat covers them).
6. Officer of B sees the request under "Incoming Requests", checks manually, then clicks Approve or Reject, enters remarks (mandatory on reject), re-enters their login password, and the system signs a canonical JSON payload with B-officer's private key (section 6). The signed response is stored on the same verification_requests row.
7. A is notified (in-app + email). When no request of the application is PENDING any more, the application status becomes READY_FOR_DECISION.
8. A's officer sees each response with a signature panel ("Digitally signed by ... Signature valid"). The system verifies the signature on every view. Home officer can then Approve or Reject the application (rules in section 13). Approve -> APPROVED. Then "Issue Certificate" -> certificate PDF with QR code is generated -> application status CERTIFICATE_ISSUED -> email to citizen: "Your certificate is ready. Log in to Connected Panchayat and download it from My Certificates."
9. Citizen logs in again and downloads the PDF. Anyone can verify a certificate on the public page /verify/:code (QR code points there).
10. Overdue logic: each request gets due_at = request_date + OVERDUE_DAYS (master_data SETTING / OVERDUE_DAYS, default 3). A PENDING request past due_at is "overdue" (computed, not stored). Requesting officers can send a reminder (cooldown from master_data SETTING / REMINDER_COOLDOWN_HOURS, default 24).

## 6. Digital signature design (REAL cryptography)

- Algorithm: RSA-2048, signature scheme RSA-SHA256 (PKCS#1 v1.5) using Node `crypto`.
- Key pair per OFFICER, generated when the officer is created (admin creates user, or seed script): `crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })`.
- Storage in table panchayat_officers: `public_key` (PEM), `private_key_encrypted`, `key_fingerprint` (SHA-256 hex of the public key DER bytes), `key_created_at`.
- The private key is encrypted at rest with AES-256-GCM. Key = `crypto.scryptSync(process.env.KEY_ENCRYPTION_SECRET, 'connected-panchayat-key-salt', 32)`. Stored string format: `ivBase64.authTagBase64.cipherBase64`.
- Signing happens ONLY inside POST /api/verification-requests/:id/respond. The officer must re-send their login password in the body; the server verifies it with bcrypt BEFORE decrypting the private key and signing. Wrong password -> 401 "Incorrect password".
- Signed payload (build with a function `buildSignaturePayload()` that creates the object with EXACTLY this key order, then `JSON.stringify` it with no spaces and store that exact string in verification_requests.payload_json):
```
{
  "version": 1,
  "request_no": "CP-2026-0001",
  "verification_id": 12,
  "application_id": 7,
  "application_no": "EWS-2026-0001",
  "requesting_panchayat": { "id": 2, "code": "KLM", "name": "Kollam GP" },
  "verifying_panchayat":  { "id": 1, "code": "KTR", "name": "Kottarakara GP" },
  "subject_party": "FATHER",
  "subject_name": "Sasidharan K",
  "decision": "APPROVED",
  "remarks": "Verified from panchayat register.",
  "signed_by": { "officer_id": 1, "name": "Deepak Kunjumon", "designation": "Panchayat Secretary", "employee_id": "EMP-KTR-001" },
  "signed_at": "2026-10-21T09:30:00.000Z"
}
```
- Stored together: payload_json, payload_hash (SHA-256 hex of payload_json), signature (base64), signature_algorithm = 'RSA-SHA256', signer_public_key (PEM copy at signing time), signer_key_fingerprint, signed_at, responded_by_officer_id.
- Verification (function `verifyRequestSignature(row)` in crypto.service.js) must return `{ valid, hashMatches, signatureMatches, fieldsMatch, signer, fingerprint, reason }`:
  1. sha256(payload_json) === payload_hash
  2. crypto.verify RSA-SHA256 of payload_json with signer_public_key and signature
  3. parsed payload fields (request_no, verification_id, application_id, decision, remarks, subject_name, panchayat ids) equal the CURRENT database row values (this detects tampering with the table after signing)
  valid = all three true.
- BOTH approvals and rejections are signed.
- The final certificate is NOT cryptographically signed; it carries a verification code, QR code, and a SHA-256 hash of the PDF file stored in the DB, and the PDF lists the signed verifications (panchayat, officer, decision, signed time, fingerprint short form).

## 7. Database schema (create EXACTLY this in backend/sql/schema.sql)

Use MySQL 8, InnoDB, utf8mb4. The file must: `CREATE DATABASE IF NOT EXISTS connected_panchayat ...; USE connected_panchayat;` then `SET FOREIGN_KEY_CHECKS=0;` drop all tables if exist, `SET FOREIGN_KEY_CHECKS=1;`, then create tables in this order.

```sql
CREATE TABLE roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255)
);

CREATE TABLE panchayats (
  panchayat_id INT AUTO_INCREMENT PRIMARY KEY,
  panchayat_name VARCHAR(100) NOT NULL,
  panchayat_code VARCHAR(10) NOT NULL UNIQUE,
  district VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL DEFAULT 'Kerala',
  address TEXT,
  contact_no VARCHAR(15),
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  mobile VARCHAR(15) NOT NULL UNIQUE,
  role_id INT NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

CREATE TABLE citizens (
  citizen_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender ENUM('MALE','FEMALE','OTHER') NOT NULL,
  aadhaar_no CHAR(12) NOT NULL,
  mobile VARCHAR(15) NOT NULL,
  email VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  panchayat_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (panchayat_id) REFERENCES panchayats(panchayat_id)
);

CREATE TABLE panchayat_officers (
  officer_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  panchayat_id INT NOT NULL,
  employee_id VARCHAR(50) NOT NULL UNIQUE,
  designation VARCHAR(100) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  mobile VARCHAR(15) NOT NULL,
  email VARCHAR(100) NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  public_key TEXT NOT NULL,
  private_key_encrypted TEXT NOT NULL,
  key_fingerprint CHAR(64) NOT NULL,
  key_created_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (panchayat_id) REFERENCES panchayats(panchayat_id)
);

CREATE TABLE certificate_types (
  certificate_type_id INT AUTO_INCREMENT PRIMARY KEY,
  certificate_code VARCHAR(20) NOT NULL UNIQUE,
  certificate_name VARCHAR(100) NOT NULL,
  description TEXT,
  required_documents JSON NOT NULL,
  verification_parties JSON NOT NULL,
  validity_months INT NOT NULL DEFAULT 12,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE applications (
  application_id INT AUTO_INCREMENT PRIMARY KEY,
  application_no VARCHAR(30) NOT NULL UNIQUE,
  citizen_id INT NOT NULL,
  certificate_type_id INT NOT NULL,
  home_panchayat_id INT NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  declared_family_income DECIMAL(12,2) NOT NULL DEFAULT 0,
  land_holding_cents DECIMAL(10,2) NOT NULL DEFAULT 0,
  house_area_sqft DECIMAL(10,2) NOT NULL DEFAULT 0,
  other_property_details TEXT,
  status ENUM('SUBMITTED','PENDING_EXTERNAL','READY_FOR_DECISION','APPROVED','REJECTED','CERTIFICATE_ISSUED') NOT NULL DEFAULT 'SUBMITTED',
  remarks TEXT,
  decided_by_officer_id INT NULL,
  decided_at DATETIME NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (citizen_id) REFERENCES citizens(citizen_id),
  FOREIGN KEY (certificate_type_id) REFERENCES certificate_types(certificate_type_id),
  FOREIGN KEY (home_panchayat_id) REFERENCES panchayats(panchayat_id),
  FOREIGN KEY (decided_by_officer_id) REFERENCES panchayat_officers(officer_id),
  INDEX idx_app_home_status (home_panchayat_id, status),
  INDEX idx_app_citizen (citizen_id)
);

CREATE TABLE application_parties (
  party_id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  party_type ENUM('FATHER','MOTHER','PROPERTY') NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  aadhaar_no CHAR(12) NULL,
  occupation VARCHAR(100),
  annual_income DECIMAL(12,2) NOT NULL DEFAULT 0,
  property_details TEXT,
  panchayat_id INT NOT NULL,
  verification_required TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE,
  FOREIGN KEY (panchayat_id) REFERENCES panchayats(panchayat_id),
  UNIQUE KEY uq_app_party (application_id, party_type)
);

CREATE TABLE application_documents (
  document_id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  document_name VARCHAR(100) NOT NULL,
  related_to ENUM('APPLICANT','FATHER','MOTHER','PROPERTY','OTHER') NOT NULL DEFAULT 'APPLICANT',
  original_file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verification_status ENUM('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
  verification_remarks TEXT,
  verified_by_officer_id INT NULL,
  verified_at DATETIME NULL,
  FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE,
  FOREIGN KEY (verified_by_officer_id) REFERENCES panchayat_officers(officer_id)
);

CREATE TABLE verification_requests (
  verification_id INT AUTO_INCREMENT PRIMARY KEY,
  request_no VARCHAR(30) NOT NULL UNIQUE,
  application_id INT NOT NULL,
  party_id INT NULL,
  requesting_panchayat_id INT NOT NULL,
  verifying_panchayat_id INT NOT NULL,
  requested_by_user_id INT NULL,
  subject_party ENUM('FATHER','MOTHER','PROPERTY','OTHER') NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  subject_aadhaar CHAR(12) NULL,
  subject_details TEXT,
  purpose VARCHAR(255) NOT NULL,
  request_details TEXT,
  status ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  request_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at DATETIME NOT NULL,
  response_date DATETIME NULL,
  responded_by_officer_id INT NULL,
  response_remarks TEXT NULL,
  reminder_count INT NOT NULL DEFAULT 0,
  last_reminder_at DATETIME NULL,
  payload_json LONGTEXT NULL,
  payload_hash CHAR(64) NULL,
  signature TEXT NULL,
  signature_algorithm VARCHAR(30) NULL,
  signer_public_key TEXT NULL,
  signer_key_fingerprint CHAR(64) NULL,
  signed_at DATETIME NULL,
  FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE,
  FOREIGN KEY (party_id) REFERENCES application_parties(party_id) ON DELETE SET NULL,
  FOREIGN KEY (requesting_panchayat_id) REFERENCES panchayats(panchayat_id),
  FOREIGN KEY (verifying_panchayat_id) REFERENCES panchayats(panchayat_id),
  FOREIGN KEY (requested_by_user_id) REFERENCES users(user_id),
  FOREIGN KEY (responded_by_officer_id) REFERENCES panchayat_officers(officer_id),
  INDEX idx_vr_verifying (verifying_panchayat_id, status),
  INDEX idx_vr_requesting (requesting_panchayat_id, status),
  INDEX idx_vr_application (application_id)
);

CREATE TABLE application_timeline (
  event_id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  actor_user_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(user_id),
  INDEX idx_tl_app (application_id, created_at)
);

CREATE TABLE certificates (
  certificate_id INT AUTO_INCREMENT PRIMARY KEY,
  certificate_no VARCHAR(40) NOT NULL UNIQUE,
  application_id INT NOT NULL UNIQUE,
  certificate_type_id INT NOT NULL,
  citizen_id INT NOT NULL,
  issued_by_officer_id INT NOT NULL,
  issuing_panchayat_id INT NOT NULL,
  issue_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  certificate_file VARCHAR(500) NOT NULL,
  verification_code VARCHAR(20) NOT NULL UNIQUE,
  certificate_hash CHAR(64) NOT NULL,
  status ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(application_id),
  FOREIGN KEY (certificate_type_id) REFERENCES certificate_types(certificate_type_id),
  FOREIGN KEY (citizen_id) REFERENCES citizens(citizen_id),
  FOREIGN KEY (issued_by_officer_id) REFERENCES panchayat_officers(officer_id),
  FOREIGN KEY (issuing_panchayat_id) REFERENCES panchayats(panchayat_id)
);

CREATE TABLE certificate_verification_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  certificate_id INT NULL,
  verification_code VARCHAR(30) NOT NULL,
  verified_by_user_id INT NULL,
  verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  method ENUM('QR','CODE') NOT NULL DEFAULT 'CODE',
  result ENUM('VALID','INVALID','EXPIRED','NOT_FOUND') NOT NULL,
  ip_address VARCHAR(45)
);

CREATE TABLE notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  application_id INT NULL,
  verification_id INT NULL,
  notification_type VARCHAR(40) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  email_to VARCHAR(100) NULL,
  email_status ENUM('NOT_REQUIRED','SENT','FAILED','LOGGED') NOT NULL DEFAULT 'NOT_REQUIRED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  INDEX idx_notif_user (user_id, is_read, created_at)
);

CREATE TABLE audit_logs (
  log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id INT NULL,
  ip_address VARCHAR(45),
  description TEXT,
  action_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_time (action_time),
  INDEX idx_audit_user (user_id)
);

CREATE TABLE master_data (
  master_id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  code VARCHAR(50) NOT NULL,
  value VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  UNIQUE KEY uq_master (category, code)
);

CREATE TABLE sequences (
  seq_key VARCHAR(60) PRIMARY KEY,
  last_value INT NOT NULL DEFAULT 0
);
```

Sequence numbers (sequence.service.js, run INSIDE the caller's transaction using `INSERT INTO sequences (seq_key,last_value) VALUES (?,1) ON DUPLICATE KEY UPDATE last_value = LAST_INSERT_ID(last_value+1)` then read LAST_INSERT_ID() / insertId logic carefully so the first value is 1):
- application_no = `{CERT_CODE}-{YYYY}-{0001}`  e.g. EWS-2026-0001   (seq_key `APP-{CERT_CODE}-{YYYY}`)
- request_no     = `CP-{YYYY}-{0001}`          e.g. CP-2026-0001    (seq_key `REQ-{YYYY}`)
- certificate_no = `CERT-{PANCHAYAT_CODE}-{YYYY}-{00001}`           (seq_key `CERT-{PANCHAYAT_CODE}-{YYYY}`)
- verification_code = 12 random uppercase letters/digits formatted `XXXX-XXXX-XXXX` (crypto.randomBytes, unique).

## 8. Seed data (scripts/seed.js, must be re-runnable: it clears data first and re-inserts)

roles: CITIZEN, OFFICER, ADMIN.

Panchayats (district Kollam, state Kerala):
KTR Kottarakara GP | KLM Kollam GP | KDK Kadakkal GP | ANC Anchal GP | CHD Chadayamangalam GP | PTN Pathanapuram GP (give each an address and contact number).

Accounts (all passwords listed here):
- ADMIN: username `admin`, password `Admin@123`, email admin@connectedpanchayat.test, mobile 9000000001.
- OFFICERS (password `Officer@123`, each with real generated RSA key pair):
  officer.kottarakara — Deepak Kunjumon, Panchayat Secretary, EMP-KTR-001, KTR, mobile 9000000011
  officer2.kottarakara — Meera Nair, Assistant Secretary, EMP-KTR-002, KTR, 9000000012
  officer.kollam — Sreeja Menon, Panchayat Secretary, EMP-KLM-001, KLM, 9000000013
  officer.kadakkal — Rajesh Kumar, Panchayat Secretary, EMP-KDK-001, KDK, 9000000014
  officer.anchal — Fathima Beevi, Panchayat Secretary, EMP-ANC-001, ANC, 9000000015
  officer.chadayamangalam — Anil Varghese, Panchayat Secretary, EMP-CHD-001, CHD, 9000000016
  officer.pathanapuram — Latha Devi, Panchayat Secretary, EMP-PTN-001, PTN, 9000000017
  Emails: `<username>@connectedpanchayat.test`.
- CITIZENS (password `Citizen@123`, username = mobile):
  Akhil K S — mobile 9876500001, home KLM, male, DOB 2002-03-24, address "Kalluvila, Kadayam P.O., Kollam - 691536"
  Anu Thomas — 9876500002, home KTR, female
  Rafiq Khan — 9876500003, home KDK, male
  Emails: akhil@..., anu@..., rafiq@... `@connectedpanchayat.test`. If env DEMO_CITIZEN_EMAIL is set, use it as Akhil's email instead (so the developer can test real email).

Certificate types (code | name | verification_parties | required_documents as JSON array of {type,label,related_to,mandatory}):
1. EWS | EWS Certificate | ["FATHER","MOTHER"] | AADHAAR "Applicant Aadhaar" APPLICANT yes; RATION_CARD "Ration Card" APPLICANT yes; INCOME_PROOF "Income Proof" APPLICANT yes; PROPERTY_TAX "Property / Land Tax Receipt" APPLICANT yes; FATHER_ID "Father's ID Proof" FATHER yes; MOTHER_ID "Mother's ID Proof" MOTHER yes
2. INCOME | Income Certificate | ["FATHER","MOTHER"] | AADHAAR yes; RATION_CARD yes; INCOME_PROOF yes; FATHER_ID no; MOTHER_ID no
3. RESIDENCE | Residence Certificate | [] | AADHAAR yes; RATION_CARD yes; ELECTRICITY_BILL "Electricity / Water Bill" APPLICANT no
4. NATIVITY | Nativity Certificate | ["FATHER"] | AADHAAR yes; SCHOOL_CERT "School / Birth Certificate" APPLICANT yes; FATHER_ID yes
5. FAMILY_MEMBERSHIP | Family Membership Certificate | ["FATHER","MOTHER"] | AADHAAR yes; RATION_CARD yes; FATHER_ID yes; MOTHER_ID yes
6. POSSESSION | Possession Certificate | ["PROPERTY"] | AADHAAR yes; LAND_TAX "Land Tax Receipt" PROPERTY yes; OWNERSHIP_DEED "Ownership / Title Document" PROPERTY no
All validity_months = 12. Give each a short description.

master_data:
- SETTING / OVERDUE_DAYS = 3; SETTING / REMINDER_COOLDOWN_HOURS = 24
- PURPOSE: EDUCATION "Education / Admission", SCHOLARSHIP "Scholarship", EMPLOYMENT "Employment / Job Application", GOVT_SCHEME "Government Scheme", LOAN "Bank Loan", OTHER "Other"
- OCCUPATION: FARMER Farmer, DAILY_WAGE "Daily wage labourer", GOVT_EMP "Government employee", PRIVATE_EMP "Private employee", SELF_EMP "Self-employed", BUSINESS Business, HOMEMAKER Homemaker, RETIRED Retired, UNEMPLOYED Unemployed, OTHER Other

Demo applications (inserted directly with SQL in seed, with timeline events, parties, placeholder PDF documents generated with pdfkit under uploads/documents, and notification rows). Dates are relative to NOW:
(a) Akhil K S, home KLM, EWS, family income 180000, land 12 cents, house 850 sqft, purpose SCHOLARSHIP. Father "Sasidharan K" (Farmer, 120000, property "10 cents land at Kalluvila") panchayat KTR -> verification_required 1; Mother "Sreedevi S" (Homemaker, 0) panchayat KLM -> no request. Request CP-2026-0001 KLM->KTR PENDING, request_date NOW-5 days, due_at = request_date + 3 days (so it is OVERDUE). Application status PENDING_EXTERNAL. Applicant documents VERIFIED except Property tax PENDING.
(b) Anu Thomas, home KTR, EWS. Father "Thomas Mathew" in KLM (request CP-2026-0002 KTR->KLM PENDING, NOW-1 day), Mother "Leela Thomas" in KTR. Status PENDING_EXTERNAL.
(c) Rafiq Khan, home KDK, INCOME certificate. Father "Abdul Khan" in KDK (no request), Mother "Zainaba Khan" in ANC -> request CP-2026-0003 KDK->ANC status APPROVED, remarks "Verified from Anchal panchayat records.", REALLY SIGNED by officer.anchal using crypto.service (so signature verification returns valid), response 2 days ago. All applicant documents VERIFIED. Application status READY_FOR_DECISION.
Sequences table must be updated to match (so new numbers continue after these).

## 9. API contract

Response envelope for every endpoint:
- success: `{ "success": true, "data": <any>, "message": "optional" }`
- error: `{ "success": false, "message": "human readable", "errors": { "field": "msg" } }` with proper HTTP code (400 validation, 401 not logged in, 403 wrong role, 404, 409 conflict, 500).
- paginated lists: `data: { items: [], total, page, limit }` (page default 1, limit default 10, max 100).
- Auth header: `Authorization: Bearer <jwt>`. JWT payload: { user_id, role, panchayat_id, officer_id, citizen_id }.
- Every state-changing endpoint writes an audit_logs row (audit.service.js).
- Dates are returned as ISO strings (UTC). Frontend formats them in the user's local time.

AUTH
- POST /api/auth/register  (public) body {full_name, mobile, email, password, aadhaar_no, date_of_birth, gender, address, panchayat_id}. Creates user (username = mobile) + citizen. Returns {token, user}.
- POST /api/auth/login  (public) body {identifier, password, login_as: "OFFICIAL"|"CITIZEN"}. identifier = username / mobile / email. OFFICIAL accepts OFFICER and ADMIN only; CITIZEN accepts CITIZEN only; wrong tab -> 403 "Please use the correct login tab". Inactive user -> 403. Returns {token, user:{user_id, role, full_name, email, mobile, panchayat_id, panchayat_name, panchayat_code, officer_id, citizen_id, designation}}.
- GET /api/auth/me ; POST /api/auth/change-password {current_password,new_password} ; PUT /api/auth/profile (citizen: email, address only)
Password rule: min 8 chars with upper, lower and digit. Aadhaar: exactly 12 digits. Mobile: 10 digits (Indian, starts 6-9).

REFERENCE / PUBLIC
- GET /api/panchayats/public (public) active panchayats {panchayat_id, panchayat_name, panchayat_code, district}
- GET /api/certificate-types (public) active types
- GET /api/master-data/:category (auth) active items
- GET /api/panchayats/directory (OFFICER, ADMIN) panchayats with their active officers (name, designation, email, mobile)
- GET /api/certificates/verify/:code (public) see section 12

NOTIFICATIONS (auth, own only)
- GET /api/notifications?unread=1&page&limit ; GET /api/notifications/unread-count ; PATCH /api/notifications/:id/read ; POST /api/notifications/read-all

ADMIN (ADMIN only)
- GET /api/admin/users ?role&panchayat_id&status&search&page&limit ; POST /api/admin/users ; PUT /api/admin/users/:id ; PATCH /api/admin/users/:id/status {status} ; POST /api/admin/users/:id/reset-password {new_password}
  Creating role OFFICER requires username,password,full_name,email,mobile,panchayat_id,employee_id,designation and auto-generates the RSA key pair. Admin may create ADMIN and CITIZEN users too.
- GET/POST /api/admin/panchayats ; PUT /api/admin/panchayats/:id ; PATCH /api/admin/panchayats/:id/status
- GET /api/admin/certificate-types ; PUT /api/admin/certificate-types/:id (name, description, validity_months, status, required_documents, verification_parties). No create/delete.
- GET/POST /api/admin/master-data ; PUT /api/admin/master-data/:id ; PATCH /api/admin/master-data/:id/status
- GET /api/admin/audit-logs ?user_id&action&from&to&page&limit
- GET /api/admin/reports/summary ; GET /api/admin/signatures/audit   (Prompt 6)

APPLICATIONS
- POST /api/applications (CITIZEN, multipart/form-data): field `data` = JSON string {certificate_type_id, purpose, declared_family_income, land_holding_cents, house_area_sqft, other_property_details, parties:[{party_type, full_name, aadhaar_no, occupation, annual_income, property_details, panchayat_id}]}, field `fileMeta` = JSON string [{document_type, document_name, related_to}] (same order as files), files = `files` (multiple).
- GET /api/applications ?status&search&page&limit  (CITIZEN own | OFFICER home panchayat | ADMIN all)
- GET /api/applications/:id  returns {application, citizen, certificate_type, parties, documents, requests (each with signature_summary), timeline, certificate, blockers (officer only)}
- GET /api/documents/:id/file  (stream; allowed: owner citizen, home officer, verifying officer ONLY if the document related_to equals subject_party of a request addressed to their panchayat for that application; ADMIN not allowed)
- PATCH /api/applications/:id/documents/:docId/verify (OFFICER home) {status: "VERIFIED"|"REJECTED", remarks}
- POST /api/applications/:id/decision (OFFICER home) {decision: "APPROVE"|"REJECT", remarks}
- POST /api/applications/:id/issue-certificate (OFFICER home)

VERIFICATION REQUESTS (OFFICER; ADMIN read-only on GET)
- GET /api/verification-requests ?direction=incoming|outgoing&status&search&page&limit
- GET /api/verification-requests/counts -> {incoming:{pending,approved,rejected,overdue}, outgoing:{pending,approved,rejected,overdue}}
- GET /api/verification-requests/:id
- POST /api/verification-requests (home officer of the application) {application_id, verifying_panchayat_id, subject_party, subject_name, subject_aadhaar?, subject_details?, purpose?, request_details?}
- POST /api/verification-requests/:id/respond (verifying officer) {decision:"APPROVED"|"REJECTED", remarks, password}
- POST /api/verification-requests/:id/remind (requesting officer) ; POST /api/verification-requests/:id/cancel (requesting officer, only PENDING)
- GET /api/verification-requests/:id/signature-check (requesting or verifying officer, ADMIN) -> verifyRequestSignature() result

CERTIFICATES
- GET /api/certificates (CITIZEN own | OFFICER issued by own panchayat | ADMIN all) ; GET /api/certificates/:id/download (PDF stream; owner / issuing-panchayat officer / ADMIN)

DASHBOARDS / REPORTS (Prompt 6)
- GET /api/dashboard/officer ; GET /api/dashboard/citizen ; GET /api/reports/officer ; GET /api/officer/me/public-key (download PEM)

## 10. Frontend routes

PUBLIC: `/` landing | `/login` | `/register` | `/verify` and `/verify/:code`
CITIZEN (role CITIZEN): `/citizen` dashboard | `/citizen/apply` (choose certificate) | `/citizen/apply/:code` (4-step wizard) | `/citizen/applications` | `/citizen/applications/:id` | `/citizen/certificates` | `/citizen/profile` | `/notifications`
OFFICER (role OFFICER): `/officer` dashboard | `/officer/applications` (sidebar label "Verify & Request"; tabs: Applications, Outgoing Requests) | `/officer/applications/:id` | `/officer/incoming` (sidebar label "Incoming Requests" with unread badge) | `/officer/incoming/:id` | `/officer/certificates` ("Issued Certificates") | `/officer/directory` ("Panchayat Directory") | `/officer/reports` | `/officer/settings` | `/notifications`
ADMIN (role ADMIN): `/admin` dashboard | `/admin/users` | `/admin/panchayats` | `/admin/certificate-types` | `/admin/master-data` | `/admin/reports` | `/admin/signatures` | `/admin/audit-logs` | `/notifications`
Fallback: 404 page. Logged-in user visiting `/login` is redirected to their home. Role guard redirects unauthorised users to their own home. After login: CITIZEN -> /citizen, OFFICER -> /officer, ADMIN -> /admin.

## 11. UI design system ("simple soft UI")

Feel: calm, clean, soft, modern government-service look. Light blue-tinted page background, white rounded cards with very soft shadows, generous spacing, pastel status chips. NO heavy neumorphism, no dark mode, no gradients except the login/landing hero and the officer/admin sidebar.

Tailwind theme tokens (put in tailwind.config.js and use ONLY these):
- fontFamily.sans = ['Inter', ...system]; import '@fontsource/inter/400.css', 500, 600, 700 in main.jsx.
- colors: primary 50 #EFF6FF, 100 #DBEAFE, 500 #3B82F6, 600 #2563EB, 700 #1D4ED8; navy 900 #0B1F4B, navy 800 #12306B; surface #F4F7FB (page bg); ink #0F172A; muted #64748B; line #E2E8F0.
  Status: success bg #DCFCE7 text #15803D | warning bg #FEF3C7 text #B45309 | danger bg #FEE2E2 text #B91C1C | info bg #DBEAFE text #1D4ED8 | neutral bg #F1F5F9 text #475569 | purple bg #EDE9FE text #6D28D9.
- borderRadius: cards `rounded-2xl` (16px) / big panels `rounded-3xl`; controls `rounded-xl` (12px); chips `rounded-full`.
- boxShadow: `soft` = 0 10px 30px -12px rgba(37,99,235,0.18); `soft-sm` = 0 4px 14px -6px rgba(15,23,42,0.10).
- Page background `bg-surface`. Cards: `bg-white rounded-2xl shadow-soft-sm border border-line p-5 md:p-6`.
- Buttons: primary `bg-primary-600 text-white hover:bg-primary-700 rounded-xl px-4 py-2.5 font-medium shadow-soft-sm`, secondary `bg-white border border-line text-ink hover:bg-slate-50`, danger `bg-red-600 text-white`, ghost. Loading state shows a spinner and disables the button. Focus ring `focus:ring-4 focus:ring-primary-100`.
- Inputs: `bg-white border border-line rounded-xl px-3.5 py-2.5 focus:border-primary-500 focus:ring-4 focus:ring-primary-100`, label above (text-sm font-medium), red error text below, required asterisk.
- Sidebar (officer/admin): navy gradient (navy-900 -> navy-800), white text, active item `bg-primary-600 rounded-xl`, icons from lucide-react, user card at the bottom.
- Citizen layout: top navbar (logo, links Home / Apply / Track Application / Contact style, notification bell, user menu) + light left sidebar (New Application, My Applications, Download Certificate, Profile) like the provided mock-ups.
- Status chips (`StatusBadge`): PENDING / PENDING_EXTERNAL / SUBMITTED = warning, READY_FOR_DECISION = purple, APPROVED = success, VERIFIED = success, REJECTED = danger, CERTIFICATE_ISSUED / COMPLETED = info, CANCELLED = neutral, OVERDUE = danger with clock icon. Human-readable labels ("Pending (External)", "Ready for decision", "Certificate issued").
- Required shared UI components in components/ui: Button, Card, Input, Select, Textarea, Checkbox, FileDropzone/FileInput, Modal, ConfirmDialog, Tabs, Table (with empty + loading skeleton), Pagination, Stepper (numbered circles with connecting line), Badge, StatCard (icon in tinted circle, big number, small caption), EmptyState, Spinner, PageHeader (title + subtitle + right-side actions), Tooltip (simple), Alert.
- Every list/detail page needs: loading skeleton, empty state, error state with retry, toast feedback (react-hot-toast, top-right) for every action.
- Responsive: officer/admin tables scroll horizontally on small screens; citizen pages must be usable on a phone width (sidebar collapses to a drawer).
- Brand: logo = lucide `Landmark` icon in a blue rounded square + text "Connected" (bold blue) "Panchayat" (ink). Tagline "Bridging Panchayats • Empowering Citizens". Login headline "One Certificate. Two Panchayats. Seamless." Landing hero "Simplifying Panchayat Services Together". Footer: "© 2026 Connected Panchayat · Kerala · Academic MCA project".
- Hero/illustrations: build with inline SVG (two small panchayat office buildings with a dashed arrow and a cloud/document icon between them) — no external images.
- Document viewing: open PDFs/images by fetching `/api/documents/:id/file` with axios as a blob (token in header) then `URL.createObjectURL` in a new tab or modal preview. Same technique for certificate downloads.

## 12. Certificate rules (Prompt 5)

- PDF (A4, pdfkit): top band with logo text "Connected Panchayat", title = certificate type name, issuing panchayat name, certificate no, issue date, valid until, applicant block (name, DOB, address, Aadhaar masked XXXX XXXX 1234), a statement paragraph specific to the type (e.g. EWS: "This is to certify that ... belongs to the Economically Weaker Section; declared annual family income Rs. ..., land holding ... cents, house area ... sq.ft."), a "Verification summary" table (party, panchayat, officer, decision, signed at, key fingerprint first 16 chars), issuing officer name + designation, QR code (encodes `${FRONTEND_URL}/verify/${verification_code}`), the verification code text, footer "System generated certificate – Academic MCA project demo. Verify at <url>".
- certificate_hash = SHA-256 of the saved PDF file bytes.
- GET /api/certificates/verify/:code (public): log in certificate_verification_logs; returns {valid, status: "VALID"|"EXPIRED"|"REVOKED"|"NOT_FOUND", certificate_no, certificate_name, holder_name, issuing_panchayat, issue_date, valid_until, integrity: {fileHashMatches}}. Holder name only (no Aadhaar/address).

## 13. Business rules

Application status machine: SUBMITTED -> PENDING_EXTERNAL (requests pending) -> READY_FOR_DECISION (no request pending) -> APPROVED -> CERTIFICATE_ISSUED. REJECTED can be reached from SUBMITTED, PENDING_EXTERNAL or READY_FOR_DECISION. No other transitions. Central helper `refreshApplicationStatus(applicationId, conn)` in application.service.js, only for statuses SUBMITTED / PENDING_EXTERNAL / READY_FOR_DECISION: pendingCount>0 -> PENDING_EXTERNAL; else if any non-cancelled request exists -> READY_FOR_DECISION; else SUBMITTED.

Approve-application "blockers" (returned in GET /api/applications/:id for officers; Approve is allowed only when the list is empty):
1. status is PENDING_EXTERNAL -> "Waiting for N verification request(s) from other panchayats"
2. any document that needs home verification is not VERIFIED -> "N document(s) still need verification" (documents related to an externally verified party are excluded)
3. any document is REJECTED -> "A document was rejected"
4. any request REJECTED -> "Request CP-… was rejected by <panchayat>"
5. any APPROVED request whose signature check is not valid -> "Signature on CP-… is INVALID"
6. status not in SUBMITTED / READY_FOR_DECISION -> "Application is already <status>"
Reject-application is allowed from SUBMITTED, PENDING_EXTERNAL, READY_FOR_DECISION; remarks mandatory. Pending requests are set CANCELLED when an application is rejected.

Respond rules: only an ACTIVE officer of the verifying panchayat; request must be PENDING; remarks mandatory when REJECTED (min 5 chars); password re-entry; after success run refreshApplicationStatus, add timeline event "Verified by <Panchayat>" (or "Verification rejected by <Panchayat>"), notify requesting panchayat officers (in-app + email).

Create-request rules (extra manual request by home officer): application must be in SUBMITTED / PENDING_EXTERNAL / READY_FOR_DECISION; verifying panchayat must differ from the home panchayat and have an active officer; creates PENDING request, status -> PENDING_EXTERNAL.

Reminder rules: only requesting-panchayat officers; request PENDING; allowed only if (now > due_at) OR hours since last_reminder_at (or request_date) >= REMINDER_COOLDOWN_HOURS; increments reminder_count, notifies verifying officers (in-app + email), adds timeline event.

Privacy: Aadhaar is shown masked (XXXX XXXX 1234) everywhere EXCEPT on the incoming request detail page for the verifying officer. Citizens see their own Aadhaar masked too.

## 14. Notifications and email

notification.service.js: `notifyUser({ userId, type, title, message, applicationId, verificationId, email: true|false })` inserts an in-app notification and, if email is true, sends an email through email.service.js and stores email_to and email_status (SENT / FAILED / LOGGED). A failing email must NEVER make the API request fail. `notifyPanchayatOfficers(panchayatId, ...)` notifies all ACTIVE officers of a panchayat.
email.service.js: if SMTP_HOST is empty -> console-log mode (print To/Subject/Body in the backend console, status LOGGED). Otherwise real SMTP via nodemailer. HTML email template: simple soft card, blue header with "Connected Panchayat", message, a button linking to FRONTEND_URL.
Emails are sent for: new verification request (to verifying officers), verification response (to requesting officers), reminder (to verifying officers), application rejected (citizen), certificate issued (citizen). All other events are in-app only.

## 15. Coding conventions

- Backend controller functions are wrapped with asyncHandler; business logic that is reused goes into services. Keep each file under ~400 lines (split if larger).
- Use `req.user` set by `authenticate`. `authorize('OFFICER')` etc. for roles.
- zod schemas validate every body/query; return 400 with field errors.
- Never return password_hash, private_key_encrypted in any response.
- Frontend: functional components + hooks only, one axios instance with interceptor (adds token, on 401 logs out). API modules in src/api. No inline hard-coded URLs. Keep pages thin; reusable pieces go to components.
- Comments only where logic is non-obvious. No console.log noise except the email console mode and server start message.
- .env.example keys: PORT=5000, DB_HOST=localhost, DB_PORT=3306, DB_USER=root, DB_PASSWORD=, DB_NAME=connected_panchayat, JWT_SECRET=change-this-jwt-secret, JWT_EXPIRES_IN=8h, KEY_ENCRYPTION_SECRET=change-this-key-secret-32-chars-min, FRONTEND_URL=http://localhost:5173, SMTP_HOST=, SMTP_PORT=587, SMTP_USER=, SMTP_PASS=, MAIL_FROM="Connected Panchayat <no-reply@connectedpanchayat.test>", DEMO_CITIZEN_EMAIL=
- Root npm scripts: `install:all` (install root, backend, frontend), `db:reset` (backend db:setup + db:seed), `dev` (concurrently run backend `npm run dev` and frontend `npm run dev`).

## 16. Explicitly out of scope (do NOT build)

Docker/deployment, real SMS, Aadhaar eSign / DSC tokens, Digital Seva or any SSO login, payments, multi-language, cron/background jobs, citizen re-submission or editing of a submitted application, social login, dark mode, TypeScript, ORM.