import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const LoginSchema = Yup.object().shape({
    email: Yup.string().email('Invalid email address').required('Email is required'),
    password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

function LoginPage() {
    // --- HOOKS FIRST ---
    const { login, isLoading: isAuthLoading, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const googleButtonContainerRef = useRef(null);
    const [isGoogleScriptLoaded, setIsGoogleScriptLoaded] = useState(false);
    const initializationAttempts = useRef(0);

    const handleGoogleSignInSuccess = useCallback(async (googleResponse) => {
        const id_token = googleResponse.credential;
        const googleLoginPromise = apiService.post('/auth/google', { token: id_token });

        toast.promise(
            googleLoginPromise,
            {
                loading: 'Verifying Google Sign-In...',
                success: async (apiResponse) => {
                    if (apiResponse?.data?.user) {
                        const userData = apiResponse.data.user;
                        await login(userData);
                        navigate('/');
                        return `Welcome, ${userData.username || userData.email}!`;
                    } else {
                        throw new Error('Google Sign-In failed: Unexpected server response.');
                    }
                },
                error: (err) => {
                    return err.response?.data?.error?.message ||
                        err.response?.data?.message ||
                        err.message ||
                        'An error occurred during Google Sign-In.';
                }
            }
        );
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
            const response = await apiService.post('/auth/login', {
                email: values.email,
                password: values.password
            });

            if (response?.data?.user) {
                const userData = response.data.user;
                await login(userData);
                toast.success(`Welcome back, ${userData.username || userData.email}!`);
                navigate('/');
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

    // --- JSX RETURN ---
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
                                <Field 
                                    type="email" 
                                    name="email" 
                                    placeholder="you@example.com" 
                                    id="email" 
                                    className={`form-input ${touched.email && errors.email ? 'is-invalid' : ''}`} 
                                    disabled={isSubmitting} 
                                />
                                <ErrorMessage name="email" component="div" className="error-message validation-error" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="password" className="form-label">Password</label>
                                <Field 
                                    type="password" 
                                    name="password" 
                                    placeholder="••••••••" 
                                    id="password" 
                                    className={`form-input ${touched.password && errors.password ? 'is-invalid' : ''}`} 
                                    disabled={isSubmitting} 
                                />
                                <ErrorMessage name="password" component="div" className="error-message validation-error" />
                            </div>

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
                    <div id="googleSignInButtonContainer" ref={googleButtonContainerRef}></div>
                    {!GOOGLE_CLIENT_ID && <p className="info-message">Google Sign-In is not configured.</p>}
                </div>
            </div>
        </div>
    );
}

export default LoginPage;