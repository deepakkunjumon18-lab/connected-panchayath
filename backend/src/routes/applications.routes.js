const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const applicationsController = require('../controllers/applications.controller');

// Public tracking
router.get('/track/:appNo', applicationsController.trackApplication);

// Citizen application submission
router.post(
  '/',
  authenticate,
  authorize('CITIZEN'),
  upload.array('files', 12),
  applicationsController.createApplication
);

// List applications (Citizen own, Officer home panchayat, Admin all)
router.get('/', authenticate, applicationsController.getApplications);

// Application details by ID
router.get('/:id', authenticate, applicationsController.getApplicationById);

// Verify or reject a document (Home Officer only)
router.patch(
  '/:id/documents/:docId/verify',
  authenticate,
  authorize('OFFICER'),
  applicationsController.verifyDocument
);

// Decide on application (Approve or Reject - Home Officer only)
router.post(
  '/:id/decision',
  authenticate,
  authorize('OFFICER'),
  applicationsController.decideApplication
);

// Issue certificate (Home Officer only)
router.post(
  '/:id/issue-certificate',
  authenticate,
  authorize('OFFICER'),
  applicationsController.issueCertificate
);

module.exports = router;
