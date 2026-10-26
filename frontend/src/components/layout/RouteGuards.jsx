import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../ui/Spinner';

export function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading, isAuthenticated, getHomeRoute } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect unauthorised users to their own role home
    return <Navigate to={getHomeRoute(user.role)} replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }) {
  const { user, loading, isAuthenticated, getHomeRoute } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Navigate to={getHomeRoute(user.role)} replace />;
  }

  return children;
}
