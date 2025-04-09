import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast'; // <-- Import toast

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const LoginSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

function LoginPage() {
  const { login, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  // Note: We don't need local 'submitError' state anymore. Toasts will handle API errors.

  console.log('LoginPage: isAuthLoading:', isAuthLoading, 'isAuthenticated:', isAuthenticated);

  if (isAuthLoading) {
    // Consider a more centered loading indicator if desired
    return <div className="auth-page"><div className="auth-container">Loading Authentication Status...</div></div>;
  }

  if (isAuthenticated) {
    console.log('LoginPage: Already authenticated, redirecting to home...');
    return <Navigate to="/" replace />;
  }

  const handleFormikSubmit = async (values, { setSubmitting }) => {
    // Clear previous toasts if any linger (optional)
    // toast.dismiss();

    try {
      const response = await apiService.post('/auth/login', {
         email: values.email,
         password: values.password
      });

      if (response?.data?.user) { // Check response structure carefully
        const userData = response.data.user;
        // Call login from context, which now also fetches collection
        await login(userData); // Make sure login awaits fetchUserDataAndCollection
        toast.success(`Welcome back, ${userData.username || userData.email}!`); // Success toast
        navigate('/'); // Navigate AFTER successful login and context update
      } else {
        // This case indicates a backend success (2xx) but unexpected response body
        console.error("Login successful but response missing user data:", response?.data);
        toast.error('Login failed: Unexpected response from server.');
      }
    } catch (err) {
      // API errors (4xx, 5xx, network) are now handled by the apiService interceptor!
      // The interceptor will display the toast.error.
      // We don't need to call toast.error() here again.
      console.error("Login Component Error Catch:", err); // Still log for component-level debugging if needed
      // No need to set local submitError state
    } finally {
      setSubmitting(false); // Always re-enable the button
    }
  };

  const handleGoogleSignInSuccess = async (googleResponse) => {
    console.log("Google Sign-In Success Callback Received:", googleResponse);
    const id_token = googleResponse.credential;
    // Clear previous toasts (optional)
    // toast.dismiss();
    // Indicate loading specific to Google Sign-In
    const googleLoginPromise = apiService.post('/auth/google', { token: id_token });

    toast.promise(
        googleLoginPromise,
        {
            loading: 'Verifying Google Sign-In...',
            success: async (apiResponse) => { // Use async here if login() is async
                if (apiResponse?.data?.user) {
                    const userData = apiResponse.data.user;
                    await login(userData); // Update context
                    navigate('/'); // Navigate on success
                    return `Welcome, ${userData.username || userData.email}!`; // Success message
                } else {
                    console.error("Backend response missing user data after Google Sign-In:", apiResponse?.data);
                    // Throw an error to trigger the toast.promise 'error' state
                    throw new Error('Google Sign-In failed: Unexpected server response.');
                }
            },
            error: (err) => {
                // Extract error message for the toast
                return err.response?.data?.error?.message ||
                       err.response?.data?.message ||
                       err.message ||
                       'An error occurred during Google Sign-In.';
            }
        }
    );
  };


  useEffect(() => {
    // --- Google Sign-In Button Initialization ---
    if (typeof window.google === 'undefined' || typeof window.google.accounts === 'undefined') {
      console.error("Google Identity Services library not loaded.");
      toast.error("Could not load Google Sign-In library.");
      return;
    }
    if (!GOOGLE_CLIENT_ID) {
      console.error("VITE_GOOGLE_CLIENT_ID environment variable is missing.");
      // Error message shown near the button below
      return;
    }
    try {
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleSignInSuccess });
      window.google.accounts.id.renderButton(document.getElementById("googleSignInButtonContainer"), { theme: "outline", size: "large", type: "standard", width: '300px' });
    } catch (initError) {
      console.error("Error initializing Google Sign-In:", initError);
      toast.error("Failed to initialize Google Sign-In.");
    }
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h3 className="auth-title">Login to your account</h3>

        <Formik
          initialValues={{ email: '', password: '' }}
          validationSchema={LoginSchema}
          onSubmit={handleFormikSubmit}
        >
          {({ isSubmitting, errors, touched }) => (
            <Form className="auth-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">Email</label>
                <Field type="email" name="email" placeholder="you@example.com" id="email" className={`form-input ${touched.email && errors.email ? 'is-invalid' : ''}`} disabled={isSubmitting} />
                <ErrorMessage name="email" component="div" className="error-message validation-error" />
              </div>
              <div className="form-group">
                <label htmlFor="password" className="form-label">Password</label>
                <Field type="password" name="password" placeholder="••••••••" id="password" className={`form-input ${touched.password && errors.password ? 'is-invalid' : ''}`} disabled={isSubmitting} />
                <ErrorMessage name="password" component="div" className="error-message validation-error" />
              </div>

              {/* Removed the local submitError display - toasts handle API errors */}
              {/* {submitError && <p className="error-message submit-error">{submitError}</p>} */}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : 'Login'}
                </button>
                <Link to="/register" className="auth-link">
                  Don't have an account? Register
                </Link>
              </div>
            </Form>
          )}
        </Formik>

        <div className="auth-separator">OR</div>

        <div className="google-signin-container">
          <div id="googleSignInButtonContainer"></div>
          {!GOOGLE_CLIENT_ID && <p className="error-message">Google Sign-In is unavailable (Configuration missing).</p>}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;