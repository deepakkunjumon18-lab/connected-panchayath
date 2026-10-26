# REST API Reference — Connected Panchayat

This document provides a comprehensive, verified specification of every endpoint exposed by the Connected Panchayat REST API, organized by functional domain.

Base URL: `http://localhost:5000/api`  
Frontend Dev Proxy: `/api` -> `http://localhost:5000`

---

## 1. Authentication & User Profile (`/api/auth`)

### 1.1 Register Citizen
- **Method & Path**: `POST /api/auth/register`
- **Access**: Public
- **Request Body**:
```json
{
  "full_name": "George Varghese",
  "mobile": "9847099999",
  "email": "george@example.com",
  "password": "Password@123",
  "aadhaar_no": "998877665544",
  "date_of_birth": "1998-06-15",
  "gender": "MALE",
  "address": "Varghese Villa, Ward 4, Kottarakara",
  "panchayat_id": 1
}
```
- **Response** (`201 Created`):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "user_id": 12,
      "role": "CITIZEN",
      "full_name": "George Varghese",
      "email": "george@example.com",
      "mobile": "9847099999",
      "panchayat_id": 1,
      "panchayat_name": "Kottarakara Grama Panchayat",
      "panchayat_code": "KTR",
      "citizen_id": 5
    }
  },
  "message": "Registration successful"
}
```

### 1.2 Login
- **Method & Path**: `POST /api/auth/login`
- **Access**: Public
- **Request Body**:
```json
{
  "identifier": "officer.kottarakara",
  "password": "Officer@123",
  "login_as": "OFFICIAL"
}
```
*Note: `login_as` must be `"OFFICIAL"` for Officers/Admins, and `"CITIZEN"` for Citizens. Wrong tab returns `403`.*
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "user_id": 2,
      "role": "OFFICER",
      "full_name": "Deepak Kunjumon",
      "email": "officer.kottarakara@connectedpanchayat.test",
      "mobile": "9447000001",
      "panchayat_id": 1,
      "panchayat_name": "Kottarakara Grama Panchayat",
      "panchayat_code": "KTR",
      "officer_id": 1,
      "designation": "Secretary"
    }
  },
  "message": "Login successful"
}
```

