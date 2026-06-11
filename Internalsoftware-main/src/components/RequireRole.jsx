import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import AccessDenied from './AccessDenied';

export default function RequireRole({ children, allowedRoles, checkHistoryAccess = false }) {
  const { user, role, canViewHistory, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        textAlign: 'center',
        marginTop: 80,
        fontSize: '1.2rem',
        fontWeight: 600,
        color: '#64748b',
        fontFamily: 'system-ui, sans-serif'
      }}>
        Loading permissions...
      </div>
    );
  }

  // If not logged in at all, redirect to login page
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admins always have full access to everything
  if (role === 'admin') {
    return children;
  }

  // If this is the history page, check if this specific user has history access granted
  if (checkHistoryAccess && canViewHistory) {
    return children;
  }

  // Check standard role permissions
  if (allowedRoles && allowedRoles.includes(role)) {
    return children;
  }

  // Fallback: render Access Denied component
  return <AccessDenied />;
}
