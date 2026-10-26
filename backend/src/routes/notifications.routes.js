const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const notificationsController = require('../controllers/notifications.controller');

router.use(authenticate);

router.get('/', asyncHandler(notificationsController.getNotifications));
router.get('/unread-count', asyncHandler(notificationsController.getUnreadCount));
router.patch('/:id/read', asyncHandler(notificationsController.markAsRead));
router.post('/read-all', asyncHandler(notificationsController.markAllAsRead));

module.exports = router;
