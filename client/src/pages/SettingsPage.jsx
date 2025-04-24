import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import ColorPickerField from '../components/ColorPickerField';

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
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Divider from '@mui/material/Divider';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import Paper from '@mui/material/Paper';
import ColorLensIcon from '@mui/icons-material/ColorLens';

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
    const { theme, setTheme } = useTheme(); // Get theme context
    const navigate = useNavigate();
    const isDarkMode = theme === 'dark';

    // Delete Dialog State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Color Picker Dialog State
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

    // State for color picker
    const [colorPickerValue, setColorPickerValue] = useState(user?.favorite_color || '#F50801');
    const [isSavingColor, setIsSavingColor] = useState(false);

    // Function to update the user's accent color
    const handleUpdateAccentColor = async () => {
        if (!user) return;
        
        setIsSavingColor(true);
        
        try {
            await apiService.patch(`/users/${user.user_id}/preferences`, {
                favorite_color: colorPickerValue
            });
            
            // Update the user in context
            updateUser({ favorite_color: colorPickerValue });
            
            // Close dialog and show success message
            setIsColorPickerOpen(false);
            toast.success('Accent color updated successfully!');
        } catch (err) {
            console.error('Failed to update color preference:', err);
            toast.error('Failed to save your color preference. Please try again.');
        } finally {
            setIsSavingColor(false);
        }
    };

    // Color Preference update handler
    const handleColorSubmit = async (event) => {
        event.preventDefault();
        setIsUpdatingColor(true);
        
        try {
            await apiService.put('/auth/me', { favorite_color: favoriteColor });
            await refreshUserContext(); // Update the global user context
            toast.success('Your color preference has been saved.');
        } catch (err) {
            console.error("Failed to save color preference:", err);
            toast.error('Failed to save your color preference. Please try again.');
        } finally {
            setIsUpdatingColor(false);
        }
    };

    // Theme styles
    const themeStyles = {
        themeOption: {
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: 2,
            borderRadius: 1,
            marginBottom: 1,
            border: '1px solid',
            borderColor: 'divider',
        },
        lightThemeColor: {
            bgcolor: '#FFFFFF',
            color: '#F50801',
            border: '2px solid',
            borderColor: theme === 'light' ? '#F50801' : 'transparent',
        },
        darkThemeColor: {
            bgcolor: '#000000',
            color: '#3BDBB2',
            border: '2px solid',
            borderColor: theme === 'dark' ? '#3BDBB2' : 'transparent',
        },
        colorSwatch: {
            width: 24,
            height: 24,
            borderRadius: '50%',
            marginRight: 1,
            display: 'inline-block',
        },
    };

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

    // Theme change handler
    const handleThemeChange = (event) => {
        setTheme(event.target.value);
        toast.success(`Theme changed to ${event.target.value} mode`);
    };

    // --- Profile Update Handler ---
    const handleUpdateProfile = async (values, { setSubmitting, setErrors }) => {
        // Filter out only changed values to send to backend
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

        try {
            const response = await apiService.put('/auth/me', changedValues);
            
            // Update AuthContext with new user data
            if (response?.data?.user && updateUser) {
                updateUser(response.data.user);
            }
            
            toast.success('Profile updated successfully!');
        } catch (err) {
            console.error("Failed to update profile:", err);
            
            // Handle validation errors from backend
            if (err.response?.status === 400 && err.response?.data?.error?.details) {
                setErrors(err.response.data.error.details);
                toast.error('Please fix the validation errors.');
            } else if (err.response?.status === 409) {
                setErrors({ username: 'This username is already taken.' });
                toast.error('Username already taken.');
            } else {
                // Show a generic error message
                const errorMessage = err.response?.data?.error?.message || 
                                    err.message || 
                                    'Failed to update profile.';
                toast.error(errorMessage);
            }
        } finally {
            setSubmitting(false);
        }
    };


    // --- Delete Profile Handlers --- (Logic remains the same as before)
    const openDeleteDialog = () => setIsDeleteDialogOpen(true);
    const closeDeleteDialog = () => { if (!isDeleting) setIsDeleteDialogOpen(false); };

    const handleConfirmDelete = async () => {
        // Remove the isOwnProfile check as it's unnecessary
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

            {/* Theme Settings Section */}
            <Paper sx={{ p: 3, mt: 4, mb: 4, bgcolor: 'background.paper' }} elevation={1}>
                <Typography variant="h6" component="h2" gutterBottom>
                    Theme Preferences
                </Typography>
                
                {/* Theme Selection */}
                <FormControl component="fieldset" sx={{ mb: 3 }}>
                    <FormLabel component="legend">Choose your preferred theme</FormLabel>
                    <RadioGroup
                        aria-label="theme"
                        name="theme-options"
                        value={theme}
                        onChange={handleThemeChange}
                    >
                        <FormControlLabel 
                            value="light" 
                            control={
                                <Radio 
                                    sx={{
                                        color: '#F50801',
                                        '&.Mui-checked': {
                                            color: '#F50801',
                                        },
                                    }}
                                />
                            } 
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box 
                                        sx={{ 
                                            ...themeStyles.colorSwatch, 
                                            bgcolor: '#F50801'
                                        }} 
                                    />
                                    <LightModeIcon sx={{ color: '#F50801' }} /> 
                                    <Typography>Light Mode</Typography>
                                </Box>
                            } 
                        />
                        <FormControlLabel 
                            value="dark" 
                            control={
                                <Radio 
                                    sx={{
                                        color: '#3BDBB2',
                                        '&.Mui-checked': {
                                            color: '#3BDBB2',
                                        },
                                    }}
                                />
                            } 
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box 
                                        sx={{ 
                                            ...themeStyles.colorSwatch, 
                                            bgcolor: '#3BDBB2'
                                        }} 
                                    />
                                    <DarkModeIcon sx={{ color: '#3BDBB2' }} /> 
                                    <Typography>Dark Mode</Typography>
                                </Box>
                            } 
                        />
                    </RadioGroup>
                </FormControl>
                
                {/* Accent Color Selection */}
                <Divider sx={{ my: 2 }} />
                
                <FormControl component="fieldset" sx={{ width: '100%' }}>
                    <FormLabel component="legend">Accent Color</FormLabel>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, gap: 2 }}>
                        <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            p: 1, 
                            border: '1px solid', 
                            borderColor: 'divider', 
                            borderRadius: 1,
                            flexGrow: 1
                        }}>
                            {user?.favorite_color ? (
                                <>
                                    <Box 
                                        sx={{ 
                                            ...themeStyles.colorSwatch, 
                                            bgcolor: user.favorite_color,
                                            width: 30,
                                            height: 30,
                                            mr: 2
                                        }} 
                                    />
                                    <Typography>
                                        Current color: {user.favorite_color}
                                    </Typography>
                                </>
                            ) : (
                                <Typography color="text.secondary">
                                    No custom color selected
                                </Typography>
                            )}
                        </Box>
                        <Button 
                            variant="outlined" 
                            color="primary"
                            startIcon={<ColorLensIcon />}
                            onClick={() => setIsColorPickerOpen(true)}
                        >
                            Change Color
                        </Button>
                    </Box>
                </FormControl>
            </Paper>

            {/* Color Picker Dialog */}
            <Dialog open={isColorPickerOpen} onClose={() => !isSavingColor && setIsColorPickerOpen(false)}>
                <DialogTitle>Choose Your Accent Color</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                        Select any color to personalize your experience.
                    </Typography>
                    
                    {/* Direct color picker without predefined values */}
                    <Box sx={{ mt: 2, mb: 2 }}>
                        <ColorPickerField
                            name="accent_color"
                            label="Select Color"
                            value={colorPickerValue}
                            onChange={(e) => setColorPickerValue(e.target.value)}
                            disabled={isSavingColor}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsColorPickerOpen(false)} disabled={isSavingColor}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleUpdateAccentColor} 
                        disabled={isSavingColor}
                        variant="contained" 
                        color="primary"
                    >
                        {isSavingColor ? <CircularProgress size={24} /> : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>

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