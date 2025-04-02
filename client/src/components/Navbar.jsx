import React from 'react';
import { Link as RouterLink } from 'react-router-dom'; // Import with alias
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
// Optional: Add an icon for the upload link
// import CloudUploadIcon from '@mui/icons-material/CloudUpload';

// Assuming AuthContext provides user object with 'role', 'username'/'email' properties
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useAuth(); // Get user and logout function

  return (
    // AppBar provides the main structure and background
    <AppBar position="static" sx={{ mb: 3, bgcolor: 'background.paper', color: 'text.primary' }}>
        {/* Toolbar handles padding and aligns items horizontally */}
        <Toolbar>
            {/* App Title/Logo Area - Link to Home */}
            <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
                <RouterLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                    Artifact {/* Or your app name */}
                </RouterLink>
            </Typography>

            {/* Main Navigation Links - Using Box to group and push Auth links right */}
            <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
                <Button color="inherit" component={RouterLink} to="/">
                    Home
                </Button>
                {user && (
                    <Button color="inherit" component={RouterLink} to="/profile">
                        Profile
                    </Button>
                )}
                {/* === Conditional Upload Link for Artists === */}
                {user && user.role === 'artist' && (
                    <Button
                        color="primary" // Use primary theme color for emphasis
                        variant="outlined" // Make it stand out slightly
                        component={RouterLink}
                        to="/upload"
                       // startIcon={<CloudUploadIcon />} // Optional icon
                    >
                        Upload Artwork
                    </Button>
                )}
                 {/* ========================================== */}
                 {/* Add other general links like Gallery here */}
                 {/* <Button color="inherit" component={RouterLink} to="/gallery">Gallery</Button> */}
            </Box>

            {/* Authentication Section */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {user ? (
                    <>
                        <Typography variant="body1" sx={{ display: { xs: 'none', sm: 'block' } }}> {/* Hide on extra small screens */}
                            Hi, {user.username || user.email}!
                            {/* Optionally show role - can be verbose
                            {user.role && ` (${user.role})`}
                             */}
                        </Typography>
                        <Button
                            variant="outlined" // Or "contained" with color="secondary"
                            color="inherit" // Or "secondary"
                            onClick={logout}
                        >
                            Logout
                        </Button>
                    </>
                ) : (
                    <>
                        <Button color="inherit" component={RouterLink} to="/login">
                            Login
                        </Button>
                        <Button
                            variant="contained" // Make Register stand out
                            color="primary"
                            component={RouterLink}
                            to="/register"
                            disableElevation // Flatter look
                        >
                            Register
                        </Button>
                    </>
                )}
            </Box>
        </Toolbar>
    </AppBar>
  );
}

export default Navbar;