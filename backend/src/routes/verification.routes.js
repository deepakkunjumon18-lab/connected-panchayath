const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const verificationController = require('../controllers/verification.controller');

// All verification request routes require authentication
router.use(authenticate);

// Counts (must come before /:id)
router.get(
  '/counts',
  authorize('OFFICER', 'ADMIN'),
  verificationController.getVerificationCounts
);

// List verification requests (incoming or outgoing)
router.get(
  '/',
  authorize('OFFICER', 'ADMIN'),
  verificationController.getVerificationRequests
);

// Manual verification request creation by officer
router.post(
  '/',
  authorize('OFFICER'),
  verificationController.createVerificationRequest
);

// Check signature validity (spec: /:id/signature-check)
router.get(
  '/:id/signature-check',
  authorize('OFFICER', 'ADMIN'),
  verificationController.checkSignature
);

router.get(
  '/:id/check-signature',
  authorize('OFFICER', 'ADMIN'),
  verificationController.checkSignature
);

// Get single verification request
router.get(
  '/:id',
  authorize('OFFICER', 'ADMIN'),
  verificationController.getVerificationRequestById
);

// Respond with digital signature
router.post(
  '/:id/respond',
  authorize('OFFICER'),
  verificationController.respondVerificationRequest
);

// Send reminder
router.post(
  '/:id/remind',
  authorize('OFFICER'),
  verificationController.remindVerificationRequest
);

// Cancel request
router.post(
  '/:id/cancel',
  authorize('OFFICER'),
  verificationController.cancelVerificationRequest
);

module.exports = router;
