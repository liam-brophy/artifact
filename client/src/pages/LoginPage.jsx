import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // --- Handler for Email/Password Login ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, { // Added slash
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
      }
      if (data.access_token && data.user) {
        login(data.access_token, data.refresh_token, data.user);
        navigate('/');
      } else {
        throw new Error("Login response missing token or user data.");
      }
    } catch (err) {
      console.error("Email/Username/Password Login failed:", err);
      setError(err.message || "Failed to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- Handler for Google Sign-In Success (Callback from Google) ---
  const handleGoogleSignInSuccess = async (googleResponse) => {
    console.log("Google Sign-In Success Callback Received:", googleResponse);
    const id_token = googleResponse.credential;
    setError(null);
    // setLoadingGoogle(true); // Optional separate loading
    try {
      const apiResponse = await fetch(`${API_BASE_URL}/auth/google`, { // Added slash
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: id_token }),
      });
      const data = await apiResponse.json();
      if (!apiResponse.ok) {
        throw new Error(data.error?.message || `Google Sign-In failed on backend (Status: ${apiResponse.status})`);
      }
      if (data.access_token && data.user) {
        login(data.access_token, data.refresh_token, data.user);
        navigate('/');
      } else {
        throw new Error("Backend response missing token or user data after Google Sign-In.");
      }
    } catch (err) {
      console.error("Google Sign-In Backend Call Failed:", err);
      setError(err.message || 'An error occurred during Google Sign-In.');
    } finally {
      // setLoadingGoogle(false); // Optional separate loading
    }
  };

  // --- useEffect Hook to Initialize Google Sign-In ---
  useEffect(() => {
    if (!window.google) { console.error("Google Identity Services library not loaded."); return; }
    if (!GOOGLE_CLIENT_ID) { console.error("Google Client ID is missing."); setError("Google Sign-In is not configured."); return; }
    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignInSuccess,
      });
      window.google.accounts.id.renderButton(
        document.getElementById("googleSignInButtonContainer"),
        { theme: "outline", size: "large", type: "standard", width: '300px' } // Adjust width if needed or use CSS
      );
    } catch (initError) { console.error("Error initializing Google Sign-In:", initError); setError("Failed to initialize Google Sign-In."); }
  }, []);

  return (
    // Added auth-page wrapper
    <div className="auth-page">
      <div className="auth-container"> {/* Changed from div to auth-container */}
        <h3 className="auth-title">Login to your account</h3> {/* Added class */}

        {/* --- Email/Password Form --- */}
        <form onSubmit={handleSubmit} className="auth-form"> {/* Added class */}
          <div className="form-group"> {/* Added class */}
            <label htmlFor="email" className="form-label">Email</label> {/* Added class */}
            <input
              type="email"
              placeholder="you@example.com"
              id="email"
              className="form-input" // Added class
              onChange={(e) => setEmail(e.target.value)}
              value={email}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group"> {/* Added class */}
            <label htmlFor="password" className="form-label">Password</label> {/* Added class */}
            <input
              type="password"
              placeholder="••••••••"
              id="password"
              className="form-input" // Added class
              onChange={(e) => setPassword(e.target.value)}
              value={password}
              required
              disabled={loading}
            />
          </div>

          {/* Error Message Display - Moved inside container, before actions */}
          {error && <p className="error-message">{error}</p>}

          <div className="form-actions"> {/* Added class */}
            <button type="submit" className="btn btn-primary" disabled={loading}> {/* Added classes */}
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <Link to="/register" className="auth-link"> {/* Added class */}
              Don't have an account? Register
            </Link>
          </div>
        </form>

        {/* --- Separator --- */}
        <div className="auth-separator">OR</div> {/* Added class */}

        {/* --- Google Sign-In Button Container --- */}
        <div className="google-signin-container"> {/* Added class */}
          <div id="googleSignInButtonContainer"></div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;