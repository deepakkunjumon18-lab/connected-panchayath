const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const reportsController = require('../controllers/reports.controller');

// Officer Reports
router.get('/officer', authenticate, authorize('OFFICER'), asyncHandler(reportsController.getOfficerReports));

module.exports = router;
