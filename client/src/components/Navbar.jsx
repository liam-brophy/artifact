import React from 'react';
import { Link as RouterLink } from 'react-router-dom'; // Import with alias
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
// Optional: Add an icon for the upload link
// import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useAuth(); // Get user and logout function

  return (
    <AppBar position="static" sx={{ mb: 3, bgcolor: 'background.paper', color: 'text.primary' }}>
        <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
                <RouterLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                    Artifact
                </RouterLink>
            </Typography>

            <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
                <Button color="inherit" component={RouterLink} to="/">
                    Home
                </Button>
                {user && (
                    <Button 
                        color="inherit" 
                        component={RouterLink} 
                        to={`/users/${user.username}`}>
                        My Profile
                    </Button>
                )}
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
                {/* Additional general links can be added here */}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {user ? (
                    <>
                        <Typography variant="body1" sx={{ display: { xs: 'none', sm: 'block' } }}>
                            Hi, {user.username || user.email}!
                        </Typography>
                        <Button
                            variant="outlined"
                            color="inherit"
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
                            variant="contained"
                            color="primary"
                            component={RouterLink}
                            to="/register"
                            disableElevation
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