### 1.3 Get Current User Profile
- **Method & Path**: `GET /api/auth/me`
- **Access**: Authenticated (`CITIZEN`, `OFFICER`, `ADMIN`)
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "user_id": 2,
    "username": "officer.kottarakara",
    "role": "OFFICER",
    "email": "officer.kottarakara@connectedpanchayat.test",
    "mobile": "9447000001",
    "panchayat_id": 1,
    "panchayat_name": "Kottarakara Grama Panchayat",
    "panchayat_code": "KTR",
    "officer_id": 1,
    "designation": "Secretary"
  }
}
```

### 1.4 Change Password
- **Method & Path**: `POST /api/auth/change-password`
- **Access**: Authenticated
- **Request Body**:
```json
{
  "current_password": "Officer@123",
  "new_password": "NewSecurePassword@123"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## 2. Certificate Applications (`/api/applications`)

### 2.1 Submit New Application
- **Method & Path**: `POST /api/applications`
- **Access**: Authenticated (`CITIZEN`)
- **Headers**: `Content-Type: multipart/form-data`
- **Form Data Fields**:
  - `data`: JSON string of application details and parties:
    ```json
    {
      "certificate_type_id": 1,
      "purpose": "Educational Concession",
      "declared_family_income": 120000,
      "land_holding_cents": 10,
      "house_area_sqft": 750,
      "parties": [
        {
          "party_type": "FATHER",
          "full_name": "Sasidharan K",
          "aadhaar_no": "456789012345",
          "occupation": "FARMER",
          "annual_income": 80000,
          "property_details": "10 cents land",
          "panchayat_id": 2
        }
      ]
    }
    ```
  - `fileMeta`: JSON string array of document metadata matching file count:
    ```json
    [
      { "document_type": "AADHAAR", "document_name": "Applicant Aadhaar", "related_to": "APPLICANT" },
      { "document_type": "FATHER_ID", "document_name": "Father ID", "related_to": "FATHER" }
    ]
    ```
  - `files`: Binary document uploads (PDF, JPG, PNG <= 5MB).
- **Response** (`201 Created`):
```json
{
  "success": true,
  "data": {
    "application_id": 4,
    "application_no": "EWS-2026-0004",
    "status": "PENDING_EXTERNAL",
    "created_requests_count": 1
  },
  "message": "Application submitted successfully"
}
```

### 2.2 List Applications
- **Method & Path**: `GET /api/applications?status=&search=&page=1&limit=10`
- **Access**: Authenticated (Scoped by role: Citizen sees own; Officer sees Home Panchayat; Admin sees all)
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "application_id": 4,
        "application_no": "EWS-2026-0004",
        "certificate_name": "EWS Certificate",
        "certificate_code": "EWS",
        "status": "PENDING_EXTERNAL",
        "citizen_name": "George Varghese",
        "submitted_at": "2026-10-21 19:40:00"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

### 2.3 Get Application Details by ID
- **Method & Path**: `GET /api/applications/:id`
- **Access**: Authenticated (Subject to data isolation rules)
- **Response** (`200 OK`): Returns full application model, citizen profile, attached parties, documents, verification requests with real-time signature checks, blockers, timeline, and issued certificate (if any).

### 2.4 Verify Uploaded Document
- **Method & Path**: `PATCH /api/applications/:id/documents/:docId/verify`
- **Access**: Authenticated (`OFFICER` of Home Panchayat)
- **Request Body**:
```json
{
  "status": "VERIFIED",
  "remarks": "Verified against local Aadhaar register"
}
```
- **Response** (`200 OK`): Returns updated document record with `verification_status: "VERIFIED"`.

### 2.5 Officer Decision on Application
- **Method & Path**: `POST /api/applications/:id/decision`
- **Access**: Authenticated (`OFFICER` of Home Panchayat)
- **Request Body**:
```json
{
  "decision": "APPROVED",
  "remarks": "All family metrics and external verifications confirmed"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "application_id": 4,
    "application_no": "EWS-2026-0004",
    "status": "APPROVED",
    "decision": "APPROVED",
    "decided_at": "2026-10-21 19:41:00"
  },
  "message": "Application approved successfully"
}
```

### 2.6 Issue Certificate
- **Method & Path**: `POST /api/applications/:id/issue-certificate`
- **Access**: Authenticated (`OFFICER` of Home Panchayat; Application must be `APPROVED`)
- **Response** (`201 Created`):
```json
{
  "success": true,
  "data": {
    "certificate_id": 3,
    "certificate_no": "CERT-EWS-2026-0003",
    "verification_code": "KL-KTR-2026-9A7B3X",
    "issue_date": "2026-10-21",
    "valid_until": "2027-04-21",
    "download_url": "/api/certificates/3/download"
  },
  "message": "Certificate issued successfully"
}
```

### 2.7 Public Application Tracking
- **Method & Path**: `GET /api/applications/track/:appNo`
- **Access**: Public
- **Response** (`200 OK`): Returns application status, submission date, Panchayat name, and milestone timeline without exposing sensitive personal identification.

---

## 3. Inter-Panchayat Verification (`/api/verification-requests`)

### 3.1 List Verification Requests
- **Method & Path**: `GET /api/verification-requests?direction=incoming&status=PENDING&search=&page=1&limit=10`
- **Access**: Authenticated (`OFFICER`, `ADMIN`)
- **Query Parameters**:
  - `direction`: `"incoming"` (to my Panchayat) or `"outgoing"` (from my Panchayat)
  - `status`: `"PENDING"`, `"APPROVED"`, `"REJECTED"`, `"CANCELLED"`
- **Response** (`200 OK`): Returns paginated requests including dynamically computed `is_overdue` (`status == 'PENDING' && now > due_at`).

### 3.2 Get Verification Counts
- **Method & Path**: `GET /api/verification-requests/counts`
- **Access**: Authenticated (`OFFICER`, `ADMIN`)
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "incoming": { "pending": 1, "approved": 2, "rejected": 0, "overdue": 1, "total": 3 },
    "outgoing": { "pending": 0, "approved": 1, "rejected": 0, "overdue": 0, "total": 1 }
  }
}
```

### 3.3 Get Single Verification Request
- **Method & Path**: `GET /api/verification-requests/:id`
- **Access**: Authenticated (`OFFICER` of requesting/verifying Panchayat, `ADMIN`)
- **Response** (`200 OK`): Returns request record, subject party details, documents scoped to that party, and real-time signature integrity check.

### 3.4 Respond with Digital Signature
- **Method & Path**: `POST /api/verification-requests/:id/respond`
- **Access**: Authenticated (`OFFICER` of Verifying Panchayat)
- **Request Body**:
```json
{
  "decision": "APPROVED",
  "remarks": "Land holding verified from revenue settlement records",
  "password": "Officer@123"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "verification_id": 5,
    "request_no": "CP-2026-0005",
    "status": "APPROVED",
    "signed_at": "2026-10-21 19:42:00",
    "signature_check": {
      "valid": true,
      "signer": "Fathima Beevi",
      "fingerprint": "7f0d5491..."
    }
  },
  "message": "Verification response signed and submitted successfully"
}
```

### 3.5 Send Verification Reminder
- **Method & Path**: `POST /api/verification-requests/:id/remind`
- **Access**: Authenticated (`OFFICER` of Requesting Panchayat)
- **Response** (`200 OK` or `400 Bad Request` if within 24h cooldown):
```json
{
  "success": true,
  "data": { "reminder_count": 1 },
  "message": "Reminder sent successfully"
}
```

### 3.6 Check Signature Validity
- **Method & Path**: `GET /api/verification-requests/:id/check-signature`
- **Access**: Authenticated (`OFFICER`, `ADMIN`)
- **Response** (`200 OK`): Returns `{ valid: true/false, hashMatches, signatureMatches, reason }`.

---

## 4. Certificates & Public Verification (`/api/certificates`)

### 4.1 Public Certificate Verification
- **Method & Path**: `GET /api/certificates/verify/:code`
- **Access**: Public
- **Response (Valid)** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "valid": true,
    "status": "VALID",
    "certificate_no": "CERT-EWS-2026-0001",
    "certificate_name": "EWS Certificate",
    "holder_name": "George Varghese",
    "issuing_panchayat": "Kottarakara Grama Panchayat",
    "issue_date": "2026-10-21",
    "valid_until": "2027-04-21",
    "integrity": { "fileHashMatches": true }
  }
}
```
- **Response (Non-Existent)** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "valid": false,
    "status": "NOT_FOUND",
    "message": "No matching certificate found in the records."
  }
}
```

### 4.2 Download Certificate PDF
- **Method & Path**: `GET /api/certificates/:id/download`
- **Access**: Authenticated (Owner Citizen, Issuing Officer, Admin)
- **Response**: Binary PDF Stream (`Content-Type: application/pdf`, `X-Integrity: ok`).

---

## 5. Dashboards & Reports

### 5.1 Officer Dashboard
- **Method & Path**: `GET /api/dashboard/officer`
- **Access**: Authenticated (`OFFICER`)
- **Response** (`200 OK`): Returns 30-day totals (`total_requests`, `pending_incoming`, `completed_certificates`, `overdue`), `awaiting_decision` count, urgent `current_request`, and 5 `recent_requests`.

### 5.2 Citizen Dashboard
- **Method & Path**: `GET /api/dashboard/citizen`
- **Access**: Authenticated (`CITIZEN`)
- **Response** (`200 OK`): Returns application counts, issued certificates count, recent applications, and active certificates.

### 5.3 Officer Analytics Reports
- **Method & Path**: `GET /api/reports/officer`
- **Access**: Authenticated (`OFFICER`)
- **Response** (`200 OK`): Returns breakdown by request status, certificate type distribution, 6-month monthly trends, average turnaround time in hours, and overdue requests.

### 5.4 Officer Public Key & Certificate
- **Method & Path**: `GET /api/officer/me/public-key[?download=pem]`
- **Access**: Authenticated (`OFFICER`)
- **Response** (`200 OK`): Returns JSON metadata `{ pem, fingerprint, key_created_at }` or downloads `officer_public_key.pem`.

---

## 6. Admin Management (`/api/admin`)

- `GET /api/admin/stats`: High-level counters (users, panchayats, applications, active certificates).
- `GET /api/admin/reports/summary`: Complete platform summary metrics (users by role, applications by status/type/panchayat, corridor rankings, overdue requests).
- `GET /api/admin/signatures/audit`: Full cryptographic audit scanning every signed request in MySQL using `cryptoService.verifyRequestSignature` and returning valid/invalid counts.
- `GET /api/admin/users`: List users with search, role, and status filters.
- `POST /api/admin/users`: Create officer accounts with automated RSA-2048 key pair generation.
- `PATCH /api/admin/users/:id/status`: Activate or deactivate user accounts.
- `GET /api/admin/panchayats`: List panchayats with officer statistics.
- `POST /api/admin/panchayats`: Register a new Grama Panchayat or Municipality.
- `GET /api/admin/audit-logs`: Paginated platform compliance audit logs.
- `GET /api/admin/master-data`: Manage system constants and settings.
