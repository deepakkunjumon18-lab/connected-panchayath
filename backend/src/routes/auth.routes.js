const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');

router.post(
  '/register',
  validate(authController.registerSchema),
  asyncHandler(authController.register)
);

router.post(
  '/login',
  validate(authController.loginSchema),
  asyncHandler(authController.login)
);

router.get(
  '/me',
  authenticate,
  asyncHandler(authController.getMe)
);

router.post(
  '/change-password',
  authenticate,
  validate(authController.changePasswordSchema),
  asyncHandler(authController.changePassword)
);

router.put(
  '/profile',
  authenticate,
  validate(authController.updateProfileSchema),
  asyncHandler(authController.updateProfile)
);

module.exports = router;
