import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet // Import Outlet for layout routes
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext'; // useAuth still needed in child components/layouts
import { ThemeProvider, useTheme } from './context/ThemeContext'; // Import ThemeProvider and useTheme
import { Toaster } from 'react-hot-toast';

import NavBar from './components/Navbar'; // Correct casing to match the file name

// Import Page Components
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import UploadPage from './pages/UploadPage';
import SettingsPage from './pages/SettingsPage';
import ArtworkDetailsPage from './pages/ArtworkDetailsPage'; // Import the new ArtworkDetailsPage
import ArtStudio from './components/ArtStudio'; // Import the new ArtStudio component
import SearchPage from './pages/SearchPage'; // Import the SearchPage component
import LavaLampBackground from './components/LavaLampBackground'; // Import the new LavaLampBackground component

// --- Layout Component for Authenticated Users ---
// This component will render the NavBar and the nested route content (Outlet)
function AuthenticatedLayout() {
    const { isAuthenticated, isLoading } = useAuth(); // Check auth status here
    const { isDarkMode } = useTheme(); // Access theme context

    // First handle loading state
    if (isLoading) {
        return <div className="full-page-loader">Loading Authentication...</div>;
    }

    // Then handle unauthenticated state
    if (!isAuthenticated) {
        // This should theoretically not be reached if ProtectedRoute works,
        // but acts as a safeguard or for direct access attempts.
        return <Navigate to="/login" replace />;
    }

    return (
        <div className={`app-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
            <NavBar /> 
            <main>
                 <Outlet /> 
            </main>
        </div>
    );
}

// --- Protected Route Logic Component ---
function ProtectedRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        // Show a loading indicator while authentication status is being determined
        return <div className="full-page-loader">Loading Authentication...</div>;
    }

    if (!isAuthenticated) {
        // Only redirect if we're sure the user isn't authenticated
        return <Navigate to="/login" replace />;
    }

    // If authenticated, render the child component (the actual page)
    return children;
}

// --- Artist Only Route Logic Component ---
function ArtistOnlyRoute({ children }) {
     const { isAuthenticated, isLoading, user } = useAuth();

     if (isLoading) {
         return <div className="full-page-loader">Loading User Data...</div>;
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
        <>
            <LavaLampBackground /> {/* Add the LavaLampBackground component */}
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
                    <Route
                        path="/studio/:artworkId"
                        element={
                            <ArtistOnlyRoute> {/* Only artists can customize artwork */}
                                <ArtStudio />
                            </ArtistOnlyRoute>
                        }
                    />
                    <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
                </Route>

                {/* Catch-all or Not Found - Render outside AuthenticatedLayout if NavBar shouldn't show */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
            <Toaster position="top-center" /* ... options ... */ />
        </>
    );
}

// provides the AuthContext
function AppWrapper() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default AppWrapper;