# Security Architecture & Cryptographic Specification

## 1. Security Principles

Connected Panchayat follows the **Principle of Least Privilege**, **Defense-in-Depth**, and **Cryptographic Non-Repudiation** to ensure that local administrative autonomy is preserved while cross-panchayat verification remains tamper-evident.

---

## 2. Authentication & Session Management

- **JSON Web Tokens (JWT)**:
  - Tokens are signed with HMAC-SHA256 using `JWT_SECRET` (minimum 32 characters).
  - Expiry is set to **8 hours** to cover a standard administrative workday.
  - Token claims: `{ user_id, role, panchayat_id, officer_id, citizen_id }`.
- **Database Status Enforcement**:
  - Stateless JWTs are augmented with real-time status checks: on sensitive operations, the user's `status` in MySQL is verified. Deactivating an officer (`status = 'INACTIVE'`) immediately revokes access even if their token has not expired.
- **Login Portal Segregation**:
  - The login endpoint mandates a `login_as` discriminator (`OFFICIAL` vs `CITIZEN`). Officers or admins attempting to log in via the citizen tab (or vice-versa) are rejected with `403 Forbidden` to prevent accidental credential misuse across portals.

---

## 3. Role-Based Access Control (RBAC) & Data Isolation

Access controls are enforced in application code and **baked into SQL query `WHERE` clauses** to prevent horizontal and vertical privilege escalation:

| Role | Permitted Access Scopes | Enforced Restrictions |
|---|---|---|
| **CITIZEN** | Can view only applications and certificates where `citizen_id = req.user.citizen_id`. | Cannot access officer dashboards, foreign citizens' records, or verification requests. Receives `404 Not Found` (to prevent leaking existence). |
| **OFFICER** (Home) | Can view and decide on applications where `home_panchayat_id = req.user.panchayat_id`. | Cannot view unassociated external applications. |
| **OFFICER** (Verifying) | Can view verification requests where `verifying_panchayat_id = req.user.panchayat_id`. | **Never receives the full application**. Sees only the specific subject party, purpose, and documents tied directly to that party (`related_to = subject_party`). |
| **ADMIN** | System management, user provisioning, reports, audit logs, and signature integrity audits. | **Forbidden from approving/rejecting applications or signing responses (`403 Forbidden`)**, and cannot view uploaded citizen document files. |

---

## 4. Password Hashing & Key Protection at Rest

1. **User Passwords**:
   - Salted and hashed using `bcryptjs` with a work factor of **10 rounds**.
   - Password policy: Minimum 8 characters, containing at least one uppercase letter, one lowercase letter, and one numeric digit.

2. **Officer Digital Signing Keys**:
   - Each officer account receives a freshly generated **RSA-2048 key pair** upon creation by the administrator.
   - The RSA Public Key is stored in standard PEM format.
   - The RSA Private Key is encrypted at rest using **AES-256-GCM**:
     - Key derivation: `PBKDF2(officer_password, salt, 100,000 iterations, 32 bytes, SHA-512)`.
     - Initialization Vector (IV): 12-byte random cryptographic nonce per officer.
     - Authentication Tag: 16-byte GCM authentication tag stored in the database.
   - **Zero Knowledge on Server**: The server cannot sign documents on behalf of an officer without the officer explicitly providing their login password at the moment of decision.

---

## 5. Digital Signature Flow & Legal Alignment

- **Algorithm**: Standard **RSA-2048 with SHA-256** (compliant with the Indian Information Technology Act, 2000, Section 3).
- **Canonical Payload Normalization**:
  To prevent signature invalidation caused by JSON key reordering or whitespace variance:
  ```json
  {
    "application_no": "EWS-2026-0001",
    "decision": "APPROVED",
    "remarks": "Verified from ward tax register",
    "request_no": "CP-2026-0001",
    "response_date": "2026-10-21T19:00:00.000Z",
    "signer_officer_id": 1,
    "verifying_panchayat_code": "KLM"
  }
  ```
  The payload is serialized with deterministic, alphabetically sorted keys before generating the SHA-256 digest.

---

## 6. Real-Time Tamper Detection

1. **Verification Response Tampering**:
   - Whenever an officer views an application or an admin runs an integrity check, the server:
     1. Re-computes the SHA-256 hash of the canonical fields stored in `verification_requests`.
     2. Compares it against `payload_hash`.
     3. Verifies the RSA digital signature against the stored `signer_public_key`.
   - If an attacker manually modifies `response_remarks` or `decision` in MySQL:
     - `hashMatches` evaluates to `false`.
     - The signature check flags `valid: false (Database record values do not match signed payload values)`.
     - **The application approval endpoint blocks execution immediately**, preventing any tampered verification from being used to issue a certificate.

2. **Physical PDF Certificate Tampering**:
   - When a certificate is issued, the SHA-256 digest of the raw PDF file is saved in `certificates.certificate_hash`.
   - During download (`GET /api/certificates/:id/download`), the file bytes are hashed on-the-fly and compared with the stored hash, returning `X-Integrity: ok` or `X-Integrity: mismatch`.
   - During public QR/code verification, if the file was modified on disk, the system displays `status: TAMPERED`.

---

## 7. Known Limitations (College Project Scope)

While Connected Panchayat implements production-grade cryptography, several infrastructure-level trade-offs were made for academic presentation and local evaluation:
1. **Software Keystores vs. Hardware Security Modules (HSM)**:
   In a production statewide deployment, officer private keys would reside on physical USB cryptographic tokens (FIPS 140-2 Level 2 cryptographic dongles) or an eSign service (like CDAC / NSDL eSign via Aadhaar OTP). In this project, software-encrypted keys (AES-256-GCM) are stored in MySQL.
2. **Single Shared Database**:
   All Panchayats share a single MySQL instance with strict logical scoping (`WHERE` clauses). In an enterprise architecture, each Grama Panchayat would operate an independent microservice with federated API handshakes.
3. **Email Verification vs. OTP SMS**:
   Notifications use email and console logging rather than an expensive telecom SMS gateway.
