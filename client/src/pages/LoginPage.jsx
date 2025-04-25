import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { TextField, InputAdornment, IconButton } from '@mui/material'; // Import MUI components
import { Visibility, VisibilityOff } from '@mui/icons-material'; // Import MUI icons
// Import the logo directly
import logoImage from '../assets/Artifact_Logo_Black.png';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const LoginSchema = Yup.object().shape({
    identifier: Yup.string()
        .required('Username or email is required')
        .test('is-valid-identifier', 'Enter a valid username or email', (value) => {
            // Check if it's a valid email
            const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
            // Check if it's a valid username (adjust pattern to match your username rules)
            const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
            
            return emailRegex.test(value) || usernameRegex.test(value);
        }),
    password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

function LoginPage() {
    // --- HOOKS FIRST ---
    const { login, isLoading: isAuthLoading, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const googleButtonContainerRef = useRef(null);
    const [isGoogleScriptLoaded, setIsGoogleScriptLoaded] = useState(false);
    const initializationAttempts = useRef(0);
    const [showPassword, setShowPassword] = useState(false); // State for password visibility
    
    // Check if the user is already authenticated on initial load
    useEffect(() => {
        if (isAuthenticated && !isAuthLoading) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, isAuthLoading, navigate]);

    const handleGoogleSignInSuccess = useCallback(async (googleResponse) => {
        const id_token = googleResponse.credential;
        
        try {
            const response = await apiService.post('/auth/google', { token: id_token });
            
            if (response?.data?.user) {
                const userData = response.data.user;
                await login(userData);
                navigate('/', { replace: true });
                toast.success(`Welcome, ${userData.username || userData.email}!`);
            } else {
                toast.error('Google Sign-In failed: Unexpected server response.');
            }
        } catch (err) {
            // Special handling for the missing role error
            if (err.response?.data?.error?.code === "VALIDATION_ROLE_MISSING") {
                // Show only one error message with a registration button
                toast((t) => (
                    <div className="google-register-toast">
                        <p>{err.response.data.error.message}</p>
                        <button 
                            onClick={() => {
                                toast.dismiss(t.id);
                                navigate('/register');
                            }}
                            className="btn btn-primary btn-sm"
                        >
                            Register Now
                        </button>
                    </div>
                ), { duration: 8000 });
            } else {
                // Show regular error for other cases
                toast.error(
                    err.response?.data?.error?.message ||
                    err.response?.data?.message ||
                    err.message ||
                    'An error occurred during Google Sign-In.'
                );
            }
        }
    }, [login, navigate]);

    // Check if Google script is loaded
    useEffect(() => {
        const checkGoogleScript = () => {
            if (typeof window.google !== 'undefined' && typeof window.google.accounts !== 'undefined') {
                setIsGoogleScriptLoaded(true);
                return true;
            }
            return false;
        };

        if (!checkGoogleScript() && GOOGLE_CLIENT_ID) {
            const intervalId = setInterval(() => {
                if (checkGoogleScript() || initializationAttempts.current >= 5) {
                    clearInterval(intervalId);
                }
                initializationAttempts.current++;
            }, 1000);

            return () => clearInterval(intervalId);
        }
    }, []);

    // Initialize Google Sign-In
    useEffect(() => {
        if (!isGoogleScriptLoaded || !GOOGLE_CLIENT_ID || !googleButtonContainerRef.current) {
            return;
        }

        try {
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleSignInSuccess,
            });

            window.google.accounts.id.renderButton(
                googleButtonContainerRef.current,
                { theme: "outline", size: "large", type: "standard", width: '300px' }
            );

            // Cleanup function
            return () => {
                try {
                    window.google.accounts.id.cancel();
                } catch (err) {
                    console.error("Error during Google Sign-In cleanup:", err);
                }
            };
        } catch (initError) {
            console.error("Google Sign-In initialization/render error:", initError);
            toast.error("Failed to initialize Google Sign-In.");
        }
    }, [isGoogleScriptLoaded, GOOGLE_CLIENT_ID, handleGoogleSignInSuccess, googleButtonContainerRef.current]);

    // --- CONDITIONAL RENDERING / EARLY RETURNS (AFTER Hooks) ---
    if (isAuthLoading) {
        return <div className="auth-page"><div className="auth-container">Loading Authentication Status...</div></div>;
    }

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    // --- OTHER LOGIC / HANDLERS ---
    const handleFormikSubmit = async (values, { setSubmitting }) => {
        try {
            console.log("LoginPage - Submitting login form");
            const response = await apiService.post('/auth/login', {
                identifier: values.identifier,
                password: values.password
            });

            console.log("LoginPage - Login API response:", response.data);

            if (response?.data?.user) {
                const userData = response.data.user;
                console.log("LoginPage - Calling login function with user data");
                await login(userData);
                toast.success(`Welcome back, ${userData.username || userData.email}!`);
                
                // Add a small delay before navigation to allow authentication state to update
                setTimeout(() => {
                    console.log("LoginPage - Navigating to home page");
                    navigate('/', { replace: true });
                }, 100);
            } else {
                toast.error('Login failed: Unexpected response from server.');
            }
        } catch (err) {
            console.error("Login Submit Error:", err);
            toast.error(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setSubmitting(false);
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const handleMouseDownPassword = (event) => {
        event.preventDefault(); // Prevent blur on icon click
    };

    // --- JSX RETURN ---
    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-logo-container">
                    <img src={logoImage} alt="Artifact Logo" className="auth-logo" />
                </div>

                <Formik
                    initialValues={{ identifier: '', password: '' }}
                    validationSchema={LoginSchema}
                    onSubmit={handleFormikSubmit}
                >
                    {({ isSubmitting, errors, touched, values, handleChange, handleBlur }) => (
                        <Form className="auth-form">
                            <div className="form-group">
                                <Field 
                                    type="text" 
                                    name="identifier" 
                                    placeholder="Enter username or email" 
                                    id="identifier" 
                                    className={`form-input ${touched.identifier && errors.identifier ? 'is-invalid' : ''}`} 
                                    disabled={isSubmitting} 
                                />
                                <ErrorMessage name="identifier" component="div" className="error-message validation-error" />
                            </div>
                            <div className="form-group">
                                {/* Replace Field with MUI TextField */}
                                <TextField
                                    fullWidth
                                    variant="outlined" // Or "filled", "standard"
                                    margin="dense" // Changed from "normal" to "dense" for tighter spacing
                                    id="password"
                                    name="password"
                                    label="Password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={values.password}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    error={touched.password && Boolean(errors.password)}
                                    helperText={touched.password && errors.password}
                                    disabled={isSubmitting}
                                    InputProps={{ // Add the visibility toggle adornment
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
                                    // Apply some basic styling or use sx prop if needed
                                    // className={`form-input ${touched.password && errors.password ? 'is-invalid' : ''}`} // Can remove or adapt if using MUI styles primarily
                                    sx={{ mt: 0, mb: 1 }} // Reduced top margin from 1 to 0
                                />
                                {/* Formik's ErrorMessage is handled by TextField's helperText */}
                            </div>

                            {/* Remove the form-actions div and place buttons separately */}
                            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                                {isSubmitting ? 'Processing...' : 'Login'}
                            </button>
                            
                            <Link to="/register" className="auth-link">
                                Don't have an account? Register
                            </Link>
                        </Form>
                    )}
                </Formik>

                <div className="auth-separator">OR</div>

                <div className="google-signin-container">
                    <div id="googleSignInButtonContainer" ref={googleButtonContainerRef}></div>
                    {!GOOGLE_CLIENT_ID && <p className="info-message">Google Sign-In is not configured.</p>}
                </div>
            </div>
        </div>
    );
}

export default LoginPage;