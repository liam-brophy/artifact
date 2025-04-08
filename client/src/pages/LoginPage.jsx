import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService'; // <-- Import configured apiService

// Ensure your Google Client ID is available via Vite's environment variables
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function LoginPage() {
  // Use auth context
  const { login, isLoading: isAuthLoading, isAuthenticated } = useAuth(); // Renamed isLoading to avoid conflict

  // Local state for the login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Local submitting state for form
  const navigate = useNavigate();

  console.log('LoginPage: isAuthLoading:', isAuthLoading, 'isAuthenticated:', isAuthenticated);

  // --- Handle initial loading state from AuthContext ---
  // Prevent rendering the form or redirecting while initial auth check is running
  if (isAuthLoading) {
    return <div className="auth-page"><div className="auth-container">Loading...</div></div>;
  }

  // --- Redirect if user is already authenticated ---
  if (isAuthenticated) {
    console.log('LoginPage: Already authenticated, redirecting to home...');
    return <Navigate to="/" replace />;
  }

  // --- Handler for Email/Password Login ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Clear previous errors
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setIsSubmitting(true); // Indicate form submission is in progress

    try {
      // Use apiService to make the request (handles base URL, credentials, CSRF)
      const response = await apiService.post('/auth/login', {
         email, // Use state variables directly
         password
      });

      // Check the response structure (expecting { message: ..., user: {...} })
      if (response && response.data && response.data.user) {
        const userData = response.data.user;
        // Call AuthContext's login with ONLY the user data
        login(userData);
        navigate('/'); // Navigate to home/dashboard on successful login
      } else {
        // Handle unexpected success response format from backend
        console.error("Login successful but response missing user data:", response?.data);
        setError('Login failed: Unexpected response from server.');
      }
    } catch (err) {
      // apiService interceptor might have logged details already
      console.error("Email/Username/Password Login failed:", err);
      // Extract error message from Axios error response or use generic message
      setError(
        err.response?.data?.error?.message || // Check for nested error object
        err.response?.data?.message ||      // Check for simple message
        err.message ||                      // Fallback to Axios/JS error message
        "Failed to log in. Please check your credentials or try again."
      );
    } finally {
      setIsSubmitting(false); // Re-enable form submission
    }
  };

  // --- Handler for Google Sign-In Success (Callback from Google Library) ---
  const handleGoogleSignInSuccess = async (googleResponse) => {
    console.log("Google Sign-In Success Callback Received:", googleResponse);
    const id_token = googleResponse.credential; // Get the ID token from Google's response
    setError(null); // Clear previous errors
    setIsSubmitting(true); // Optionally indicate processing for Google sign-in too

    try {
      // Use apiService to send the Google token to your backend
      const apiResponse = await apiService.post('/auth/google', {
         token: id_token
      });

      // Check backend response structure (expecting { message: ..., user: {...} })
      if (apiResponse && apiResponse.data && apiResponse.data.user) {
        const userData = apiResponse.data.user;
        // Call AuthContext's login with ONLY the user data
        login(userData);
        navigate('/'); // Navigate on successful backend confirmation
      } else {
        // Handle unexpected success response format from backend
        console.error("Backend response missing user data after Google Sign-In:", apiResponse?.data);
        setError('Google Sign-In failed: Unexpected response from server.');
      }
    } catch (err) {
      console.error("Google Sign-In Backend Call Failed:", err);
      // Extract error message
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'An error occurred during Google Sign-In. Please try again.'
      );
    } finally {
        setIsSubmitting(false); // Finish processing state
    }
  };

  // --- useEffect Hook to Initialize Google Sign-In Button ---
  // (This logic remains largely the same, ensuring Google's library is ready)
  useEffect(() => {
    // Check if the Google library script has loaded
    if (typeof window.google === 'undefined' || typeof window.google.accounts === 'undefined') {
      console.error("Google Identity Services library not loaded.");
      // Optionally set an error or retry mechanism if the script fails to load
      setError("Could not load Google Sign-In library.");
      return;
    }
    // Check if the Client ID is configured
    if (!GOOGLE_CLIENT_ID) {
      console.error("VITE_GOOGLE_CLIENT_ID environment variable is missing.");
      setError("Google Sign-In is not configured correctly (Missing Client ID).");
      return;
    }

    try {
      // Initialize the Google Identity Services library
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignInSuccess, // Function to call on successful sign-in
        // prompt_parent_id: 'googleSignInButtonContainer', // Optional: Specify parent container
        // ux_mode: 'popup', // Optional: Use 'popup' or 'redirect' flow
      });

      // Render the Google Sign-In button
      window.google.accounts.id.renderButton(
        document.getElementById("googleSignInButtonContainer"), // Target element ID
        { theme: "outline", size: "large", type: "standard", width: '300px' } // Button customization
      );

      // Optional: Display the One Tap prompt if desired
      // window.google.accounts.id.prompt();

    } catch (initError) {
      console.error("Error initializing Google Sign-In:", initError);
      setError("Failed to initialize Google Sign-In.");
    }

    // Cleanup function (optional, usually not needed for renderButton)
    // return () => {
    //   // Potentially disable prompt if needed on component unmount
    // };

  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Render the Login Page UI ---
  return (
    <div className="auth-page">
      <div className="auth-container">
        <h3 className="auth-title">Login to your account</h3>

        {/* --- Email/Password Form --- */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              id="email"
              className="form-input"
              onChange={(e) => setEmail(e.target.value)}
              value={email}
              required
              disabled={isSubmitting} // Disable during submission
            />
          </div>
          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              id="password"
              className="form-input"
              onChange={(e) => setPassword(e.target.value)}
              value={password}
              required
              disabled={isSubmitting} // Disable during submission
            />
          </div>

          {/* Display errors */}
          {error && <p className="error-message">{error}</p>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Login'}
            </button>
            {/* Link to registration page */}
            <Link to="/register" className="auth-link">
              Don't have an account? Register
            </Link>
          </div>
        </form>

        {/* Separator */}
        <div className="auth-separator">OR</div>

        {/* --- Google Sign-In Button --- */}
        <div className="google-signin-container">
          {/* The Google library will render the button inside this div */}
          <div id="googleSignInButtonContainer"></div>
           {/* Display error specific to Google setup if Client ID is missing */}
           {!GOOGLE_CLIENT_ID && <p className="error-message">Google Sign-In is unavailable (Configuration missing).</p>}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;