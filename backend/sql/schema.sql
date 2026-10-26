CREATE DATABASE IF NOT EXISTS connected_panchayat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE connected_panchayat;

SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS sequences;
DROP TABLE IF EXISTS master_data;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS certificate_verification_logs;
DROP TABLE IF EXISTS certificates;
DROP TABLE IF EXISTS application_timeline;
DROP TABLE IF EXISTS verification_requests;
DROP TABLE IF EXISTS application_documents;
DROP TABLE IF EXISTS application_parties;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS certificate_types;
DROP TABLE IF EXISTS panchayat_officers;
DROP TABLE IF EXISTS citizens;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS panchayats;
DROP TABLE IF EXISTS roles;
SET FOREIGN_KEY_CHECKS=1;

CREATE TABLE roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panchayats (
  panchayat_id INT AUTO_INCREMENT PRIMARY KEY,
  panchayat_name VARCHAR(100) NOT NULL,
  panchayat_code VARCHAR(10) NOT NULL UNIQUE,
  district VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL DEFAULT 'Kerala',
  address TEXT,
  contact_no VARCHAR(15),
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE certificate_types (
  certificate_type_id INT AUTO_INCREMENT PRIMARY KEY,
  certificate_code VARCHAR(20) NOT NULL UNIQUE,
  certificate_name VARCHAR(100) NOT NULL,
  description TEXT,
  required_documents JSON NOT NULL,
  verification_parties JSON NOT NULL,
  validity_months INT NOT NULL DEFAULT 12,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE certificate_verification_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  certificate_id INT NULL,
  verification_code VARCHAR(30) NOT NULL,
  verified_by_user_id INT NULL,
  verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  method ENUM('QR','CODE') NOT NULL DEFAULT 'CODE',
  result ENUM('VALID','INVALID','EXPIRED','NOT_FOUND') NOT NULL,
  ip_address VARCHAR(45)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  `action` VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id INT NULL,
  ip_address VARCHAR(45),
  description TEXT,
  action_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_time (action_time),
  INDEX idx_audit_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE master_data (
  master_id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  code VARCHAR(50) NOT NULL,
  `value` VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  UNIQUE KEY uq_master (category, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sequences (
  seq_key VARCHAR(60) PRIMARY KEY,
  `last_value` INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
