import React from 'react';
import { Navigate } from 'react-router-dom';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';

// Ensure this matches the named export
import { useAuth } from '../hooks/useAuth';

import Upload from '../components/Upload'; // Import the Upload component

function UploadPage() {
    // --- Get user info from your auth context/hook ---
    const { user, isLoading } = useAuth();
    // -------------------------------------------------

    if (isLoading) {
        // Optional: Show a loading spinner while auth state is resolving
        return <Typography>Loading user data...</Typography>;
    }

    // --- Access Control ---
    if (!user) {
        // Not logged in, redirect to login page (adjust path as needed)
        return <Navigate to="/login" replace />;
    }

    if (user.role !== 'artist') {
        // Logged in, but not an artist
        return (
            <Container maxWidth="sm">
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Alert severity="error">
                        Only artists can upload artworks.
                    </Alert>
                </Box>
            </Container>
        );
    }

    // --- Render Upload Component for Artists ---
    return (
        <Container maxWidth="md">
            <Box sx={{ my: 4 }}> {/* Add some margin */}
                <Typography variant="h4" component="h1" gutterBottom align="center">
                    Upload New Artwork
                </Typography>
                {/* Pass any necessary props, like the auth token if needed directly in Upload */}
                <Upload fields={['image', 'title', 'year', 'medium']} />
            </Box>
        </Container>
    );
}

export default UploadPage;