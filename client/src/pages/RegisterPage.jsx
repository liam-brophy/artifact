import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import ColorPickerField from '../components/ColorPickerField';

// --- Constants ---
const ROLES = { PATRON: 'patron', ARTIST: 'artist' };
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_BUTTON_CONTAINER_ID = 'googleSignUpButtonContainer';

// Removed formatApiError - interceptor handles formatting

// --- Validation Schema ---
const RegisterSchema = Yup.object().shape({
  username: Yup.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username cannot be longer than 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .required('Username is required'),
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  confirmPassword: Yup.string().oneOf([Yup.ref('password'), null], 'Passwords must match').required('Please confirm your password'),
  role: Yup.string().oneOf([ROLES.PATRON, ROLES.ARTIST], 'Invalid role selected').required('Please select a role'),
  favorite_color: Yup.string().matches(/^#([0-9A-F]{6})$/i, 'Must be a valid hex color').required('Please select a favorite color')
});

function RegisterPage() {
  // Role state needed for Google flow
  const [role, setRole] = useState(ROLES.PATRON);
  // Google specific loading state
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Check if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // --- Formik Submission Handler (Manual Registration) ---
  const handleManualFormSubmit = async (values, { setSubmitting }) => {
    // No need to clear local error state
    const registerPromise = apiService.post('/auth/register', {
      username: values.username,
      email: values.email,
      password: values.password,
      role: values.role,
      favorite_color: values.favorite_color // Add favorite_color to API call
    });

    toast.promise(
        registerPromise,
        {
            loading: 'Registering account...',
            success: (response) => { // Success callback
                // Instead of alert, show success toast
                // Alert('Registration successful! Please log in.');
                navigate('/login'); // Redirect to login page
                return 'Registration successful! Please log in.'; // Toast message
            },
            error: (err) => { // Error callback
                // Interceptor handles showing the toast with backend error message
                console.error("Manual Registration Component Catch:", err);
                // Return the error message for the toast.promise error state if needed,
                // but interceptor likely already showed one. Maybe return a generic fallback.
                return err.response?.data?.error?.message || err.message || 'Registration failed.';
            }
        }
    ).finally(() => {
        // Ensure submit state is always reset
        setSubmitting(false);
    });
  };


  // --- Google Sign-Up/In Callback Handler ---
  const handleGoogleCallback = useCallback(async (googleResponse) => {
    console.log("Google Sign-Up/In Callback Received:", googleResponse);
    const id_token = googleResponse.credential;
    if (!id_token) {
      console.error("Google response missing credential (token).");
      toast.error("Failed to get token from Google.");
      return;
    }

    setGoogleLoading(true); // Indicate Google processing start

    const googleAuthPromise = apiService.post('/auth/google', {
      token: id_token,
      role: role // Include the currently selected role
    });

    toast.promise(
        googleAuthPromise,
        {
            loading: `Registering as ${role} with Google...`,
            success: async (response) => { // Success callback receives API response
                 if (response?.data?.user) {
                    const userData = response.data.user;
                    await login(userData); // Update auth context
                    // Delay navigation slightly to ensure auth state is updated
                    setTimeout(() => navigate('/', { replace: true }), 200);
                    return `Successfully signed in as ${userData.username || userData.email}!`; // Toast message
                 } else {
                     console.error("Google Sign-In backend response missing user data:", response?.data);
                     throw new Error('Google Sign-In failed: Unexpected server response.'); // Trigger error toast
                 }
            },
            error: (err) => { // Error callback receives error object
                console.error("Google Sign-Up/In Backend Component Catch:", err);
                // Interceptor likely showed an error, return message for toast.promise
                return err.response?.data?.error?.message || err.message || 'Google Sign-Up/In failed.';
            }
        }
    ).finally(() => {
         setGoogleLoading(false); // Stop Google loading indicator
    });

  }, [role, login, navigate]);


  // --- Effect for Google Sign-In Initialization ---
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.error("VITE_GOOGLE_CLIENT_ID is missing.");
      // Error message shown near button below
      return;
    }
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCallback });
        window.google.accounts.id.renderButton(document.getElementById(GOOGLE_BUTTON_CONTAINER_ID), { theme: "outline", size: "large", type: "standard", text: "signup_with" });
      } catch (initError) {
        console.error("Error initializing Google Sign-In:", initError);
        toast.error("Failed to initialize Google Sign-In library.");
      }
    } else {
      console.warn("Google Identity Services library not loaded yet.");
      // Optionally show a message or retry loading
    }
  }, [handleGoogleCallback]);


  // --- Render ---
  return (
    <div className="auth-page">
      <div className="auth-container">
        <h3 className="auth-title">Create your account</h3>

        <Formik
          initialValues={{ 
            username: '', 
            email: '', 
            password: '', 
            confirmPassword: '', 
            role: role,
            favorite_color: '#F50801'  // Default color (red)
          }}
          validationSchema={RegisterSchema}
          onSubmit={handleManualFormSubmit}
          enableReinitialize // Keep role synced if external state changes it
        >
          {({ isSubmitting, errors, touched, setFieldValue, values, handleChange, handleBlur }) => (
            <Form className="auth-form">
              {/* Role Selection - Moved to the top of the form */}
              <div className="form-group">
                <label className="form-label" htmlFor="role">Register As</label>
                <Field as="select" name="role" id="role" className={`form-input ${touched.role && errors.role ? 'is-invalid' : ''}`} disabled={isSubmitting || googleLoading}
                  onChange={e => {
                    const newRole = e.target.value;
                    setFieldValue('role', newRole, false); // Use false as third parameter to prevent validation
                    setRole(newRole); // Update local state (for Google)
                  }}>
                  <option value={ROLES.ARTIST}>Artist (Creator)</option>
                  <option value={ROLES.PATRON}>Patron (Collector)</option>
                </Field>
                <ErrorMessage name="role" component="div" className="error-message validation-error" />
              </div>

              {/* Username, Email, Password, Confirm Password Fields */}
              <div className="form-group">
                <label className="form-label" htmlFor="username">Username</label>
                <Field type="text" name="username" placeholder="Choose a username" id="username" className={`form-input ${touched.username && errors.username ? 'is-invalid' : ''}`} disabled={isSubmitting || googleLoading}/>
                <ErrorMessage name="username" component="div" className="error-message validation-error" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <Field type="email" name="email" placeholder="you@example.com" id="email" className={`form-input ${touched.email && errors.email ? 'is-invalid' : ''}`} disabled={isSubmitting || googleLoading}/>
                <ErrorMessage name="email" component="div" className="error-message validation-error" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <Field type="password" name="password" placeholder="Password (min 8 characters)" id="password" className={`form-input ${touched.password && errors.password ? 'is-invalid' : ''}`} disabled={isSubmitting || googleLoading}/>
                <ErrorMessage name="password" component="div" className="error-message validation-error" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                <Field type="password" name="confirmPassword" placeholder="Confirm Password" id="confirmPassword" className={`form-input ${touched.confirmPassword && errors.confirmPassword ? 'is-invalid' : ''}`} disabled={isSubmitting || googleLoading}/>
                <ErrorMessage name="confirmPassword" component="div" className="error-message validation-error" />
              </div>

              {/* Favorite Color Selection */}
              <div className="form-group">
                <ColorPickerField
                  name="favorite_color"
                  label="Choose Your Favorite Color"
                  value={values.favorite_color}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={errors.favorite_color}
                  touched={touched.favorite_color}
                  disabled={isSubmitting || googleLoading}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={isSubmitting || googleLoading}>
                  {isSubmitting ? 'Registering...' : 'Register'}
                </button>
                <Link to="/login" className="auth-link">
                  Already have an account? Login
                </Link>
              </div>
            </Form>
          )}
        </Formik>

        <div className="auth-separator">OR</div>

        <div className="google-signin-container">
          {/* Removed local googleError display */}
          {googleLoading ? (
            <div className="spinner">Processing Google Sign-Up...</div>
          ) : (
            <div id={GOOGLE_BUTTON_CONTAINER_ID}></div>
          )}
           {!GOOGLE_CLIENT_ID && <p className="error-message">Google Sign-Up is unavailable (Configuration missing).</p>}
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;