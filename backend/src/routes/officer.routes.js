const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const officerController = require('../controllers/officer.controller');

// Officer's own public key
router.get('/me/public-key', authenticate, authorize('OFFICER'), asyncHandler(officerController.getOfficerPublicKey));

module.exports = router;
