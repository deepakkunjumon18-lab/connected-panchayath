const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboard.controller');

// Officer Dashboard
router.get('/officer', authenticate, authorize('OFFICER'), asyncHandler(dashboardController.getOfficerDashboard));

// Citizen Dashboard
router.get('/citizen', authenticate, authorize('CITIZEN'), asyncHandler(dashboardController.getCitizenDashboard));

module.exports = router;
