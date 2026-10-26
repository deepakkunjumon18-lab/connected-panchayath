const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const { error } = require('./utils/apiResponse');

// Routes
const authRoutes = require('./routes/auth.routes');
const panchayatsRoutes = require('./routes/panchayats.routes');
const certificateTypesRoutes = require('./routes/certificateTypes.routes');
const masterDataRoutes = require('./routes/masterData.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const adminRoutes = require('./routes/admin.routes');
const applicationsRoutes = require('./routes/applications.routes');
const certificatesRoutes = require('./routes/certificates.routes');
const documentsRoutes = require('./routes/documents.routes');
const verificationRoutes = require('./routes/verification.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const reportsRoutes = require('./routes/reports.routes');
const officerRoutes = require('./routes/officer.routes');

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true
}));
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Connected Panchayat API is healthy',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/panchayats', panchayatsRoutes);
app.use('/api/certificate-types', certificateTypesRoutes);
app.use('/api/master-data', masterDataRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/verification-requests', verificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/officer', officerRoutes);

// 404 Handler
app.use((req, res) => {
  return error(res, `Route not found: ${req.method} ${req.originalUrl}`, {}, 404);
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
