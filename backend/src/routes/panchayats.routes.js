const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const panchayatsController = require('../controllers/panchayats.controller');

router.get('/public', asyncHandler(panchayatsController.getPublicPanchayats));
router.get('/directory', authenticate, authorize('OFFICER', 'ADMIN'), asyncHandler(panchayatsController.getPanchayatDirectory));

module.exports = router;
