const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const documentsController = require('../controllers/documents.controller');

// Authenticated document stream
router.get('/:id/file', authenticate, documentsController.streamDocumentFile);

module.exports = router;
