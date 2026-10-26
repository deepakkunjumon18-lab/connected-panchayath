const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const certificateTypesController = require('../controllers/certificateTypes.controller');

router.get('/', asyncHandler(certificateTypesController.getCertificateTypes));

module.exports = router;
