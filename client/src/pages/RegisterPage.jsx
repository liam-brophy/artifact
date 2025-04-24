import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import ColorPickerField from '../components/ColorPickerField';
// Import MUI components
import { TextField, InputAdornment, IconButton, Select, MenuItem, FormControl, InputLabel, FormHelperText } from '@mui/material'; 
import { Visibility, VisibilityOff } from '@mui/icons-material'; // Import MUI icons

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
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); // State for confirm password visibility

  // Check if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // --- Formik Submission Handler (Manual Registration) ---
  const handleManualFormSubmit = async (values, { setSubmitting }) => {
    try {
      const response = await apiService.post('/auth/register', {
        username: values.username,
        email: values.email,
        password: values.password,
        role: values.role,
        favorite_color: values.favorite_color
      });
      
      // Registration successful
      toast.success('Registration successful! Please log in.');
      navigate('/login');
    } catch (err) {
      // Show only one error message
      const errorMessage = err.response?.data?.error?.message || 
                          err.response?.data?.error?.details || 
                          err.message || 
                          'Registration failed. Please try again.';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };


  // --- Google Sign-Up/In Callback Handler ---
  const handleGoogleCallback = useCallback(async (googleResponse) => {
    const id_token = googleResponse.credential;
    if (!id_token) {
      console.error("Google response missing credential (token).");
      toast.error("Failed to get token from Google.");
      return;
    }

    setGoogleLoading(true); // Indicate Google processing start
    
    try {
      const response = await apiService.post('/auth/google', {
        token: id_token,
        role: role // Include the currently selected role
      });

      if (response?.data?.user) {
        const userData = response.data.user;
        await login(userData); // Update auth context
        // Navigate to homepage
        navigate('/', { replace: true });
        toast.success(`Successfully signed in as ${userData.username || userData.email}!`);
      } else {
        console.error("Google Sign-In backend response missing user data:", response?.data);
        toast.error('Google Sign-In failed: Unexpected server response.');
      }
    } catch (err) {
      console.error("Google Sign-Up/In error:", err);
      // Show only one error message
      const errorMessage = err.response?.data?.error?.message || 
                          err.message || 
                          'Google Sign-Up/In failed.';
      toast.error(errorMessage);
    } finally {
      setGoogleLoading(false); // Stop Google loading indicator
    }
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
      // console.warn("Google Identity Services library not loaded yet.");
      // Optionally show a message or retry loading
    }
  }, [handleGoogleCallback]);


  // --- Password Visibility Handlers ---
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault(); // Prevent blur on icon click
  };

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
              {/* Role Selection - Using MUI Select */}
              <FormControl fullWidth margin="normal" error={touched.role && Boolean(errors.role)} disabled={isSubmitting || googleLoading}>
                <InputLabel id="role-select-label">Register As</InputLabel>
                <Select
                  labelId="role-select-label"
                  id="role"
                  name="role"
                  value={values.role}
                  label="Register As"
                  onChange={(e) => {
                    const newRole = e.target.value;
                    handleChange(e); // Formik's handler
                    setRole(newRole); // Update local state for Google
                  }}
                  onBlur={handleBlur}
                >
                  <MenuItem value={ROLES.ARTIST}>Artist (Creator)</MenuItem>
                  <MenuItem value={ROLES.PATRON}>Patron (Collector)</MenuItem>
                </Select>
                {touched.role && errors.role && <FormHelperText>{errors.role}</FormHelperText>}
              </FormControl>

              {/* Username - Using MUI TextField */}
              <TextField
                fullWidth
                margin="normal"
                id="username"
                name="username"
                label="Username"
                placeholder="Choose a username"
                value={values.username}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.username && Boolean(errors.username)}
                helperText={touched.username && errors.username}
                disabled={isSubmitting || googleLoading}
              />

              {/* Email - Using MUI TextField */}
              <TextField
                fullWidth
                margin="normal"
                id="email"
                name="email"
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={values.email}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.email && Boolean(errors.email)}
                helperText={touched.email && errors.email}
                disabled={isSubmitting || googleLoading}
              />

              {/* Password - Using MUI TextField with visibility toggle */}
              <TextField
                fullWidth
                margin="normal"
                id="password"
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password (min 8 characters)"
                value={values.password}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.password && Boolean(errors.password)}
                helperText={touched.password && errors.password}
                disabled={isSubmitting || googleLoading}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={togglePasswordVisibility}
                        onMouseDown={handleMouseDownPassword}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Confirm Password - Using MUI TextField with visibility toggle */}
              <TextField
                fullWidth
                margin="normal"
                id="confirmPassword"
                name="confirmPassword"
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={values.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.confirmPassword && Boolean(errors.confirmPassword)}
                helperText={touched.confirmPassword && errors.confirmPassword}
                disabled={isSubmitting || googleLoading}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle confirm password visibility"
                        onClick={toggleConfirmPasswordVisibility}
                        onMouseDown={handleMouseDownPassword}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

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

              {/* Remove form-actions div for consistent vertical layout */}
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || googleLoading}>
                {isSubmitting ? 'Registering...' : 'Register'}
              </button>
              
              <Link to="/login" className="auth-link">
                Already have an account? Login
              </Link>
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