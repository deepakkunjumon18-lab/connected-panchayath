# System Architecture — Connected Panchayat

## 1. System Overview

Connected Panchayat is architected as a decoupled, multi-tiered digital governance platform designed for high integrity, auditable record verification, and strict institutional privacy between local administrative units (Grama Panchayats).

The system follows a classic **Client-Server-Database** architecture with specialized subsystems for cryptographic signing, sequence generation, dynamic PDF synthesis, and background event notification.

---

## 2. High-Level Component Diagram

```mermaid
graph TD
    subgraph ClientLayer ["Client Layer (Presentation Tier)"]
        UI_Citizen["Citizen Portal<br/>(React SPA)"]
        UI_Officer["Panchayat Officer Workstation<br/>(React SPA)"]
        UI_Admin["State Admin Dashboard<br/>(React SPA)"]
        UI_Public["Public Verification Portal<br/>(QR & Code Checker)"]
    end

    subgraph APILayer ["API & Business Logic Layer (Node.js / Express)"]
        Router["Express Router & Dispatcher"]
        AuthMiddleware["JWT Authentication & RBAC Middleware"]
        UploadMiddleware["Multer Secure Disk Storage"]

        subgraph CoreServices ["Core Domain Services"]
            CryptoService["Crypto Service<br/>(RSA-2048 / SHA-256 / AES-GCM)"]
            AppService["Application Service<br/>(Lifecycle & Blocker Evaluation)"]
            VerifService["Verification Service<br/>(Inter-Panchayat Routing)"]
            CertService["Certificate Service<br/>(PDFKit & QR Synthesis)"]
            SeqService["Sequence Service<br/>(Thread-Safe Serial Nos)"]
            AuditService["Audit Log Service"]
            NotifService["Notification & Mailer Service"]
        end
    end

    subgraph DataLayer ["Data Persistence Layer"]
        MySQL[("MySQL 8.x Database<br/>(InnoDB Transactions & Raw SQL)")]
        FileStorage[("Encrypted Disk Storage<br/>(Uploads & Issued PDF Vault)")]
    end

    UI_Citizen -->|REST / HTTPS| Router
    UI_Officer -->|REST / HTTPS| Router
    UI_Admin -->|REST / HTTPS| Router
    UI_Public -->|REST / HTTPS| Router

    Router --> AuthMiddleware
    AuthMiddleware --> CoreServices
    Router --> UploadMiddleware

    CoreServices --> MySQL
    CertService --> FileStorage
    UploadMiddleware --> FileStorage
```

---

## 3. End-to-End Inter-Panchayat Verification Sequence

The sequence diagram below models the complete lifecycle of a cross-jurisdiction application (e.g., EWS or Income Certificate) where the applicant resides in **Panchayat A** but requires ancestral/property validation from **Panchayat B**.

```mermaid
sequenceDiagram
    autonumber
    actor Citizen as Citizen (Applicant)
    participant HomeOfficer as Home Officer (Panchayat A)
    participant Server as Connected Panchayat API
    participant DB as MySQL Database
    actor OtherOfficer as External Officer (Panchayat B)

    Note over Citizen,Server: 1. Citizen Submits Application
    Citizen->>Server: POST /api/applications (Multipart Form + Documents + Parties)
    Server->>DB: Begin DB Transaction
    Server->>DB: Insert application (Status: PENDING_EXTERNAL)
    Server->>DB: Insert application_parties (Father/Mother in Panchayat B)
    Server->>DB: Generate verification_request (Panchayat A -> B)
    Server->>DB: Commit Transaction
    Server-->>Citizen: 201 Created (Application No: EWS-2026-0001)
    Server->>OtherOfficer: In-App Alert + Email Notification

    Note over OtherOfficer,Server: 2. External Officer Verifies & Signs
    OtherOfficer->>Server: GET /api/verification-requests/:id
    Server-->>OtherOfficer: Return Subject Details & Related Documents Only
    OtherOfficer->>OtherOfficer: Offline Manual Physical Record Check
    OtherOfficer->>Server: POST /api/verification-requests/:id/respond<br/>{decision: 'APPROVED', remarks: 'Record OK', password}
    Server->>Server: Authenticate Officer & Decrypt RSA Private Key (AES-256-GCM)
    Server->>Server: Canonicalize Payload & Generate Digital Signature (RSA-SHA256)
    Server->>DB: Update verification_request (status: APPROVED, signature, fingerprint)
    Server->>DB: Check pending requests -> Set application to READY_FOR_DECISION
    Server->>HomeOfficer: In-App Alert + Email Notification

    Note over HomeOfficer,Server: 3. Home Officer Validates & Issues
    HomeOfficer->>Server: GET /api/applications/:id
    Server->>Server: Real-Time RSA Signature Verification of Response
    Server-->>HomeOfficer: Application Details + "Digital Signature Valid" Panel
    HomeOfficer->>Server: PATCH /api/applications/:id/documents/:docId/verify
    HomeOfficer->>Server: POST /api/applications/:id/decision {decision: 'APPROVED'}
    Server->>DB: Update status = APPROVED
    HomeOfficer->>Server: POST /api/applications/:id/issue-certificate
    Server->>Server: Generate A4 PDF with Embedded Verification Table & QR Code
    Server->>DB: Store certificate record & SHA-256 hash
    Server->>DB: Update application status = CERTIFICATE_ISSUED
    Server-->>HomeOfficer: 201 Issued
    Server->>Citizen: Email: "Your certificate is ready for download"

    Note over Citizen,Server: 4. Download & Public Verification
    Citizen->>Server: GET /api/certificates/:id/download
    Server-->>Citizen: Valid PDF Stream (X-Integrity: ok)
```

