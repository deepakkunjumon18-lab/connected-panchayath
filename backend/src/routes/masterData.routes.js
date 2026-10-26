const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const masterDataController = require('../controllers/masterData.controller');

router.get('/:category', authenticate, asyncHandler(masterDataController.getMasterDataByCategory));

module.exports = router;
