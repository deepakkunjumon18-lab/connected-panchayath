const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../config/db');
const env = require('../config/env');
const { success, error } = require('../utils/apiResponse');
const auditService = require('../services/audit.service');

// Zod schemas
const registerSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Mobile must be a valid 10-digit Indian number starting with 6-9'),
  email: z.string().email('Invalid email address').max(100),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and digit'),
  aadhaar_no: z.string().regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits'),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string().min(5, 'Address is too short'),
  panchayat_id: z.number().int().positive('Valid panchayat is required')
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username, email, or mobile is required'),
  password: z.string().min(1, 'Password is required'),
  login_as: z.enum(['OFFICIAL', 'CITIZEN'], {
    errorMap: () => ({ message: 'login_as must be either OFFICIAL or CITIZEN' })
  })
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'New password must contain uppercase, lowercase, and digit')
});

const updateProfileSchema = z.object({
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().or(z.literal('')),
  date_of_birth: z.string().optional().or(z.literal(''))
});

/**
 * Register a new Citizen
 */
async function register(req, res) {
  const data = req.body;

  // Check if panchayat exists and is active
  const panchayats = await db.query(
    'SELECT panchayat_id, panchayat_name, panchayat_code FROM panchayats WHERE panchayat_id = ? AND status = "ACTIVE"',
    [data.panchayat_id]
  );
  if (!panchayats.length) {
    return error(res, 'Selected panchayat is invalid or inactive', { panchayat_id: 'Invalid panchayat' }, 400);
  }

  // Check unique constraints: mobile, email, aadhaar
  const existingUsers = await db.query(
    'SELECT username, email, mobile FROM users WHERE mobile = ? OR email = ? OR username = ?',
    [data.mobile, data.email, data.mobile]
  );
  if (existingUsers.length > 0) {
    const existing = existingUsers[0];
    const field = existing.mobile === data.mobile ? 'mobile' : 'email';
    return error(res, `A user with this ${field} already exists`, { [field]: `Already registered` }, 409);
  }

  const existingCitizens = await db.query(
    'SELECT aadhaar_no FROM citizens WHERE aadhaar_no = ?',
    [data.aadhaar_no]
  );
  if (existingCitizens.length > 0) {
    return error(res, 'A citizen with this Aadhaar number already exists', { aadhaar_no: 'Aadhaar already registered' }, 409);
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(data.password, salt);

  // Transaction for user + citizen insert
  const result = await db.withTransaction(async (conn) => {
    // Role 1 is CITIZEN
    const [userRes] = await conn.query(
      `INSERT INTO users (username, password_hash, email, mobile, role_id, status)
       VALUES (?, ?, ?, ?, 1, 'ACTIVE')`,
      [data.mobile, passwordHash, data.email, data.mobile]
    );
    const userId = userRes.insertId;

    const [citRes] = await conn.query(
      `INSERT INTO citizens (user_id, full_name, date_of_birth, gender, aadhaar_no, mobile, email, address, panchayat_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, data.full_name, data.date_of_birth, data.gender, data.aadhaar_no, data.mobile, data.email, data.address, data.panchayat_id]
    );
    const citizenId = citRes.insertId;

    return { userId, citizenId };
  });

  const p = panchayats[0];
  const tokenPayload = {
    user_id: result.userId,
    role: 'CITIZEN',
    panchayat_id: data.panchayat_id,
    officer_id: null,
    citizen_id: result.citizenId
  };

  const token = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

  await auditService.logAction(req, 'REGISTER', 'citizens', result.citizenId, `Citizen ${data.full_name} registered`);

  return success(res, {
    token,
    user: {
      user_id: result.userId,
      role: 'CITIZEN',
      full_name: data.full_name,
      email: data.email,
      mobile: data.mobile,
      panchayat_id: data.panchayat_id,
      panchayat_name: p.panchayat_name,
      panchayat_code: p.panchayat_code,
      officer_id: null,
      citizen_id: result.citizenId,
      designation: null,
      date_of_birth: data.date_of_birth,
      gender: data.gender,
      address: data.address,
      aadhaar_no: data.aadhaar_no,
      aadhaar_masked: `XXXX XXXX ${String(data.aadhaar_no).slice(-4)}`
    }
  }, 'Registration successful', 201);
}

/**
 * Login
 */
async function login(req, res) {
  const { identifier, password, login_as } = req.body;

  // Find user by username, mobile, or email
  const users = await db.query(
    `SELECT u.user_id, u.username, u.password_hash, u.email, u.mobile, u.role_id, u.status,
            r.role_name
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.username = ? OR u.mobile = ? OR u.email = ?`,
    [identifier, identifier, identifier]
  );

  if (!users.length) {
    return error(res, 'Invalid credentials', {}, 401);
  }

  const user = users[0];

  // Role validation based on tab
  if (login_as === 'OFFICIAL') {
    if (user.role_name !== 'OFFICER' && user.role_name !== 'ADMIN') {
      return error(res, 'Please use the correct login tab', {}, 403);
    }
  } else if (login_as === 'CITIZEN') {
    if (user.role_name !== 'CITIZEN') {
      return error(res, 'Please use the correct login tab', {}, 403);
    }
  }

  // Active check
  if (user.status !== 'ACTIVE') {
    return error(res, 'Your account is inactive. Please contact administration.', {}, 403);
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return error(res, 'Invalid credentials', {}, 401);
  }

  // Update last_login_at
  await db.query('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [user.user_id]);

  const profile = await fetchUserProfile(user.user_id);

  const tokenPayload = {
    user_id: user.user_id,
    role: user.role_name,
    panchayat_id: profile ? profile.panchayat_id : null,
    officer_id: profile ? profile.officer_id : null,
    citizen_id: profile ? profile.citizen_id : null
  };

  const token = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

  await auditService.logAction(user.user_id, 'LOGIN', 'users', user.user_id, `User ${user.username} logged in as ${user.role_name}`);

  return success(res, { token, user: profile }, 'Login successful');
}

/**
 * Helper to fetch complete, consistent user profile
 */
async function fetchUserProfile(userId) {
  const users = await db.query(
    `SELECT u.user_id, u.username, u.email, u.mobile, u.status, u.created_at, u.last_login_at, r.role_name
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.user_id = ?`,
    [userId]
  );

  if (!users.length) {
    return null;
  }

  const user = users[0];
  const profile = {
    user_id: user.user_id,
    username: user.username,
    role: user.role_name,
    email: user.email,
    mobile: user.mobile,
    status: user.status,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
    full_name: user.username,
    panchayat_id: null,
    panchayat_name: null,
    panchayat_code: null,
    officer_id: null,
    citizen_id: null,
    designation: null,
    date_of_birth: null,
    gender: null,
    address: null,
    aadhaar_no: null,
    aadhaar_masked: null,
    district: null
  };

  if (user.role_name === 'CITIZEN') {
    const citizens = await db.query(
      `SELECT c.citizen_id, c.full_name, c.date_of_birth, c.gender, c.aadhaar_no, c.address,
              c.panchayat_id, p.panchayat_name, p.panchayat_code, p.district
       FROM citizens c
       JOIN panchayats p ON c.panchayat_id = p.panchayat_id
       WHERE c.user_id = ?`,
      [userId]
    );
    if (citizens.length) {
      const c = citizens[0];
      profile.citizen_id = c.citizen_id;
      profile.full_name = c.full_name;
      profile.date_of_birth = c.date_of_birth;
      profile.gender = c.gender;
      profile.address = c.address;
      profile.aadhaar_no = c.aadhaar_no;
      profile.aadhaar_masked = `XXXX XXXX ${c.aadhaar_no ? String(c.aadhaar_no).slice(-4) : '1234'}`;
      profile.panchayat_id = c.panchayat_id;
      profile.panchayat_name = c.panchayat_name;
      profile.panchayat_code = c.panchayat_code;
      profile.district = c.district;
    }
  } else if (user.role_name === 'OFFICER') {
    const officers = await db.query(
      `SELECT o.officer_id, o.full_name, o.designation, o.employee_id, o.panchayat_id,
              o.key_fingerprint, p.panchayat_name, p.panchayat_code, p.district
       FROM panchayat_officers o
       JOIN panchayats p ON o.panchayat_id = p.panchayat_id
       WHERE o.user_id = ?`,
      [userId]
    );
    if (officers.length) {
      const o = officers[0];
      profile.officer_id = o.officer_id;
      profile.full_name = o.full_name;
      profile.designation = o.designation;
      profile.employee_id = o.employee_id;
      profile.key_fingerprint = o.key_fingerprint;
      profile.panchayat_id = o.panchayat_id;
      profile.panchayat_name = o.panchayat_name;
      profile.panchayat_code = o.panchayat_code;
      profile.district = o.district;
    }
  } else if (user.role_name === 'ADMIN') {
    profile.full_name = 'System Administrator';
  }

  return profile;
}

/**
 * Get current user profile
 */
async function getMe(req, res) {
  const userId = req.user.user_id;
  const profile = await fetchUserProfile(userId);

  if (!profile) {
    return error(res, 'User not found', {}, 404);
  }

  return success(res, profile);
}

/**
 * Change Password
 */
async function changePassword(req, res) {
  const userId = req.user.user_id;
  const { current_password, new_password } = req.body;

  const users = await db.query('SELECT password_hash FROM users WHERE user_id = ?', [userId]);
  if (!users.length) {
    return error(res, 'User not found', {}, 404);
  }

  const isMatch = await bcrypt.compare(current_password, users[0].password_hash);
  if (!isMatch) {
    return error(res, 'Current password is incorrect', { current_password: 'Incorrect password' }, 400);
  }

  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(new_password, salt);

  await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, userId]);
  await auditService.logAction(req, 'CHANGE_PASSWORD', 'users', userId, 'Password updated');

  return success(res, { success: true }, 'Password changed successfully');
}

/**
 * Update Profile
 */
async function updateProfile(req, res) {
  const userId = req.user.user_id;
  const role = req.user.role;
  const { email, address, gender, date_of_birth } = req.body;

  if (role === 'CITIZEN') {
    if (email && email.trim()) {
      const trimmedEmail = email.trim();
      const existing = await db.query('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [trimmedEmail, userId]);
      if (existing.length) {
        return error(res, 'Email already in use by another account', { email: 'Email already exists' }, 409);
      }
      await db.query('UPDATE users SET email = ? WHERE user_id = ?', [trimmedEmail, userId]);
      await db.query('UPDATE citizens SET email = ? WHERE user_id = ?', [trimmedEmail, userId]);
    }

    if (address !== undefined) {
      await db.query('UPDATE citizens SET address = ? WHERE user_id = ?', [address.trim(), userId]);
    }

    if (gender) {
      await db.query('UPDATE citizens SET gender = ? WHERE user_id = ?', [gender, userId]);
    }

    if (date_of_birth && date_of_birth.trim()) {
      await db.query('UPDATE citizens SET date_of_birth = ? WHERE user_id = ?', [date_of_birth.trim().slice(0, 10), userId]);
    }

    await auditService.logAction(req, 'UPDATE_PROFILE', 'citizens', req.user.citizen_id, 'Citizen updated profile');
  } else if (role === 'OFFICER') {
    if (email && email.trim()) {
      const trimmedEmail = email.trim();
      const existing = await db.query('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [trimmedEmail, userId]);
      if (existing.length) {
        return error(res, 'Email already in use by another account', { email: 'Email already exists' }, 409);
      }
      await db.query('UPDATE users SET email = ? WHERE user_id = ?', [trimmedEmail, userId]);
      await db.query('UPDATE panchayat_officers SET email = ? WHERE user_id = ?', [trimmedEmail, userId]);
    }
  }

  const updatedProfile = await fetchUserProfile(userId);
  return success(res, updatedProfile || { success: true }, 'Profile updated successfully');
}

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  register,
  login,
  getMe,
  changePassword,
  updateProfile
};
