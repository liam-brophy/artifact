import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet // Import Outlet for layout routes
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import { initializeCsrf } from './services/apiService';

import NavBar from './components/Navbar'; // Correct casing
import LoadingScreen from './components/LoadingScreen'; // Import our new loading component

// Import Page Components
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import UploadPage from './pages/UploadPage';
import SettingsPage from './pages/SettingsPage';
import ArtworkDetailsPage from './pages/ArtworkDetailsPage';
import ArtStudio from './components/ArtStudio';
import SearchPage from './pages/SearchPage';
import LavaLampBackground from './components/LavaLampBackground';

// --- Layout Component for Authenticated Users ---
function AuthenticatedLayout() {
    const { isAuthenticated, isLoading, user } = useAuth();
    const { isDarkMode } = useTheme();

    if (isLoading) {
        return <LoadingScreen message="Loading Authentication..." />;
    }

    // If not authenticated after loading, redirect to login
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Render the layout for authenticated users
    return (
        <div className={`app-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
            <NavBar /> {/* NavBar is part of the authenticated experience */}
            <main>
                <Outlet /> {/* Renders the nested protected route component */}
            </main>
        </div>
    );
}

// --- Layout Component for Auth Pages (No NavBar) ---
function AuthLayout() {
    const { isDarkMode } = useTheme();
    return (
        <div className={`app-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
            <main>
                <Outlet /> {/* Renders the nested auth route component */}
            </main>
        </div>
    );
}

// --- Layout Component for Public Routes ---
function PublicLayout() {
    const { isDarkMode } = useTheme();
    return (
        <div className={`app-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
            <NavBar />
            <main>
                <Outlet /> {/* Renders the nested public route component */}
            </main>
        </div>
    );
}

// --- Artist Only Route Logic Component ---
function ArtistOnlyRoute({ children }) {
     const { isAuthenticated, isLoading, user } = useAuth();

     if (isLoading) {
         return <LoadingScreen message="Loading Artist Profile..." />;
     }

     // Artist routes are implicitly authenticated, but double-check
     if (!isAuthenticated) {
         return <Navigate to="/login" replace />;
     }

     if (user?.role !== 'artist') {
          // toast.error("Access Denied: Artist role required.");
          return <Navigate to="/" replace />; // Redirect non-artists to home
     }

     return children;
}

// --- Main App Structure ---
function App() {
    const auth = useAuth();
    const { isAuthenticated, fetchUserDataAndCollection, user } = auth;
    
    // Single-run effect to check auth status
    useEffect(() => {
        // We'll use localStorage to track if we've already attempted to refresh the auth
        // during this browser session to avoid infinite loops
        const hasRefreshedAuth = localStorage.getItem('auth_refresh_attempted');
        
        if (!isAuthenticated && !hasRefreshedAuth) {
            // Mark that we've attempted to refresh auth in this session
            localStorage.setItem('auth_refresh_attempted', 'true');
            fetchUserDataAndCollection(true);
            
            // Clear this flag after a short delay so we can retry on future page loads if needed
            setTimeout(() => {
                localStorage.removeItem('auth_refresh_attempted');
            }, 10000); // Clear after 10 seconds
        }
    }, []); // Empty dependency array runs once on mount

    return (
        <>
            <LavaLampBackground />
            <Routes>
                {/* Auth Routes without NavBar */}
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                </Route>

                {/* Public routes (including homepage) */}
                <Route element={<PublicLayout />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/artworks/:artworkId" element={<ArtworkDetailsPage />} />
                </Route>
                
                {/* Routes using the Authenticated Layout (NavBar + Auth Check) */}
                <Route element={<AuthenticatedLayout />}>
                    {/* Profile, Settings, etc. require login */}
                    <Route path="/users/:username" element={<ProfilePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    {/* Artist-specific routes are nested within authenticated layout */}
                    <Route
                        path="/upload"
                        element={
                            <ArtistOnlyRoute>
                                <UploadPage />
                            </ArtistOnlyRoute>
                        }
                    />
                    <Route
                        path="/studio/:artworkId"
                        element={
                            <ArtistOnlyRoute>
                                <ArtStudio />
                            </ArtistOnlyRoute>
                        }
                    />
                </Route>

                {/* Catch-all Not Found */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
            <Toaster position="top-center" />
        </>
    );
}

// AppWrapper remains the same
function AppWrapper() {
  useEffect(() => {
    initializeCsrf();
  }, []);

  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

export default AppWrapper;