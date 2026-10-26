const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../config/db');
const { success, error, paginated } = require('../utils/apiResponse');
const auditService = require('../services/audit.service');
const cryptoService = require('../services/crypto.service');

// Zod schemas for Admin endpoints
const createUserSchema = z.object({
  role: z.enum(['ADMIN', 'OFFICER', 'CITIZEN']),
  username: z.string().min(3).max(50),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and digit'),
  email: z.string().email().max(100),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Mobile must be a 10-digit number starting with 6-9'),
  // Role specific
  full_name: z.string().min(2).max(100).optional(),
  panchayat_id: z.number().int().positive().optional(),
  employee_id: z.string().min(2).max(50).optional(),
  designation: z.string().min(2).max(100).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  aadhaar_no: z.string().regex(/^\d{12}$/).optional(),
  address: z.string().min(5).optional()
}).refine((data) => {
  if (data.role === 'OFFICER') {
    return data.panchayat_id && data.employee_id && data.designation && data.full_name;
  }
  if (data.role === 'CITIZEN') {
    return data.full_name && data.panchayat_id && data.date_of_birth && data.gender && data.aadhaar_no && data.address;
  }
  return true;
}, {
  message: 'Missing required fields for selected role'
});

const updateUserSchema = z.object({
  email: z.string().email().max(100).optional(),
  mobile: z.string().regex(/^[6-9]\d{9}$/).optional(),
  full_name: z.string().min(2).max(100).optional(),
  designation: z.string().min(2).max(100).optional(),
  panchayat_id: z.number().int().positive().optional(),
  address: z.string().min(5).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

const resetPasswordSchema = z.object({
  new_password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and digit')
});

const createPanchayatSchema = z.object({
  panchayat_name: z.string().min(2).max(100),
  panchayat_code: z.string().min(2).max(10).toUpperCase(),
  district: z.string().min(2).max(100),
  address: z.string().optional(),
  contact_no: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

const updatePanchayatSchema = z.object({
  panchayat_name: z.string().min(2).max(100).optional(),
  panchayat_code: z.string().min(2).max(10).toUpperCase().optional(),
  district: z.string().min(2).max(100).optional(),
  address: z.string().optional(),
  contact_no: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

const updateCertTypeSchema = z.object({
  certificate_name: z.string().min(2).max(100),
  description: z.string().optional(),
  validity_months: z.number().int().positive(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  required_documents: z.array(z.object({
    type: z.string(),
    label: z.string(),
    related_to: z.enum(['APPLICANT', 'FATHER', 'MOTHER', 'PROPERTY', 'OTHER']),
    mandatory: z.boolean()
  })),
  verification_parties: z.array(z.string())
});

const masterDataSchema = z.object({
  category: z.string().min(2).max(50).toUpperCase(),
  code: z.string().min(1).max(50).toUpperCase(),
  value: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

/* =========================================================================
   1. USER MANAGEMENT
   ========================================================================= */

async function getUsers(req, res) {
  const { role, panchayat_id, status, search } = req.query;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const offset = (page - 1) * limit;

  let whereClauses = ['1=1'];
  const params = [];

  if (role) {
    whereClauses.push('r.role_name = ?');
    params.push(role);
  }
  if (status) {
    whereClauses.push('u.status = ?');
    params.push(status);
  }
  if (panchayat_id) {
    whereClauses.push('(o.panchayat_id = ? OR c.panchayat_id = ?)');
    params.push(Number(panchayat_id), Number(panchayat_id));
  }
  if (search) {
    whereClauses.push('(u.username LIKE ? OR u.email LIKE ? OR u.mobile LIKE ? OR o.full_name LIKE ? OR c.full_name LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  const whereSql = whereClauses.join(' AND ');

  const countSql = `
    SELECT COUNT(DISTINCT u.user_id) as total
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
    LEFT JOIN panchayat_officers o ON u.user_id = o.user_id
    LEFT JOIN citizens c ON u.user_id = c.user_id
    WHERE ${whereSql}
  `;
  const countRows = await db.query(countSql, params);
  const total = countRows[0].total;

  const dataSql = `
    SELECT u.user_id, u.username, u.email, u.mobile, u.status, u.created_at, u.last_login_at,
           r.role_name,
           COALESCE(o.full_name, c.full_name, u.username) as full_name,
           COALESCE(o.panchayat_id, c.panchayat_id) as panchayat_id,
           p.panchayat_name, p.panchayat_code,
           o.officer_id, o.employee_id, o.designation, o.key_fingerprint,
           c.citizen_id
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
    LEFT JOIN panchayat_officers o ON u.user_id = o.user_id
    LEFT JOIN citizens c ON u.user_id = c.user_id
    LEFT JOIN panchayats p ON p.panchayat_id = COALESCE(o.panchayat_id, c.panchayat_id)
    WHERE ${whereSql}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const items = await db.query(dataSql, [...params, limit, offset]);

  return paginated(res, items, total, page, limit);
}

async function createUser(req, res) {
  const data = req.body;

  // Check unique constraints in users
  const dup = await db.query(
    'SELECT username, email, mobile FROM users WHERE username = ? OR email = ? OR mobile = ?',
    [data.username, data.email, data.mobile]
  );
  if (dup.length) {
    const existing = dup[0];
    let conflictField = 'username';
    if (existing.email === data.email) conflictField = 'email';
    else if (existing.mobile === data.mobile) conflictField = 'mobile';
    return error(res, `A user with this ${conflictField} already exists`, { [conflictField]: 'Already exists' }, 409);
  }

  // Get role_id
  const roles = await db.query('SELECT role_id FROM roles WHERE role_name = ?', [data.role]);
  if (!roles.length) {
    return error(res, 'Invalid role', {}, 400);
  }
  const roleId = roles[0].role_id;

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(data.password, salt);

  let newOfficerFingerprint = null;

  const createdUserId = await db.withTransaction(async (conn) => {
    const [uRes] = await conn.query(
      `INSERT INTO users (username, password_hash, email, mobile, role_id, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [data.username, passwordHash, data.email, data.mobile, roleId]
    );
    const userId = uRes.insertId;

    if (data.role === 'OFFICER') {
      // Check employee_id uniqueness
      const [empDup] = await conn.query('SELECT officer_id FROM panchayat_officers WHERE employee_id = ?', [data.employee_id]);
      if (empDup.length) {
        throw Object.assign(new Error(`Employee ID ${data.employee_id} already exists`), { statusCode: 409, errors: { employee_id: 'Already exists' } });
      }

      // Generate RSA key pair
      const { publicKey, privateKey } = cryptoService.generateOfficerKeyPair();
      const fingerprint = cryptoService.publicKeyFingerprint(publicKey);
      const encPrivKey = cryptoService.encryptPrivateKey(privateKey);
      newOfficerFingerprint = fingerprint;

      await conn.query(
        `INSERT INTO panchayat_officers (
          user_id, panchayat_id, employee_id, designation, full_name, mobile, email,
          status, public_key, private_key_encrypted, key_fingerprint, key_created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, NOW())`,
        [userId, data.panchayat_id, data.employee_id, data.designation, data.full_name, data.mobile, data.email, publicKey, encPrivKey, fingerprint]
      );
    } else if (data.role === 'CITIZEN') {
      // Check aadhaar uniqueness
      const [aadhDup] = await conn.query('SELECT citizen_id FROM citizens WHERE aadhaar_no = ?', [data.aadhaar_no]);
      if (aadhDup.length) {
        throw Object.assign(new Error('Aadhaar already registered'), { statusCode: 409, errors: { aadhaar_no: 'Already exists' } });
      }

      await conn.query(
        `INSERT INTO citizens (user_id, full_name, date_of_birth, gender, aadhaar_no, mobile, email, address, panchayat_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, data.full_name, data.date_of_birth, data.gender, data.aadhaar_no, data.mobile, data.email, data.address, data.panchayat_id]
      );
    }

    return userId;
  });

  await auditService.logAction(req, 'CREATE_USER', 'users', createdUserId, `Admin created user ${data.username} as ${data.role}`);

  return success(res, {
    user_id: createdUserId,
    username: data.username,
    role: data.role,
    email: data.email,
    mobile: data.mobile,
    key_fingerprint: newOfficerFingerprint
  }, 'User created successfully', 201);
}

async function updateUser(req, res) {
  const userId = Number(req.params.id);
  const data = req.body;

  const users = await db.query(
    'SELECT u.user_id, r.role_name FROM users u JOIN roles r ON u.role_id = r.role_id WHERE u.user_id = ?',
    [userId]
  );
  if (!users.length) return error(res, 'User not found', {}, 404);

  const roleName = users[0].role_name;

  await db.withTransaction(async (conn) => {
    if (data.email || data.mobile || data.status) {
      const updates = [];
      const params = [];
      if (data.email) {
        updates.push('email = ?');
        params.push(data.email);
      }
      if (data.mobile) {
        updates.push('mobile = ?');
        params.push(data.mobile);
      }
      if (data.status) {
        updates.push('status = ?');
        params.push(data.status);
      }
      if (updates.length) {
        await conn.query(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, [...params, userId]);
      }
    }

    if (roleName === 'OFFICER') {
      const offUpdates = [];
      const offParams = [];
      if (data.full_name) { offUpdates.push('full_name = ?'); offParams.push(data.full_name); }
      if (data.designation) { offUpdates.push('designation = ?'); offParams.push(data.designation); }
      if (data.panchayat_id) { offUpdates.push('panchayat_id = ?'); offParams.push(data.panchayat_id); }
      if (data.email) { offUpdates.push('email = ?'); offParams.push(data.email); }
      if (data.mobile) { offUpdates.push('mobile = ?'); offParams.push(data.mobile); }
      if (data.status) { offUpdates.push('status = ?'); offParams.push(data.status); }
      if (offUpdates.length) {
        await conn.query(`UPDATE panchayat_officers SET ${offUpdates.join(', ')} WHERE user_id = ?`, [...offParams, userId]);
      }
    } else if (roleName === 'CITIZEN') {
      const citUpdates = [];
      const citParams = [];
      if (data.full_name) { citUpdates.push('full_name = ?'); citParams.push(data.full_name); }
      if (data.address) { citUpdates.push('address = ?'); citParams.push(data.address); }
      if (data.panchayat_id) { citUpdates.push('panchayat_id = ?'); citParams.push(data.panchayat_id); }
      if (data.email) { citUpdates.push('email = ?'); citParams.push(data.email); }
      if (data.mobile) { citUpdates.push('mobile = ?'); citParams.push(data.mobile); }
      if (citUpdates.length) {
        await conn.query(`UPDATE citizens SET ${citUpdates.join(', ')} WHERE user_id = ?`, [...citParams, userId]);
      }
    }
  });

  await auditService.logAction(req, 'UPDATE_USER', 'users', userId, `Admin updated user details for ID ${userId}`);
  return success(res, null, 'User updated successfully');
}

async function updateUserStatus(req, res) {
  const targetId = Number(req.params.id);
  const { status } = req.body;

  if (targetId === req.user.user_id) {
    return error(res, 'Cannot deactivate your own account', {}, 400);
  }

  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    return error(res, 'Status must be ACTIVE or INACTIVE', {}, 400);
  }

  await db.withTransaction(async (conn) => {
    await conn.query('UPDATE users SET status = ? WHERE user_id = ?', [status, targetId]);
    await conn.query('UPDATE panchayat_officers SET status = ? WHERE user_id = ?', [status, targetId]);
  });

  await auditService.logAction(req, 'CHANGE_USER_STATUS', 'users', targetId, `Status changed to ${status}`);
  return success(res, null, `User status updated to ${status}`);
}

async function resetUserPassword(req, res) {
  const targetId = Number(req.params.id);
  const { new_password } = req.body;

  const users = await db.query('SELECT user_id, username FROM users WHERE user_id = ?', [targetId]);
  if (!users.length) return error(res, 'User not found', {}, 404);

  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(new_password, salt);

  await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, targetId]);
  await auditService.logAction(req, 'RESET_PASSWORD', 'users', targetId, `Admin reset password for user ${users[0].username}`);

  return success(res, null, 'Password reset successfully');
}

/* =========================================================================
   2. PANCHAYAT MANAGEMENT
   ========================================================================= */

async function getPanchayats(req, res) {
  const { search, status } = req.query;

  let whereClauses = ['1=1'];
  const params = [];

  if (status) {
    whereClauses.push('p.status = ?');
    params.push(status);
  }
  if (search) {
    whereClauses.push('(p.panchayat_name LIKE ? OR p.panchayat_code LIKE ? OR p.district LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const sql = `
    SELECT p.panchayat_id, p.panchayat_name, p.panchayat_code, p.district, p.state,
           p.address, p.contact_no, p.status,
           (SELECT COUNT(*) FROM panchayat_officers o WHERE o.panchayat_id = p.panchayat_id AND o.status = 'ACTIVE') as officer_count,
           (SELECT COUNT(*) FROM citizens c WHERE c.panchayat_id = p.panchayat_id) as citizen_count
    FROM panchayats p
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY p.panchayat_name ASC
  `;
  const items = await db.query(sql, params);
  return success(res, items);
}

async function createPanchayat(req, res) {
  const data = req.body;

  const dup = await db.query('SELECT panchayat_id FROM panchayats WHERE panchayat_code = ?', [data.panchayat_code]);
  if (dup.length) {
    return error(res, `Panchayat code '${data.panchayat_code}' already exists`, { panchayat_code: 'Already exists' }, 409);
  }

  const resDb = await db.query(
    `INSERT INTO panchayats (panchayat_name, panchayat_code, district, state, address, contact_no, status)
     VALUES (?, ?, ?, 'Kerala', ?, ?, ?)`,
    [data.panchayat_name, data.panchayat_code, data.district, data.address || null, data.contact_no || null, data.status || 'ACTIVE']
  );

  await auditService.logAction(req, 'CREATE_PANCHAYAT', 'panchayats', resDb.insertId, `Created panchayat ${data.panchayat_name} (${data.panchayat_code})`);

  return success(res, { panchayat_id: resDb.insertId, ...data }, 'Panchayat created successfully', 201);
}

async function updatePanchayat(req, res) {
  const pid = Number(req.params.id);
  const data = req.body;

  const p = await db.query('SELECT panchayat_id FROM panchayats WHERE panchayat_id = ?', [pid]);
  if (!p.length) return error(res, 'Panchayat not found', {}, 404);

  if (data.panchayat_code) {
    const dup = await db.query('SELECT panchayat_id FROM panchayats WHERE panchayat_code = ? AND panchayat_id != ?', [data.panchayat_code, pid]);
    if (dup.length) {
      return error(res, `Panchayat code '${data.panchayat_code}' is in use by another panchayat`, { panchayat_code: 'Already exists' }, 409);
    }
  }

  const fields = [];
  const params = [];
  ['panchayat_name', 'panchayat_code', 'district', 'address', 'contact_no', 'status'].forEach((key) => {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  });

  if (fields.length) {
    await db.query(`UPDATE panchayats SET ${fields.join(', ')} WHERE panchayat_id = ?`, [...params, pid]);
  }

  await auditService.logAction(req, 'UPDATE_PANCHAYAT', 'panchayats', pid, `Updated panchayat ID ${pid}`);
  return success(res, null, 'Panchayat updated successfully');
}

async function updatePanchayatStatus(req, res) {
  const pid = Number(req.params.id);
  const { status } = req.body;

  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    return error(res, 'Status must be ACTIVE or INACTIVE', {}, 400);
  }

  await db.query('UPDATE panchayats SET status = ? WHERE panchayat_id = ?', [status, pid]);
  await auditService.logAction(req, 'CHANGE_PANCHAYAT_STATUS', 'panchayats', pid, `Status changed to ${status}`);
  return success(res, null, `Panchayat status updated to ${status}`);
}

/* =========================================================================
   3. CERTIFICATE TYPES MANAGEMENT
   ========================================================================= */

async function getAdminCertificateTypes(req, res) {
  const items = await db.query(`
    SELECT certificate_type_id, certificate_code, certificate_name, description,
           required_documents, verification_parties, validity_months, status
    FROM certificate_types
    ORDER BY certificate_type_id ASC
  `);

  const formatted = items.map((r) => ({
    ...r,
    required_documents: typeof r.required_documents === 'string'
      ? JSON.parse(r.required_documents)
      : r.required_documents,
    verification_parties: typeof r.verification_parties === 'string'
      ? JSON.parse(r.verification_parties)
      : r.verification_parties
  }));

  return success(res, formatted);
}

async function updateCertificateType(req, res) {
  const id = Number(req.params.id);
  const data = req.body;

  const existing = await db.query('SELECT certificate_type_id FROM certificate_types WHERE certificate_type_id = ?', [id]);
  if (!existing.length) return error(res, 'Certificate type not found', {}, 404);

  await db.query(
    `UPDATE certificate_types SET
      certificate_name = ?,
      description = ?,
      validity_months = ?,
      status = ?,
      required_documents = ?,
      verification_parties = ?
     WHERE certificate_type_id = ?`,
    [
      data.certificate_name,
      data.description || null,
      data.validity_months,
      data.status,
      JSON.stringify(data.required_documents),
      JSON.stringify(data.verification_parties),
      id
    ]
  );

  await auditService.logAction(req, 'UPDATE_CERTIFICATE_TYPE', 'certificate_types', id, `Updated certificate type ${data.certificate_name}`);
  return success(res, null, 'Certificate type updated successfully');
}

/* =========================================================================
   4. MASTER DATA MANAGEMENT
   ========================================================================= */

async function getAdminMasterData(req, res) {
  const { category } = req.query;
  let sql = 'SELECT master_id, category, code, `value`, description, status FROM master_data';
  const params = [];

  if (category) {
    sql += ' WHERE category = ?';
    params.push(category.toUpperCase());
  }

  sql += ' ORDER BY category ASC, master_id ASC';
  const rows = await db.query(sql, params);
  return success(res, rows);
}

async function createMasterData(req, res) {
  const data = req.body;

  const dup = await db.query(
    'SELECT master_id FROM master_data WHERE category = ? AND code = ?',
    [data.category, data.code]
  );
  if (dup.length) {
    return error(res, `Code '${data.code}' already exists in category '${data.category}'`, { code: 'Already exists' }, 409);
  }

  const resDb = await db.query(
    'INSERT INTO master_data (category, code, `value`, description, status) VALUES (?, ?, ?, ?, ?)',
    [data.category, data.code, data.value, data.description || null, data.status || 'ACTIVE']
  );

  await auditService.logAction(req, 'CREATE_MASTER_DATA', 'master_data', resDb.insertId, `Created ${data.category}/${data.code}`);
  return success(res, { master_id: resDb.insertId, ...data }, 'Master data item created', 201);
}

async function updateMasterData(req, res) {
  const id = Number(req.params.id);
  const data = req.body;

  const existing = await db.query('SELECT master_id FROM master_data WHERE master_id = ?', [id]);
  if (!existing.length) return error(res, 'Item not found', {}, 404);

  const updates = [];
  const params = [];
  if (data.value !== undefined) { updates.push('`value` = ?'); params.push(data.value); }
  if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
  if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }

  if (updates.length) {
    await db.query(`UPDATE master_data SET ${updates.join(', ')} WHERE master_id = ?`, [...params, id]);
  }

  await auditService.logAction(req, 'UPDATE_MASTER_DATA', 'master_data', id, `Updated master data item ${id}`);
  return success(res, null, 'Master data updated successfully');
}

async function updateMasterDataStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    return error(res, 'Status must be ACTIVE or INACTIVE', {}, 400);
  }

  await db.query('UPDATE master_data SET status = ? WHERE master_id = ?', [status, id]);
  await auditService.logAction(req, 'CHANGE_MASTER_DATA_STATUS', 'master_data', id, `Status set to ${status}`);
  return success(res, null, `Master data status updated to ${status}`);
}

/* =========================================================================
   5. AUDIT LOGS
   ========================================================================= */

async function getAuditLogs(req, res) {
  const { user_id, action, from, to } = req.query;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const offset = (page - 1) * limit;

  let whereClauses = ['1=1'];
  const params = [];

  if (user_id) {
    whereClauses.push('a.user_id = ?');
    params.push(Number(user_id));
  }
  if (action) {
    whereClauses.push('a.`action` LIKE ?');
    params.push(`%${action}%`);
  }
  if (from) {
    whereClauses.push('a.action_time >= ?');
    params.push(from);
  }
  if (to) {
    whereClauses.push('a.action_time <= ?');
    params.push(to);
  }

  const whereSql = whereClauses.join(' AND ');

  const countRows = await db.query(`SELECT COUNT(*) as total FROM audit_logs a WHERE ${whereSql}`, params);
  const total = countRows[0].total;

  const sql = `
    SELECT a.log_id, a.user_id, a.\`action\`, a.table_name, a.record_id,
           a.ip_address, a.description, a.action_time,
           u.username, r.role_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.user_id
    LEFT JOIN roles r ON u.role_id = r.role_id
    WHERE ${whereSql}
    ORDER BY a.action_time DESC
    LIMIT ? OFFSET ?
  `;
  const items = await db.query(sql, [...params, limit, offset]);

  return paginated(res, items, total, page, limit);
}

/* =========================================================================
   6. STATS (Admin Dashboard overview)
   ========================================================================= */

async function getStats(req, res) {
  const usersRows = await db.query('SELECT COUNT(*) as c FROM users');
  const officersRows = await db.query('SELECT COUNT(*) as c FROM panchayat_officers WHERE status = "ACTIVE"');
  const citizensRows = await db.query('SELECT COUNT(*) as c FROM citizens');
  const panchayatsRows = await db.query('SELECT COUNT(*) as c FROM panchayats WHERE status = "ACTIVE"');
  const applicationsRows = await db.query('SELECT COUNT(*) as c FROM applications');
  const verificationsRows = await db.query('SELECT COUNT(*) as c FROM verification_requests');

  return success(res, {
    total_users: Number(usersRows[0].c),
    total_officers: Number(officersRows[0].c),
    total_citizens: Number(citizensRows[0].c),
    total_panchayats: Number(panchayatsRows[0].c),
    total_applications: Number(applicationsRows[0].c),
    total_verifications: Number(verificationsRows[0].c)
  });
}

module.exports = {
  // schemas
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  createPanchayatSchema,
  updatePanchayatSchema,
  updateCertTypeSchema,
  masterDataSchema,

  // handlers
  getUsers,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,

  getPanchayats,
  createPanchayat,
  updatePanchayat,
  updatePanchayatStatus,

  getAdminCertificateTypes,
  updateCertificateType,

  getAdminMasterData,
  createMasterData,
  updateMasterData,
  updateMasterDataStatus,

  getAuditLogs,
  getStats
};
