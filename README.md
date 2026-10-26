# Connected Panchayat — Inter-Panchayat Digital Verification System

> **MCA Final Year Project**  
> An automated, cryptographically verifiable governance platform enabling seamless cross-jurisdictional verification of citizen records between Grama Panchayats in Kerala.

---

## 1. Project Overview

In Kerala's local governance structure, every Grama Panchayat maintains demographic, revenue, and property records strictly for its own residents. When a resident applies for official certificates (such as **EWS**, **Income**, **Family Membership**, or **Residence**), the issuing Grama Panchayat frequently requires confirmation of facts held by other Panchayats—such as a parent residing in a different Panchayat or ancestral property situated elsewhere.

Historically, this required citizens to travel physically across multiple Panchayats or officers to send physical postal inquiries resulting in multi-week delays.

### Core Idea & Solution
**Connected Panchayat** bridges this administrative divide digitally:
1. **Targeted Verification Requests**: When a citizen applies in **Panchayat A**, the system automatically identifies external parties (e.g., father in **Panchayat B**, mother in **Panchayat C**) and dispatches discrete digital verification requests.
2. **Minimal Data Exposure**: Panchayat B never exposes raw resident records; instead, B's officer performs an authoritative record check and records a definitive **APPROVED** or **REJECTED** decision with remarks.
3. **Cryptographic Non-Repudiation**: Every decision is digitally signed using standard **RSA-2048 with SHA-256** and anchored to the officer's private key (encrypted at rest using AES-256-GCM).
4. **Automated Signature Validation**: The requesting Panchayat validates the digital signature automatically. Once all prerequisites are verified, the home Panchayat issues a tamper-evident, digitally signed **PDF Certificate** with a scannable **QR Code** for instant public verification.

---

## 2. Key Features

- **Multi-Role Portal**: Tailored, role-based interfaces for Citizens, Panchayat Officers, and System Administrators.
- **Dynamic 4-Step Application Wizard**: Multi-party details collection, automated mandatory document requirement checking, and smart routing of verification requests.
- **6 Standard Kerala Certificate Types**:
  1. *EWS (Economically Weaker Section) Certificate*
  2. *Income Certificate*
  3. *Residence Certificate*
  4. *Nativity Certificate*
  5. *Family Membership Certificate*
  6. *Possession Certificate*
- **Real Cryptographic Digital Signatures**:
  - RSA-2048 key pair generated per officer upon creation.
  - Private keys encrypted at rest via AES-256-GCM with PBKDF2 salt.
  - Officer signs verification responses with their login password; canonical JSON hashing (SHA-256) guarantees tamper resistance.
- **Instant Tamper Detection**: Tampering with any database record (decision, remarks, or metadata) immediately invalidates the signature and blocks application approval.
- **Professional PDF Issuance**: Generated via PDFKit with official state header, security watermarks, external verification audit table, and embedded QR code.
- **Public QR & Code Verification**: Anyone can scan the QR code or enter the verification code on the public portal to verify authenticity without exposing sensitive personal data.
- **Automated Reminder & Overdue Tracking**: 24-hour reminder cooldown enforcement, overdue flags for delayed responses, and visual urgency indicators.
- **Full Audit Trail & Notifications**: Dual in-app notifications and email alerts (with console fallback for offline evaluation).

---

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, React Router v6, Tailwind CSS v3, Recharts, Lucide React, Axios, Date-fns |
| **Backend** | Node.js (v18+ / v24+), Express 4 (CommonJS), Zod, Multer, PDFKit, QRCode, Nodemailer |
| **Database** | MySQL 8.x / 8.4, `mysql2/promise` connection pool, Raw Parameterized SQL, InnoDB Transactions |
| **Cryptography** | Native Node.js `crypto` module (RSA-2048, SHA-256, AES-256-GCM, PBKDF2) |
| **Authentication** | JSON Web Tokens (JWT, 8-hour expiry), Bcrypt.js password hashing, Role-Based Access Control |
| **Design System** | Clean Govt Soft UI: Slate/Zinc neutral base with Kerala Govt Blue `#1E3A8A` accents |

---

## 4. Prerequisites

1. **Node.js**: Version 18.0.0 or higher (`node -v` to verify).
2. **MySQL Server**: Version 8.0 or 8.4 running locally on port 3306 or 3307 (`mysql -u root -p`).
3. **Git**: Installed and available on your PATH.

---

## 5. Exact Windows Setup Guide

Open PowerShell or Command Prompt in the project root:

### Step 1: Install Dependencies
```powershell
npm run install:all
```
*This installs root dev tools (`concurrently`), backend packages, and frontend packages.*

### Step 2: Configure Environment Variables
Copy `backend/.env.example` to `backend/.env` if not already present:
```powershell
copy backend\.env.example backend\.env
```
Open `backend/.env` in any editor and ensure the MySQL credentials match your local MySQL configuration:
```ini
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=connected_panchayat
JWT_SECRET=cp_jwt_super_secret_signing_key_2026_at_least_32_chars
KEY_ENCRYPTION_SECRET=cp_aes_gcm_master_key_encryption_secret_2026_min32
FRONTEND_URL=http://localhost:5173
```