---

## 4. Digital Signature Cryptographic Flow

Every Grama Panchayat officer is provisioned with a unique, cryptographically strong key pair upon account creation. Private keys never leave the server unencrypted.

```mermaid
flowchart TD
    subgraph OfficerAction ["1. Officer Signing Request"]
        Password["Officer Login Password"]
        Decision["Decision: APPROVED / REJECTED"]
        Remarks["Officer Remarks"]
    end

    subgraph KeyDecryption ["2. Officer Key Recovery"]
        SaltDB["Read officer.private_key_salt from DB"]
        EncKeyDB["Read officer.encrypted_private_key from DB"]
        DeriveKey["Derive AES Key: PBKDF2(Password, Salt, 100000 iter, 32 bytes)"]
        DecryptKey["Decrypt Private Key: AES-256-GCM(EncKey, AuthTag, IV)"]
        Password --> DeriveKey
        SaltDB --> DeriveKey
        DeriveKey --> DecryptKey
        EncKeyDB --> DecryptKey
    end

    subgraph Canonicalization ["3. Canonical Payload & Hash"]
        Fields["Extract Fields: request_no, app_no, decision, remarks, signer_id, timestamp"]
        CanonicalJSON["Format Sorted Canonical JSON String"]
        SHA256["Compute SHA-256 Hash of Canonical String"]
        Decision --> Fields
        Remarks --> Fields
        Fields --> CanonicalJSON
        CanonicalJSON --> SHA256
    end

    subgraph Signing ["4. RSA Signature Generation"]
        RSASign["Sign SHA-256 Hash using Recovered RSA-2048 Private Key"]
        DecryptKey --> RSASign
        SHA256 --> RSASign
        Base64["Encode Signature to Base64 String"]
        RSASign --> Base64
    end

    subgraph Storage ["5. Immutable Persistence"]
        DBStore[("Store in verification_requests:<br/>payload_json, payload_hash, signature,<br/>signer_public_key, signer_key_fingerprint, signed_at")]
        Base64 --> DBStore
    end
```

---

## 5. Application Lifecycle State Diagram

The application transitions through deterministic states enforced strictly by database transactions and business rule validations.

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED : Citizen Submits Application (No External Requests)
    [*] --> PENDING_EXTERNAL : Citizen Submits Application (External Requests Created)

    PENDING_EXTERNAL --> READY_FOR_DECISION : All External Requests Responded & Signed
    SUBMITTED --> READY_FOR_DECISION : Home Officer Verifies Local Documents

    PENDING_EXTERNAL --> REJECTED : Home Officer Rejects Application Early
    READY_FOR_DECISION --> REJECTED : Home Officer Rejects Application (Reason Mandatory)

    READY_FOR_DECISION --> APPROVED : Home Officer Approves (All Requests Approved & Signatures Valid)
    APPROVED --> CERTIFICATE_ISSUED : Home Officer Issues Certificate (PDF Generated)

    CERTIFICATE_ISSUED --> [*]
    REJECTED --> [*]
```

---

## 6. Key Design Decisions

1. **Parameterless Canonical Representation**:  
   To prevent JSON formatting discrepancies across runtimes, payloads are serialized with sorted keys and normalized whitespace before generating SHA-256 digests.
2. **Stateless JWT with Database Status Checks**:  
   JWT tokens contain authorization claims, but real-time database queries ensure deactivated users (`status = 'INACTIVE'`) are intercepted immediately without waiting for token expiry.
3. **Double Redundancy PDF Verification**:  
   Certificates are verified both by their high-entropy unique `verification_code` and by recalculating the SHA-256 cryptographic hash of the PDF file stored on disk to detect physical file tampering.
