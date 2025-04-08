import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import NavBar from './components/NavBar'; // <-- Import NavBar

// Import Page Components
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import UploadPage from './pages/UploadPage';

function App() {
    const { isLoading, isAuthenticated, user } = useAuth();
    console.log('App Routing: isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

    // *** CRITICAL: Handle loading state explicitly ***
    if (isLoading) {
         // Show a global spinner or a blank screen while checking auth
         return <div>Loading Application...</div>;
    }

    return (
        <Router>
            {/* Render NavBar on every page after login */}
            {isAuthenticated && <NavBar />}
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={
                    !isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />
                } />
                <Route path="/register" element={
                    !isAuthenticated ? <RegisterPage /> : <Navigate to="/" replace />
                } />

                {/* Protected Routes */}
                <Route path="/" element={
                    isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />
                } />
                <Route path="/users/:username" element={
                    isAuthenticated ? <ProfilePage /> : <Navigate to="/login" replace state={{ from: location }} />
                } /> <Route
                        path="/upload"
                        element={
                            isAuthenticated ? ( // 1. Check if logged in
                                (user && user.role === 'artist') ? ( // 2. Check if user exists and is an artist
                                    <UploadPage /> // 3. Render UploadPage if artist
                                ) : (
                                    // 4. Logged in BUT NOT an artist - Redirect (e.g., to home)
                                    <Navigate to="/" replace state={{ message: "Access Denied: Artist role required for uploads." }} />
                                    // Or redirect to a specific '/unauthorized' page:
                                    // <Navigate to="/unauthorized" replace state={{ requiredRole: "artist" }}/>
                                )
                            ) : (
                                // 5. Not logged in - Redirect to login
                                <Navigate to="/login" replace />
                            )
                        }
                    />

                {/* Catch-all or Not Found */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </Router>
    );
}

function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWrapper;