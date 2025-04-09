import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '../context/AuthContext';
import Upload from '../components/Upload'; // Ensure path is correct

function UploadPage() {
    const { user, isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    // --- Loading State --- (No changes needed)
    if (isLoading) {
        return (
            <Container maxWidth="sm">
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                    <CircularProgress /> <Typography sx={{ ml: 2 }}>Verifying access...</Typography>
                </Box>
            </Container>
        );
    }

    // --- Not Authenticated --- (No changes needed)
    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    // --- Incorrect Role --- (No changes needed - assuming redirect)
    if (user?.role !== 'artist') {
        return <Navigate to="/" replace state={{ message: "Access Denied: Artist role required for uploads." }} />;
    }

    // --- Render Upload Component ---
    return (
        <Container maxWidth="md"> {/* Keep md for form space */}
            <Box sx={{ my: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom align="center">
                    Upload New Artwork
                </Typography>
                {/* Render the Upload component without the fields prop */}
                <Upload />
            </Box>
        </Container>
    );
}

export default UploadPage;