### Step 3: Initialize and Seed Database
```powershell
npm run db:reset
```
*This executes `schema.sql` to create all 17 tables and runs `seed.js` to populate Kerala Panchayats, demo officers with RSA keys, demo citizens, and seed applications.*

### Step 4: Run Automated Tests
```powershell
npm test
```
*Executes the complete 27-step end-to-end test suite on an isolated `connected_panchayat_test` database.*

### Step 5: Start Both Servers Concurrently
```powershell
npm run dev
```
- **Backend API**: `http://localhost:5000`
- **Frontend Web App**: `http://localhost:5173`

---

## 6. Pre-Seeded Demo Accounts

You can log in immediately using any of these pre-seeded demo accounts:

| Role | Name / Jurisdiction | Username / Phone | Password | Login Portal Tab |
|---|---|---|---|---|
| **ADMIN** | System Administrator | `admin` | `Admin@123` | **Official Login** |
| **OFFICER** | Deepak Kunjumon (Kottarakara GP) | `officer.kottarakara` | `Officer@123` | **Official Login** |
| **OFFICER** | Sreeja Menon (Kollam Corporation) | `officer.kollam` | `Officer@123` | **Official Login** |
| **OFFICER** | Rajesh Kumar (Kadakkal GP) | `officer.kadakkal` | `Officer@123` | **Official Login** |
| **OFFICER** | Fathima Beevi (Anchal GP) | `officer.anchal` | `Officer@123` | **Official Login** |
| **CITIZEN** | Akhil K S (Kollam) | `9876500001` | `Citizen@123` | **Citizen Login** |
| **CITIZEN** | Anu Thomas (Kottarakara) | `9876500002` | `Citizen@123` | **Citizen Login** |
| **CITIZEN** | Rafiq Khan (Kadakkal) | `9876500003` | `Citizen@123` | **Citizen Login** |

---

## 7. Enabling Real Email Delivery (Optional)

By default, the backend operates in **Console Mode**: emails are logged to the terminal with recipient, subject, and body clearly formatted.

To dispatch live emails via Gmail SMTP:
1. Generate an **App Password** from your Google Account:
   *Manage Google Account -> Security -> 2-Step Verification -> App Passwords*.
2. Update `backend/.env`:
   ```ini
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_16_character_app_password
   MAIL_FROM=Connected Panchayat <your_email@gmail.com>
   DEMO_CITIZEN_EMAIL=your_personal_inbox@gmail.com
   ```
3. Restart the backend server. All workflow emails will be delivered directly to `DEMO_CITIZEN_EMAIL`.

---

## 8. Troubleshooting

- **Database Connection Error (`ER_ACCESS_DENIED_ERROR` or `ECONNREFUSED`)**:
  - Verify MySQL is running (`Get-Service MySQL*` on Windows).
  - Check the `DB_PORT` in `backend/.env` (default is `3306`; if using MySQL 8.4 on a secondary port, it may be `3307`).
  - Verify `DB_PASSWORD` matches your local root password.
- **Port 5000 or 5173 Already in Use**:
  - Check running processes: `Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess`
  - Stop the conflicting process or change `PORT=5001` in `backend/.env` and `vite.config.js`.
- **CORS Issues in Browser**:
  - The frontend Vite dev server includes an active reverse proxy (`/api` -> `http://localhost:5000`). Always access the application through `http://localhost:5173`.

---

## 9. Project Directory Structure

```
connected-panchayat/
├── PROJECT_SPEC.md              # Authoritative project specification
├── README.md                    # Setup, demo accounts, and quickstart guide
├── package.json                 # Root orchestration scripts (dev, test, db:reset)
├── docs/                        # Complete MCA project documentation
│   ├── ARCHITECTURE.md          # System architecture & Mermaid sequence diagrams
│   ├── DATABASE.md              # Database schema & entity-relationship diagrams
│   ├── API.md                   # Full REST API specification with sample payloads
│   ├── SECURITY.md              # Cryptography, key storage, RBAC, and threat models
│   ├── TEST_CASES.md            # 40+ manual verification test scenarios
│   ├── DEMO_SCRIPT.md           # 8-minute step-by-step viva presentation script
│   └── FUTURE_SCOPE.md          # Production roadmap (Aadhaar eSign, Blockchain, etc.)
├── backend/                     # Node.js Express REST API
│   ├── package.json
│   ├── .env.example
│   ├── sql/schema.sql           # 17 relational database tables
│   ├── scripts/                 # Database initialization and seeding scripts
│   ├── src/
│   │   ├── app.js               # Express app configuration & middleware
│   │   ├── server.js            # HTTP server bootstrap
│   │   ├── config/              # Environment and MySQL pool connection
│   │   ├── middleware/          # JWT auth, RBAC, upload handling, error boundary
│   │   ├── controllers/         # Business logic and request controllers
│   │   ├── routes/              # Express API route declarations
│   │   └── services/            # Crypto, PDF, email, sequences, and audit
│   └── tests/
│       └── e2e.test.js          # Complete 27-step automated test suite
└── frontend/                    # Vite React SPA
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx              # Client routing & ErrorBoundary
        ├── api/                 # Axios HTTP client endpoints
        ├── context/             # AuthContext state management
        ├── components/          # Reusable Govt Soft UI design system
        └── pages/               # Public, Citizen, Officer, and Admin dashboards
```
