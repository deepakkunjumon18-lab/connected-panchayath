import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './components/layout/RouteGuards';
import ErrorBoundary from './components/common/ErrorBoundary';
import useDocumentTitle from './hooks/useDocumentTitle';

// Layouts
import PublicLayout from './components/layout/PublicLayout';
import CitizenLayout from './components/layout/CitizenLayout';
import OfficerLayout from './components/layout/OfficerLayout';
import AdminLayout from './components/layout/AdminLayout';

// Public Pages
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import TrackApplicationPage from './pages/public/TrackApplicationPage';
import VerifyCertificatePage from './pages/public/VerifyCertificatePage';
import UiKit from './pages/public/UiKit';
import NotFound from './pages/public/NotFound';
import NotificationsPage from './pages/public/NotificationsPage';

// Citizen Pages
import CitizenDashboard from './pages/citizen/CitizenDashboard';
import CitizenProfile from './pages/citizen/CitizenProfile';
import CitizenApply from './pages/citizen/CitizenApply';
import CitizenApplyWizard from './pages/citizen/CitizenApplyWizard';
import CitizenApplications from './pages/citizen/CitizenApplications';
import CitizenApplicationDetail from './pages/citizen/CitizenApplicationDetail';
import CitizenCertificates from './pages/citizen/CitizenCertificates';

// Officer Pages
import OfficerDashboard from './pages/officer/OfficerDashboard';
import OfficerApplications from './pages/officer/OfficerApplications';
import OfficerApplicationDetail from './pages/officer/OfficerApplicationDetail';
import OfficerIncoming from './pages/officer/OfficerIncoming';
import OfficerIncomingDetail from './pages/officer/OfficerIncomingDetail';
import OfficerCertificates from './pages/officer/OfficerCertificates';
import OfficerDirectory from './pages/officer/OfficerDirectory';
import OfficerReports from './pages/officer/OfficerReports';
import OfficerSettings from './pages/officer/OfficerSettings';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPanchayats from './pages/admin/AdminPanchayats';
import AdminCertificateTypes from './pages/admin/AdminCertificateTypes';
import AdminMasterData from './pages/admin/AdminMasterData';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import AdminReports from './pages/admin/AdminReports';
import AdminSignatures from './pages/admin/AdminSignatures';

// Notifications Wrapper adapting to user's layout
function NotificationsLayoutWrapper() {
  const { user } = useAuth();
  if (user?.role === 'ADMIN') {
    return (
      <AdminLayout>
        <NotificationsPage />
      </AdminLayout>
    );
  }
  if (user?.role === 'OFFICER') {
    return (
      <OfficerLayout>
        <NotificationsPage />
      </OfficerLayout>
    );
  }
  return (
    <CitizenLayout>
      <NotificationsPage />
    </CitizenLayout>
  );
}

function AppRoutes() {
  useDocumentTitle();

  return (
    <ErrorBoundary>
      <Routes>
        {/* Public Routes with PublicLayout */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/track" element={<TrackApplicationPage />} />
          <Route path="/track/:appNo" element={<TrackApplicationPage />} />
          <Route path="/verify" element={<VerifyCertificatePage />} />
          <Route path="/verify/:code" element={<VerifyCertificatePage />} />
          <Route path="/ui-kit" element={<UiKit />} />

          {/* Public only (login & register redirect logged-in users to home) */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
        </Route>

        {/* Citizen Routes */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['CITIZEN']}>
              <CitizenLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/citizen" element={<CitizenDashboard />} />
          <Route path="/citizen/apply" element={<CitizenApply />} />
          <Route path="/citizen/apply/:code" element={<CitizenApplyWizard />} />
          <Route path="/citizen/applications" element={<CitizenApplications />} />
          <Route path="/citizen/applications/:id" element={<CitizenApplicationDetail />} />
          <Route path="/citizen/certificates" element={<CitizenCertificates />} />
          <Route path="/citizen/profile" element={<CitizenProfile />} />
        </Route>

        {/* Officer Routes */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['OFFICER']}>
              <OfficerLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/officer" element={<OfficerDashboard />} />
          <Route path="/officer/applications" element={<OfficerApplications />} />
          <Route path="/officer/applications/:id" element={<OfficerApplicationDetail />} />
          <Route path="/officer/incoming" element={<OfficerIncoming />} />
          <Route path="/officer/incoming/:id" element={<OfficerIncomingDetail />} />
          <Route path="/officer/certificates" element={<OfficerCertificates />} />
          <Route path="/officer/directory" element={<OfficerDirectory />} />
          <Route path="/officer/reports" element={<OfficerReports />} />
          <Route path="/officer/settings" element={<OfficerSettings />} />
        </Route>

        {/* Admin Routes */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/panchayats" element={<AdminPanchayats />} />
          <Route path="/admin/certificate-types" element={<AdminCertificateTypes />} />
          <Route path="/admin/master-data" element={<AdminMasterData />} />
          <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/signatures" element={<AdminSignatures />} />
        </Route>

        {/* Shared Notifications Route */}
        <Route
          path="/notifications"
          element={
            <ProtectedRoute allowedRoles={['CITIZEN', 'OFFICER', 'ADMIN']}>
              <NotificationsLayoutWrapper />
            </ProtectedRoute>
          }
        />

        {/* Fallback 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0F172A',
              color: '#FFFFFF',
              borderRadius: '0.75rem',
              fontSize: '0.875rem'
            }
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
