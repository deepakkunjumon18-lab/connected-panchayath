const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const certificatesController = require('../controllers/certificates.controller');

// Public verification (Section 12: ONLY public data endpoint for certificates)
router.get('/verify/:code', certificatesController.verifyCertificate);
router.get('/verify', certificatesController.verifyCertificate);

// Authenticated certificate list (Citizen own, Officer issuing panchayat, Admin all)
router.get('/', authenticate, certificatesController.getCertificates);

// Authenticated certificate download (PDF stream with X-Integrity header)
router.get('/:id/download', authenticate, certificatesController.downloadCertificate);

module.exports = router;
