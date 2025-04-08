import React from 'react';
import { Navigate, useLocation } from 'react-router-dom'; // Import useLocation
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress'; // For loading state

// Import the hook to access authentication context
import { useAuth } from '../context/AuthContext';

// Import the component that contains the actual upload form/logic
import Upload from '../components/Upload'; // Assuming this component handles the form and API call

function UploadPage() {
    // Get state from the AuthContext
    // We need isLoading, isAuthenticated, and the user object (for the role check)
    const { user, isAuthenticated, isLoading } = useAuth();
    const location = useLocation(); // Hook to get current location for redirect state

    // 1. Handle Loading State: Show spinner while the initial auth check is running
    if (isLoading) {
        return (
            <Container maxWidth="sm">
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2 }}>Verifying access...</Typography>
                </Box>
            </Container>
        );
    }

    // 2. Handle Not Authenticated: Redirect to login page
    // This check runs AFTER isLoading is confirmed to be false
    if (!isAuthenticated) {
        console.log("UploadPage: User not authenticated. Redirecting to login.");
        // Use Navigate component for redirection
        // Pass the current location in state so login can redirect back after success
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    // 3. Handle Authenticated BUT Incorrect Role: Redirect or show error
    // Use optional chaining `user?.role` just in case user object is briefly null during updates
    if (user?.role !== 'artist') {
        console.log(`UploadPage: User role (${user?.role}) is not 'artist'. Redirecting.`);
        // Option A: Redirect to a different page (e.g., home)
        return <Navigate to="/" replace state={{ message: "Access Denied: Artist role required for uploads." }} />;

        // Option B: Show an "Unauthorized" message on this URL (less common for role access)
        /*
        return (
            <Container maxWidth="sm">
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Alert severity="warning">
                       Access Denied: Only artists can upload artworks.
                    </Alert>
                </Box>
            </Container>
        );
        */
    }

    // 4. Render Upload Component for Authenticated Artists
    // This section is reached only if: isLoading=false, isAuthenticated=true, AND user.role='artist'
    console.log("UploadPage: Rendering Upload component for artist user:", user?.username);
    return (
        <Container maxWidth="md">
            <Box sx={{ my: 4 }}> {/* Added standard margin */}
                <Typography variant="h4" component="h1" gutterBottom align="center">
                    Upload New Artwork
                </Typography>
                {/*
                  Render the Upload component.
                  This component should internally use the 'apiService' for making the
                  actual authenticated upload request to the backend.
                  Pass any necessary props for configuration.
                  No need to pass tokens or user ID if the backend gets it from the session.
                */}
                <Upload fields={['image', 'title', 'artist', 'year', 'medium']} />
            </Box>
        </Container>
    );
}

export default UploadPage;