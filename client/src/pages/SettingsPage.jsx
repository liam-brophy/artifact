import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';

// MUI Components
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField'; // Use TextField for Formik integration
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert'; // Keep for specific UI feedback if needed
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

// Define Validation Schema for editable fields
const SettingsSchema = Yup.object().shape({
  username: Yup.string()
    .min(3, 'Min 3 characters')
    .max(50, 'Max 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores')
    .required('Username is required'),
  bio: Yup.string()
    .max(500, 'Bio cannot exceed 500 characters')
    .nullable(), // Allow empty bio
  profile_image_url: Yup.string()
    .url('Must be a valid URL')
    .max(500, 'URL too long')
    .nullable(), // Allow empty URL
});


function SettingsPage() {
    const { user, logout, isLoading: isAuthLoading, updateUser } = useAuth(); // Get user and logout/updateUser
    const navigate = useNavigate();

    // Delete Dialog State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // If auth is still loading or user is not loaded, show loading/redirect
    if (isAuthLoading) {
        return <Container maxWidth="sm" sx={{ mt: 4 }}><CircularProgress /></Container>;
    }
    if (!user) {
         // Should be handled by protected route wrapper ideally, but basic check here
         navigate('/login'); // Redirect if somehow landed here without user
         return null; // Render nothing while redirecting
    }

    // --- Formik Initial Values (populated from AuthContext user) ---
    const initialFormValues = {
        username: user?.username || '',
        bio: user?.bio || '',
        profile_image_url: user?.profile_image_url || '',
    };

    // --- Profile Update Handler ---
    const handleUpdateProfile = async (values, { setSubmitting, setErrors }) => {
        // Filter out only changed values to send to backend (optional optimization)
        const changedValues = {};
        for (const key in values) {
            if (values[key] !== initialFormValues[key]) {
                changedValues[key] = values[key];
            }
        }

        if (Object.keys(changedValues).length === 0) {
            toast('No changes detected.');
            setSubmitting(false);
            return;
        }

        const updatePromise = apiService.put('/users/me', changedValues); // Send only changed values

        toast.promise(
            updatePromise,
            {
                loading: 'Saving settings...',
                success: (response) => {
                    // Optionally update AuthContext state optimistically or with response
                    if (response?.data?.user && updateUser) {
                         updateUser(response.data.user); // Update context with new user data from backend
                    }
                    return 'Profile updated successfully!'; // Toast message
                },
                error: (err) => {
                    // Interceptor handles general errors, but check for validation errors from backend
                    if (err.response?.status === 400 && err.response?.data?.error?.details) {
                        setErrors(err.response.data.error.details); // Set Formik errors
                        return 'Please fix the validation errors.'; // Specific toast for validation
                    } else if (err.response?.status === 409) { // Example: Handle unique constraint error
                        setErrors({ username: 'This username is already taken.' }); // Set specific Formik error
                         return 'Username already taken.'; // Specific toast
                    }
                    // Return generic message, interceptor likely showed a better one
                    return err.response?.data?.error || err.message || 'Failed to update profile.';
                }
            }
        ).finally(() => {
            setSubmitting(false); // Ensure button is re-enabled
        });
    };


    // --- Delete Profile Handlers --- (Logic remains the same as before)
    const openDeleteDialog = () => setIsDeleteDialogOpen(true);
    const closeDeleteDialog = () => { if (!isDeleting) setIsDeleteDialogOpen(false); };

    const handleConfirmDelete = async () => {
        if (!isOwnProfile) return; // isOwnProfile check is technically redundant if /auth/me is used, but safe to keep
        setIsDeleting(true);

        // --- Corrected Endpoint ---
        const deletePromise = apiService.delete('/auth/me'); // Use the endpoint from auth_bp

        toast.promise(
            deletePromise,
            {
                loading: 'Deleting your account...',
                success: async (response) => { // Success callback might receive the (empty) response
                    // Note: Backend already unset cookies via headers in the 204 response.
                    // Calling logout() clears client-side context state.
                    closeDeleteDialog();
                    await logout(); // Ensure client state is cleared
                    navigate('/'); // Redirect home
                    return 'Account successfully deleted.';
                },
                error: (err) => {
                    // Interceptor shows detailed API error, this provides context
                    console.error("Component Catch: Failed to delete profile:", err);
                    setIsDeleting(false); // Re-enable dialog buttons on error
                    // Return message for error toast
                    return err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Could not delete profile.'; // Check error structure
                }
            }
        );
        // Note: No setIsDeleting(false) needed in success path due to navigation
    };


    // --- Render ---
    return (
        <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Account Settings
            </Typography>

            {/* --- Profile Update Form --- */}
            <Typography variant="h6" component="h2" gutterBottom sx={{ mt: 3 }}>
                Edit Profile
            </Typography>
            <Formik
                initialValues={initialFormValues}
                validationSchema={SettingsSchema}
                onSubmit={handleUpdateProfile}
                enableReinitialize // Important: Update form if user context changes
            >
                {({ isSubmitting, errors, touched }) => (
                    <Form>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {/* Username */}
                            <Field
                                name="username"
                                as={TextField} // Use MUI TextField
                                label="Username"
                                fullWidth
                                error={touched.username && Boolean(errors.username)}
                                helperText={<ErrorMessage name="username" />}
                                disabled={isSubmitting}
                            />
                            {/* Bio */}
                            <Field
                                name="bio"
                                as={TextField}
                                label="Bio / About Me"
                                multiline
                                rows={4}
                                fullWidth
                                error={touched.bio && Boolean(errors.bio)}
                                helperText={<ErrorMessage name="bio" />}
                                disabled={isSubmitting}
                            />
                             {/* Profile Image URL */}
                             <Field
                                name="profile_image_url"
                                as={TextField}
                                label="Profile Image URL"
                                fullWidth
                                error={touched.profile_image_url && Boolean(errors.profile_image_url)}
                                helperText={<ErrorMessage name="profile_image_url" />}
                                disabled={isSubmitting}
                            />

                            <Button
                                type="submit"
                                variant="contained"
                                color="primary"
                                disabled={isSubmitting}
                                sx={{ alignSelf: 'flex-start' }} // Align button left
                            >
                                {isSubmitting ? <CircularProgress size={24} /> : 'Save Changes'}
                            </Button>
                        </Box>
                    </Form>
                )}
            </Formik>

            {/* --- Danger Zone --- */}
            <Box sx={{ mt: 6, p: 2, border: '1px solid', borderColor: 'error.main', borderRadius: 1 }}>
                <Typography variant="h6" color="error" gutterBottom>
                    Danger Zone
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    Deleting your account is permanent and cannot be undone.
                </Typography>
                <Button
                    variant="contained"
                    color="error"
                    onClick={openDeleteDialog}
                    disabled={isDeleting} // Disable if delete already in progress
                >
                    {isDeleting ? <CircularProgress size={24} color="inherit" /> : 'Delete My Account'}
                </Button>
            </Box>

            {/* --- Delete Confirmation Dialog --- */}
            <Dialog open={isDeleteDialogOpen} onClose={closeDeleteDialog}>
                <DialogTitle>Confirm Account Deletion</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you absolutely sure? This action cannot be undone.
                    </DialogContentText>
                    {/* Optional: Add specific delete error display here if needed beyond toast */}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteDialog} disabled={isDeleting}>Cancel</Button>
                    <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={isDeleting} startIcon={isDeleting ? <CircularProgress size={20} color="inherit"/> : null}>
                        Confirm Delete
                    </Button>
                </DialogActions>
            </Dialog>

        </Container>
    );
}

export default SettingsPage;