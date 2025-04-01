import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext'; // Import AuthProvider

// Import Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
// Import other pages like HomePage, DashboardPage etc. later
// import HomePage from './pages/HomePage';
// import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <AuthProvider> {/* Wrap everything in AuthProvider */}
      <Router>
        {/* Optional: Add a simple Navbar here */}
        <nav>
          <Link to="/">Home</Link>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
          {/* Add conditional links based on auth state later */}
        </nav>

        <Routes>
          {/* Define routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Add routes for home, dashboard, etc. */}
          {/* Example Home Route */}
          <Route path="/" element={<div><h1>Artifact</h1></div>} />
          {/* Example Dashboard Route (implement protection later) */}
          <Route path="/dashboard" element={<div><h1>Dashboard (Protected)</h1></div>} />

          {/* Add a 404 Not Found route */}
          <Route path="*" element={<div><h2>404 Not Found</h2></div>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

