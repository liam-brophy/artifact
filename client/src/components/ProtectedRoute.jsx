import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="loading-screen">Verifying your access...</div>;
  }

  if (!isAuthenticated || !user) {
    // Redirect to login and preserve the attempted URL for after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based authorization check
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};