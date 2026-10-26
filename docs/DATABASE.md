# Database Architecture & Entity-Relationship Model

## 1. Overview

The Connected Panchayat database schema is designed in **Third Normal Form (3NF)** with strict referential integrity, foreign key cascades, and unique composite indexes to prevent race conditions during sequence generation and concurrent state transitions.

The database runs on **MySQL 8.x (InnoDB Engine)** with `utf8mb4_unicode_ci` collation.

---

## 2. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    roles ||--o{ users : "defines role"
    panchayats ||--o{ users : "belongs to"
    panchayats ||--o{ citizens : "resides in"
    panchayats ||--o{ panchayat_officers : "assigned to"
    panchayats ||--o{ applications : "home panchayat"
    panchayats ||--o{ verification_requests : "requesting / verifying"
    panchayats ||--o{ certificates : "issuing panchayat"

    users ||--o| citizens : "citizen account"
    users ||--o| panchayat_officers : "officer account"
    users ||--o{ notifications : "receives"
    users ||--o{ audit_logs : "actor"
    users ||--o{ application_timeline : "recorded by"

    citizens ||--o{ applications : "applies"
    citizens ||--o{ certificates : "holder"

    certificate_types ||--o{ applications : "type of"
    certificate_types ||--o{ certificates : "certificate category"

    applications ||--o{ application_parties : "involves"
    applications ||--o{ application_documents : "attaches"
    applications ||--o{ verification_requests : "triggers"
    applications ||--o{ application_timeline : "tracks events"
    applications ||--o| certificates : "results in"

    application_parties ||--o{ verification_requests : "subject of"

    certificates ||--o{ certificate_verification_logs : "audit scans"

    roles {
        int role_id PK
        string role_name UK
        string description
    }

    panchayats {
        int panchayat_id PK
        string panchayat_name
        string panchayat_code UK
        string district
        string state
        string status
    }

    users {
        int user_id PK
        string username UK
        string password_hash
        string email
        string mobile
        int role_id FK
        string status
    }

    citizens {
        int citizen_id PK
        int user_id FK
        string full_name
        string aadhaar_no UK
        string mobile UK
        int panchayat_id FK
    }

    panchayat_officers {
        int officer_id PK
        int user_id FK
        int panchayat_id FK
        string full_name
        string designation
        text rsa_public_key
        string rsa_key_fingerprint
        text encrypted_private_key
    }

    certificate_types {
        int certificate_type_id PK
        string certificate_code UK
        string certificate_name
        json verification_parties
        json required_documents
        int validity_months
    }

    applications {
        int application_id PK
        string application_no UK
        int citizen_id FK
        int certificate_type_id FK
        int home_panchayat_id FK
        string status
        decimal declared_family_income
        datetime submitted_at
    }

    application_parties {
        int party_id PK
        int application_id FK
        string party_type
        string full_name
        string aadhaar_no
        int panchayat_id FK
        boolean verification_required
    }

    application_documents {
        int document_id PK
        int application_id FK
        string document_type
        string file_path
        string file_hash
        string verification_status
    }

    verification_requests {
        int verification_id PK
        string request_no UK
        int application_id FK
        int party_id FK
        int requesting_panchayat_id FK
        int verifying_panchayat_id FK
        string status
        datetime due_at
        text signature
        string signer_key_fingerprint
        datetime signed_at
    }

    certificates {
        int certificate_id PK
        string certificate_no UK
        int application_id FK
        string verification_code UK
        string certificate_file
        string certificate_hash
        string status
        date issue_date
        date valid_until
    }

    certificate_verification_logs {
        int log_id PK
        int certificate_id FK
        string verification_code
        string method
        string result
        string ip_address
    }

    application_timeline {
        int event_id PK
        int application_id FK
        string event_type
        string title
        datetime created_at
    }

    notifications {
        int notification_id PK
        int user_id FK
        string notification_type
        string title
        text message
        boolean is_read
    }

    audit_logs {
        int log_id PK
        int user_id FK
        string action
        string table_name
        int record_id
        string ip_address
    }

    master_data {
        int master_id PK
        string category
        string code
        string value
    }

    sequences {
        int sequence_id PK
        string sequence_type UK
        int current_val
    }
```

---

## 3. Table Descriptions & Specifications

### 1. `roles`
Stores authorization role definitions (`CITIZEN`, `OFFICER`, `ADMIN`). Every user references exactly one role, which controls endpoint access and permission scopes throughout the platform.

### 2. `panchayats`
Holds primary directory details for all local administrative bodies in Kerala, including the official name, short unique code (e.g., `KTR`, `KLM`, `KDK`, `ANC`), district, official contact details, and activation status.

### 3. `users`
Central authentication store containing login credentials (username, Bcrypt-hashed password, email, mobile), role foreign key, and active/inactive status flag used by the auth middleware on every authenticated request.

### 4. `citizens`
Stores demographic profiles for registered residents, linked 1-to-1 with `users`. Contains full name, masked Aadhaar reference, mobile, address, and a foreign key to their home Panchayat.

### 5. `panchayat_officers`
Stores officer service records and cryptographic credentials linked 1-to-1 with `users`. Contains official designation, assigned Panchayat ID, RSA-2048 public key PEM, 64-character SHA-256 key fingerprint, and the AES-256-GCM encrypted private key container.

### 6. `certificate_types`
Configures the 6 supported certificate types (EWS, Income, Residence, Nativity, Family Membership, Possession). Contains JSON definitions for required multi-party validations (`verification_parties`) and mandatory uploaded attachments (`required_documents`).

### 7. `applications`
Core lifecycle registry for certificate applications. Stores human-readable application numbers (e.g., `EWS-2026-0001`), applicant citizen reference, certificate type, declared income/land metrics, and current workflow status (`SUBMITTED`, `PENDING_EXTERNAL`, `READY_FOR_DECISION`, `APPROVED`, `REJECTED`, `CERTIFICATE_ISSUED`).

### 8. `application_parties`
Tracks individual family members, deceased relatives, or land parcels associated with an application. Identifies whether external cross-panchayat verification is required (`verification_required = 1`) based on residence outside the home Panchayat.

### 9. `application_documents`
Registry of uploaded PDF and image attachments for each application. Stores disk storage path, MIME type, file size, SHA-256 file checksum, and verification audit flags (`PENDING`, `VERIFIED`, `REJECTED`).

### 10. `verification_requests`
Maintains inter-panchayat digital verification workflows. Links requesting and verifying Panchayats, subject party, 7-day statutory deadline (`due_at`), reminder counts, digital signature metadata (RSA signature, public key, timestamp, fingerprint), and final response decisions (`APPROVED` or `REJECTED`).

### 11. `certificates`
Registry of officially issued certificates. Stores immutable certificate numbers (e.g., `CERT-EWS-2026-0001`), unique alphanumeric verification codes (e.g., `KL-KTR-2026-X8B9Q2`), validity periods, disk file path, and SHA-256 cryptographic file checksums.

### 12. `certificate_verification_logs`
Audit log recording every public verification attempt (via QR code scan or manual code entry). Records timestamp, client IP address, verification method (`QR` vs `CODE`), and verification result (`VALID`, `INVALID`, `NOT_FOUND`, `EXPIRED`).

### 13. `application_timeline`
Chronological audit history of milestones for every application (submission, document reviews, reminders sent, responses received, approvals, and issuance).

### 14. `notifications`
In-app and email alert queue for users. Stores notification types, title, message text, unread state, and email delivery dispatch status.

### 15. `audit_logs`
Immutable compliance log recording user actions across the platform (logins, registrations, status modifications, key downloads, and decisions) along with actor ID and IP addresses.

### 16. `master_data`
System settings and lookup constants, including the 24-hour reminder cooldown setting (`REMINDER_COOLDOWN_HOURS`) and standard document type classifications.

### 17. `sequences`
Thread-safe counter table with row-level locking (`SELECT FOR UPDATE`) to guarantee unique, gapless sequence numbers for applications, requests, and issued certificates.
