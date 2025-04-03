import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation // Import useLocation
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext'; // Your AuthProvider

// Import Layout Components
import Navbar from './components/Navbar';         // Your Navbar component
import ProtectedRoute from './components/ProtectedRoute'; // Your ProtectedRoute component

// Import Page Components
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';       // Your new HomePage
import ProfilePage from './pages/ProfilePage';   // Your new ProfilePage
import UploadPage from './pages/UploadPage';     // Your new UploadPage
import NotFoundPage from './pages/NotFoundPage'; // Your NotFoundPage

// --- Main Layout Component ---
// This component decides whether to show the Navbar and defines the routes
function MainLayout() {
  const location = useLocation();
  const hideNavbarPaths = ['/login', '/register']; // Paths where Navbar should be hidden

  const shouldHideNavbar = hideNavbarPaths.includes(location.pathname);

  return (
    <>
      {!shouldHideNavbar && <Navbar />} {/* Conditionally render Navbar */}

      {/* Routes are defined within the layout */}
      <Routes>
        {/* Public Routes - No Navbar visible */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes - Navbar visible */}
        <Route
          path="/" // Main route after login
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile" // User's own profile page
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload" // Upload page route
          element={
            <ProtectedRoute>
              <UploadPage />
            </ProtectedRoute>
          }
        />
        {/* Add other protected routes here using the same pattern */}
        {/* <Route
          path="/some-other-page"
          element={
            <ProtectedRoute>
              <SomeOtherPage />
            </ProtectedRoute>
          }
        /> */}

        {/* Fallback for Not Found */}
        <Route path="*" element={<NotFoundPage />} /> {/* Render a proper 404 component */}

      </Routes>
    </>
  );
}

// --- Main App Component ---
function App() {
  return (
    <AuthProvider> {/* Provides authentication context */}
      <Router>     {/* Provides routing capabilities */}
        <MainLayout /> {/* Renders the conditional Navbar and Routes */}
      </Router>
    </AuthProvider>
  );
}

export default App;