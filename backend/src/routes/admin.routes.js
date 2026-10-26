const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/admin.controller');
const reportsController = require('../controllers/reports.controller');

// All admin routes require ADMIN role
router.use(authenticate, authorize('ADMIN'));

// Stats & Reports
router.get('/stats', asyncHandler(adminController.getStats));
router.get('/reports/summary', asyncHandler(reportsController.getAdminReportsSummary));
router.get('/signatures/audit', asyncHandler(reportsController.getAdminSignaturesAudit));

// Users
router.get('/users', asyncHandler(adminController.getUsers));
router.post('/users', validate(adminController.createUserSchema), asyncHandler(adminController.createUser));
router.put('/users/:id', validate(adminController.updateUserSchema), asyncHandler(adminController.updateUser));
router.patch('/users/:id/status', asyncHandler(adminController.updateUserStatus));
router.post('/users/:id/reset-password', validate(adminController.resetPasswordSchema), asyncHandler(adminController.resetUserPassword));

// Panchayats
router.get('/panchayats', asyncHandler(adminController.getPanchayats));
router.post('/panchayats', validate(adminController.createPanchayatSchema), asyncHandler(adminController.createPanchayat));
router.put('/panchayats/:id', validate(adminController.updatePanchayatSchema), asyncHandler(adminController.updatePanchayat));
router.patch('/panchayats/:id/status', asyncHandler(adminController.updatePanchayatStatus));

// Certificate Types
router.get('/certificate-types', asyncHandler(adminController.getAdminCertificateTypes));
router.put('/certificate-types/:id', validate(adminController.updateCertTypeSchema), asyncHandler(adminController.updateCertificateType));

// Master Data
router.get('/master-data', asyncHandler(adminController.getAdminMasterData));
router.post('/master-data', validate(adminController.masterDataSchema), asyncHandler(adminController.createMasterData));
router.put('/master-data/:id', asyncHandler(adminController.updateMasterData));
router.patch('/master-data/:id/status', asyncHandler(adminController.updateMasterDataStatus));

// Audit Logs
router.get('/audit-logs', asyncHandler(adminController.getAuditLogs));

module.exports = router;
