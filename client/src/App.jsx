import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet // Import Outlet for layout routes
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext'; // useAuth still needed in child components/layouts
import { Toaster } from 'react-hot-toast';

import NavBar from './components/NavBar'; // Assuming this exists

// Import Page Components
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import UploadPage from './pages/UploadPage';
import SettingsPage from './pages/SettingsPage';
import ArtworkDetailsPage from './pages/ArtworkDetailsPage'; // Import the new ArtworkDetailsPage

// --- Layout Component for Authenticated Users ---
// This component will render the NavBar and the nested route content (Outlet)
function AuthenticatedLayout() {
    const { isAuthenticated } = useAuth(); // Check auth status here

    // You could add more sophisticated loading checks if needed
    if (!isAuthenticated) {
        // This should theoretically not be reached if ProtectedRoute works,
        // but acts as a safeguard or for direct access attempts.
        return <Navigate to="/login" replace />;
    }

    return (
        <>
            <NavBar /> 
            <main>
                 <Outlet /> 
            </main>
        </>
    );
}

// --- Protected Route Logic Component ---
function ProtectedRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return <div>Loading Authentication...</div>; // Or a spinner component
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // If authenticated, render the child component (the actual page)
    return children;
}

// --- Artist Only Route Logic Component ---
function ArtistOnlyRoute({ children }) {
     const { isAuthenticated, isLoading, user } = useAuth();

     if (isLoading) {
         return <div>Loading User Data...</div>;
     }

     if (!isAuthenticated) {
         return <Navigate to="/login" replace />;
     }

     if (user?.role !== 'artist') {
          // toast.error("Access Denied: Artist role required.");
          return <Navigate to="/" replace />; // Redirect non-artists (e.g., to home)
     }

     return children; // Render the child if user is an authenticated artist
}


// --- Main App Structure ---
function App() {
    // No need for useAuth() here anymore

    return (
        <Router>
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/*  */}
                <Route element={<AuthenticatedLayout />}> {/* s */}
                    <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                    <Route path="/users/:username" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} /> {/* */}
                    <Route
                        path="/upload"
                        element={
                            <ArtistOnlyRoute> {/* Specific protection for artists */}
                                <UploadPage />
                            </ArtistOnlyRoute>
                        }
                    />
                    <Route path="/artworks/:artworkId" element={<ProtectedRoute><ArtworkDetailsPage /></ProtectedRoute>} /> {/* Fixed route path */}
                     {/* */}
                </Route>

                {/* Catch-all or Not Found - Render outside AuthenticatedLayout if NavBar shouldn't show */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
            <Toaster position="top-center" /* ... options ... */ />
        </Router>
    );
}

// provides the AuthContext
function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWrapper;