import React, { useState, useEffect } from 'react'; // Import useEffect
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { API_BASE_URL } from '../config';

// --- Ensure this is set in client/.env ---
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('patron');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false); // For manual registration form
  const navigate = useNavigate();
  const { login } = useAuth(); // Get login function from context

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!username || !email || !password || !confirmPassword || !role) {
      setError("Please fill in all fields."); return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match."); return;
    }
    setLoading(true);
    try {
      // Make sure API_BASE_URL ends with a slash or add one here
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        // Only use credentials if you're handling cookies/sessions
        // credentials: 'include',
        body: JSON.stringify({ username, email, password, role }),
      });
      const data = await response.json();
      if (!response.ok) {
        let errorMessage = data.error?.message || `HTTP error! status: ${response.status}`;
        if (data.error?.details) {
          const details = Object.entries(data.error.details).map(([key, value]) => `${key}: ${value}`).join('; ');
          errorMessage += ` (${details})`;
        }
        throw new Error(errorMessage);
      }
      console.log('Registration successful:', data);
      alert('Registration successful! Please log in.');
      navigate('/login');
    } catch (err) {
      console.error("Registration failed:", err);
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- Handler for Google Sign-In Success (Callback from Google) ---
  // --- THIS IS THE SAME FUNCTION AS IN LoginPage.jsx ---
  const handleGoogleSignInSuccess = async (googleResponse) => {
    console.log("Google Sign-Up/In Success Callback Received:", googleResponse);
    const id_token = googleResponse.credential;
    setError(null);
    // Optionally set a specific loading state for Google here if needed
    try {
      const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`; // Ensure trailing slash
      // Send the token to your backend /api/auth/google endpoint
      // The backend handles both login and registration for Google users
      const apiResponse = await fetch(`${baseUrl}auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 
          'Accept': 'application/json',
          'Access-Control-Allow-Origin': '*'   },
        body: JSON.stringify({ token: id_token }),
      });
      const data = await apiResponse.json();
      if (!apiResponse.ok) {
        throw new Error(data.error?.message || `Google Sign-Up/In failed on backend (Status: ${apiResponse.status})`);
      }

      // --- Backend Google Auth/Registration Successful ---
      console.log("Backend Google Auth/Register Response:", data);
      if (data.access_token && data.user) {
        // Use the login function from your context to update state and store tokens
        login(data.access_token, data.refresh_token, data.user);
        navigate('/'); // Redirect after successful sign-up/in
      } else {
        throw new Error("Backend response missing token or user data after Google Sign-Up/In.");
      }
    } catch (err) {
      console.error("Google Sign-Up/In Backend Call Failed:", err);
      setError(err.message || 'An error occurred during Google Sign-Up/In.');
    } finally {
       // Optionally stop a specific Google loading state here
    }
  };

  // --- useEffect Hook to Initialize Google Sign-In ---
  // --- THIS IS THE SAME HOOK AS IN LoginPage.jsx ---
  useEffect(() => {
    if (!window.google) { console.error("Google Identity Services library not loaded."); return; }
    if (!GOOGLE_CLIENT_ID) { console.error("Google Client ID is missing."); setError("Google Sign-In is not configured."); return; }
    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignInSuccess, // Use the same callback
      });
      // Render the button in the specific container for the registration page
      window.google.accounts.id.renderButton(
        document.getElementById("googleSignUpButtonContainer"), // Target div for Sign Up button
        { theme: "outline", size: "large", type: "standard", text: "signup_with" } // Change button text
      );
    } catch (initError) { console.error("Error initializing Google Sign-In:", initError); setError("Failed to initialize Google Sign-In."); }
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h3 className="auth-title">Create your account</h3>
        {/* --- Manual Registration Form --- */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Username */}
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input type="text" placeholder="Choose a username" id="username" onChange={(e) => setUsername(e.target.value)} value={username} className="form-input" required disabled={loading} />
          </div>
          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input type="email" placeholder="you@example.com" id="email" onChange={(e) => setEmail(e.target.value)} value={email} className="form-input" required disabled={loading} />
          </div>
          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input type="password" placeholder="Password (min 8 characters)" id="password" onChange={(e) => setPassword(e.target.value)} value={password} className="form-input" required disabled={loading} />
          </div>
          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <input type="password" placeholder="Confirm Password" id="confirmPassword" onChange={(e) => setConfirmPassword(e.target.value)} value={confirmPassword} className="form-input" required disabled={loading} />
          </div>
          {/* Role Selection */}
          <div className="form-group">
            <label className="form-label" htmlFor="role">Register As</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className="form-input" disabled={loading}>
              <option value="patron">Patron (Collector)</option>
              <option value="artist">Artist (Creator)</option>
            </select>
          </div>
          {/* Error Display */}
          {error && <p className="error-message">{error}</p>}
          {/* Form Actions */}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Registering...' : 'Register'}
            </button>
            <Link to="/login" className="auth-link">
              Already have an account? Login
            </Link>
          </div>
        </form>

        {/* --- Separator --- */}
        <div className="auth-separator">OR</div> {/* Added class */}

        {/* --- Google Sign-Up Button Container --- */}
        <div className="google-signin-container"> {/* Use the same container class */}
          {/* Target div for the Google Button - Note the different ID */}
          <div id="googleSignUpButtonContainer"></div>
        </div>

      </div>
    </div>
  );
}

export default RegisterPage;
