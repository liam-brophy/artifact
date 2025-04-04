import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

// --- Constants ---
const ROLES = {
  PATRON: 'patron',
  ARTIST: 'artist',
};
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_BUTTON_CONTAINER_ID = 'googleSignUpButtonContainer';

// --- Helper to format API errors ---
const formatApiError = (errorData) => {
  let message = errorData?.error?.message || 'An unknown error occurred.';
  if (errorData?.error?.details) {
    const details = Object.entries(errorData.error.details)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
    message += ` (${details})`;
  }
  return message;
};

function RegisterPage() {
  // --- State ---
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState(ROLES.PATRON); // Default role

  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState(null);

  const [googleLoading, setGoogleLoading] = useState(false); // Separate loading for Google
  const [googleError, setGoogleError] = useState(null);

  const navigate = useNavigate();
  const { login } = useAuth(); // Get login function from context

  // --- API Call Functions ---

  const handleManualRegister = async () => {
    setManualError(null);
    // Client-side validation
    if (!username || !email || !password || !confirmPassword || !role) {
      setManualError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setManualError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
       setManualError("Password must be at least 8 characters long.");
       return;
    }


    setManualLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ username, email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(formatApiError(data));
      }

      console.log('Manual registration successful (backend response):', data);
      // Instead of logging in here, prompt user to log in as per original logic
      alert('Registration successful! Please log in with your new credentials.');
      navigate('/login'); // Redirect to login page after successful manual registration

    } catch (err) {
      console.error("Manual Registration failed:", err);
      setManualError(err.message || "Failed to register. Please try again.");
    } finally {
      setManualLoading(false);
    }
  };

  // This function is called by the Google library upon successful sign-in/up
  // It needs to be stable or wrapped in useCallback if dependencies change often,
  // but here role is the main dependency which we *want* it to read fresh.
  const handleGoogleCallback = useCallback(async (googleResponse) => {
    console.log("Google Sign-Up/In Callback Received:", googleResponse);
    const id_token = googleResponse.credential;
    if (!id_token) {
        console.error("Google response missing credential (token).");
        setGoogleError("Failed to get token from Google.");
        return;
    }

    setGoogleError(null);
    setGoogleLoading(true); // Start Google-specific loading

    try {
      console.log(`Sending token and selected role ('${role}') to backend...`); // Log the role being sent

      // Send the token AND the currently selected role to the backend
      const apiResponse = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: {
           'Content-Type': 'application/json',
           'Accept': 'application/json'
        },
        body: JSON.stringify({
          token: id_token,
          role: role // Include the selected role state here
        }),
      });

      const data = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(formatApiError(data));
      }

      // --- Backend Google Auth/Registration Successful ---
      console.log("Backend Google Auth/Register Response:", data);
      if (data.access_token && data.user) {
        // Use the login function from context to update state and store tokens
        login(data.access_token, data.refresh_token, data.user);
        console.log("Login context updated, navigating home.");
        navigate('/'); // Redirect to home/dashboard after successful sign-up/in
      } else {
        // Should not happen if backend response is correct
        throw new Error("Backend response missing token or user data after Google Sign-Up/In.");
      }
    } catch (err) {
      console.error("Google Sign-Up/In Backend Call Failed:", err);
      setGoogleError(err.message || 'An error occurred during Google Sign-Up/In.');
    } finally {
      setGoogleLoading(false); // Stop Google-specific loading
    }
  // Include role in dependency array so the callback always has the latest role
  // This is technically correct with useCallback, ensuring the function passed
  // to Google Init *could* be updated if needed, though Google Init usually runs once.
  // The key is that the function closure captures the role when called.
  }, [role, login, navigate]);


  // --- Event Handlers ---
  const onManualFormSubmit = (e) => {
    e.preventDefault();
    handleManualRegister();
  };

  // --- Effects ---
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.error("VITE_GOOGLE_CLIENT_ID is missing in .env file.");
      setGoogleError("Google Sign-In is not configured properly (Missing Client ID).");
      return;
    }

    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback, // Pass the callback function
          // auto_select: false, // Usually false for registration page
          // ux_mode: 'popup', // Alternative to redirect
        });

        window.google.accounts.id.renderButton(
          document.getElementById(GOOGLE_BUTTON_CONTAINER_ID),
          { theme: "outline", size: "large", type: "standard", text: "signup_with" } // Customize button
        );

        // Optional: Prompt for account selection if needed, useful if auto_select was true
        // window.google.accounts.id.prompt();

      } catch (initError) {
        console.error("Error initializing Google Sign-In:", initError);
        setGoogleError("Failed to initialize Google Sign-In library.");
      }
    } else {
      console.warn("Google Identity Services library not loaded yet or failed to load.");
      // You might want to add a retry mechanism or inform the user
      setGoogleError("Google Sign-In library failed to load. Please refresh or try again later.");
    }

    // Cleanup function (optional, potentially useful if dynamically loading scripts)
    return () => {
      // If you need to cleanup anything related to google accounts id
      // e.g., google.accounts.id.disableAutoSelect();
    };
  }, [handleGoogleCallback]); // Re-run if the callback function identity changes (due to role dependency)


  // --- Render ---
  return (
    <div className="auth-page">
      <div className="auth-container">
        <h3 className="auth-title">Create your account</h3>

        {/* --- Manual Registration Form --- */}
        <form onSubmit={onManualFormSubmit} className="auth-form">
          {/* Username */}
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              type="text"
              placeholder="Choose a username"
              id="username"
              onChange={(e) => setUsername(e.target.value)}
              value={username}
              className="form-input"
              required
              disabled={manualLoading || googleLoading} // Disable if any loading active
            />
          </div>
          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              value={email}
              className="form-input"
              required
              disabled={manualLoading || googleLoading}
            />
          </div>
          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              value={password}
              className="form-input"
              required
              minLength="8" // HTML5 validation
              disabled={manualLoading || googleLoading}
            />
          </div>
          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              placeholder="Confirm Password"
              id="confirmPassword"
              onChange={(e) => setConfirmPassword(e.target.value)}
              value={confirmPassword}
              className="form-input"
              required
              disabled={manualLoading || googleLoading}
            />
          </div>
          {/* Role Selection */}
          <div className="form-group">
            <label className="form-label" htmlFor="role">Register As</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-input"
              disabled={manualLoading || googleLoading}
            >
              <option value={ROLES.PATRON}>Patron (Collector)</option>
              <option value={ROLES.ARTIST}>Artist (Creator)</option>
            </select>
          </div>

          {/* Manual Error Display */}
          {manualError && <p className="error-message manual-error">{manualError}</p>}

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={manualLoading || googleLoading}
            >
              {manualLoading ? 'Registering...' : 'Register'}
            </button>
            <Link to="/login" className="auth-link">
              Already have an account? Login
            </Link>
          </div>
        </form>

        {/* --- Separator --- */}
        <div className="auth-separator">OR</div>

        {/* --- Google Sign-Up --- */}
        <div className="google-signin-container">
           {/* Google Error Display */}
          {googleError && <p className="error-message google-error">{googleError}</p>}

          {/* Target div for the Google Button */}
          {/* Render a placeholder or spinner while googleLoading is true */}
          {googleLoading ? (
            <div className="spinner">Loading Google Sign-In...</div>
          ) : (
            <div id={GOOGLE_BUTTON_CONTAINER_ID}></div>
          )}

        </div>
      </div>
    </div>
  );
}

export default RegisterPage;