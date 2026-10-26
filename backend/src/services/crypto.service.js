const crypto = require('crypto');
const env = require('../config/env');

const KEY_SALT = 'connected-panchayat-key-salt';

/**
 * Generate RSA-2048 key pair for an officer
 */
function generateOfficerKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  return { publicKey, privateKey };
}

/**
 * Calculate SHA-256 fingerprint from SPKI DER bytes of public key
 */
function publicKeyFingerprint(publicKeyPem) {
  const keyObj = crypto.createPublicKey(publicKeyPem);
  const der = keyObj.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex');
}

/**
 * Encrypt private key using AES-256-GCM
 * Returns string formatted as: ivBase64.authTagBase64.cipherBase64
 */
function encryptPrivateKey(privateKeyPem, secret = env.KEY_ENCRYPTION_SECRET) {
  const key = crypto.scryptSync(secret, KEY_SALT, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(privateKeyPem, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  return `${iv.toString('base64')}.${authTag}.${encrypted}`;
}

/**
 * Decrypt private key from ivBase64.authTagBase64.cipherBase64
 */
function decryptPrivateKey(encryptedString, secret = env.KEY_ENCRYPTION_SECRET) {
  const parts = encryptedString.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted private key format');
  }

  const [ivBase64, authTagBase64, cipherBase64] = parts;
  const key = crypto.scryptSync(secret, KEY_SALT, 32);
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherBase64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Builds canonical JSON signature payload with exact key order specified in section 6
 */
function buildSignaturePayload(data) {
  const payload = {
    version: 1,
    request_no: String(data.request_no),
    verification_id: Number(data.verification_id),
    application_id: Number(data.application_id),
    application_no: String(data.application_no),
    requesting_panchayat: {
      id: Number(data.requesting_panchayat.id),
      code: String(data.requesting_panchayat.code),
      name: String(data.requesting_panchayat.name)
    },
    verifying_panchayat: {
      id: Number(data.verifying_panchayat.id),
      code: String(data.verifying_panchayat.code),
      name: String(data.verifying_panchayat.name)
    },
    subject_party: String(data.subject_party),
    subject_name: String(data.subject_name),
    decision: String(data.decision),
    remarks: String(data.remarks || ''),
    signed_by: {
      officer_id: Number(data.signed_by.officer_id),
      name: String(data.signed_by.name),
      designation: String(data.signed_by.designation),
      employee_id: String(data.signed_by.employee_id)
    },
    signed_at: String(data.signed_at)
  };

  return JSON.stringify(payload);
}

/**
 * Signs payload JSON with RSA-SHA256
 */
function signPayload(payloadJson, privateKeyPem) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(payloadJson);
  signer.end();

  const signature = signer.sign(privateKeyPem, 'base64');
  const payload_hash = crypto.createHash('sha256').update(payloadJson).digest('hex');

  return {
    payload_hash,
    signature,
    signature_algorithm: 'RSA-SHA256'
  };
}

/**
 * Verifies verification_requests row signature
 * Returns: { valid, hashMatches, signatureMatches, fieldsMatch, signer, fingerprint, reason }
 */
function verifyRequestSignature(row) {
  const result = {
    valid: false,
    hashMatches: false,
    signatureMatches: false,
    fieldsMatch: false,
    signer: null,
    fingerprint: row.signer_key_fingerprint || null,
    reason: ''
  };

  if (!row.payload_json || !row.signature || !row.signer_public_key || !row.payload_hash) {
    result.reason = 'Missing signature data on verification request';
    return result;
  }

  // 1. Check sha256(payload_json) === payload_hash
  const calculatedHash = crypto.createHash('sha256').update(row.payload_json).digest('hex');
  if (calculatedHash === row.payload_hash) {
    result.hashMatches = true;
  } else {
    result.reason = 'Payload hash mismatch (payload_json has been modified)';
    return result;
  }

  // 2. crypto.verify RSA-SHA256 of payload_json with signer_public_key and signature
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(row.payload_json);
    verifier.end();
    result.signatureMatches = verifier.verify(row.signer_public_key, row.signature, 'base64');
    if (!result.signatureMatches) {
      result.reason = 'Cryptographic signature is invalid for the public key';
      return result;
    }
  } catch (err) {
    result.signatureMatches = false;
    result.reason = `Signature verification error: ${err.message}`;
    return result;
  }

  // 3. Parsed payload fields equal CURRENT database row values
  let parsed;
  try {
    parsed = JSON.parse(row.payload_json);
    result.signer = parsed.signed_by || null;
  } catch (err) {
    result.reason = 'Invalid JSON in payload_json';
    return result;
  }

  const reqRemarks = row.response_remarks !== undefined ? row.response_remarks : (row.remarks || '');
  const reqDecision = row.status !== undefined ? row.status : row.decision;

  const matchChecks = [
    parsed.request_no === row.request_no,
    Number(parsed.verification_id) === Number(row.verification_id),
    Number(parsed.application_id) === Number(row.application_id),
    parsed.decision === reqDecision,
    (parsed.remarks || '') === (reqRemarks || ''),
    parsed.subject_name === row.subject_name,
    Number(parsed.requesting_panchayat?.id) === Number(row.requesting_panchayat_id),
    Number(parsed.verifying_panchayat?.id) === Number(row.verifying_panchayat_id)
  ];

  if (matchChecks.every(Boolean)) {
    result.fieldsMatch = true;
  } else {
    result.fieldsMatch = false;
    result.reason = 'Database record values do not match signed payload values (tampering detected)';
    return result;
  }

  result.valid = result.hashMatches && result.signatureMatches && result.fieldsMatch;
  return result;
}

module.exports = {
  generateOfficerKeyPair,
  publicKeyFingerprint,
  encryptPrivateKey,
  decryptPrivateKey,
  buildSignaturePayload,
  signPayload,
  verifyRequestSignature
};
