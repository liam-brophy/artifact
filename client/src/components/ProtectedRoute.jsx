import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// children is the component we are trying to render (e.g., <HomePage />)
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth(); // Get user state and loading status
  const location = useLocation(); // Get current location

  if (loading) {
    // Optional: Show a loading spinner while auth state is being determined
    return <div>Loading authentication state...</div>;
  }

  if (!user) {
    // If not logged in, redirect to login page
    // Pass the current location so we can redirect back after login (optional)
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If logged in, render the child component (the protected page)
  return children;
}

export default ProtectedRoute;