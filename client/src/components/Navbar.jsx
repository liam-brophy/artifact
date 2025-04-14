import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PaletteIcon from '@mui/icons-material/Palette';
import Tooltip from '@mui/material/Tooltip';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ColorPickerDialog from './ColorPickerDialog';

// Import the CSS file
import './NavBar.css';

function Navbar() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const themeClass = isDarkMode ? 'dark-theme' : 'light-theme';
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  // Logo paths based on theme
  const logoSrc = isDarkMode 
    ? '/assets/Artifact_Logo_White.png' 
    : '/assets/Artifact_Logo_Black.png';

  const handleOpenColorPicker = () => {
    setColorPickerOpen(true);
  };

  const handleCloseColorPicker = () => {
    setColorPickerOpen(false);
  };

  return (
    <>
      <AppBar position="fixed" className={`navbar ${themeClass}`} elevation={0}>
        <Toolbar className="navbar-toolbar" disableGutters>
          {/* Left side - Logo only */}
          <Box className="nav-links">
            <RouterLink to="/" className="logo-container">
              <img 
                src={logoSrc} 
                alt="Artifact Logo" 
                className="navbar-logo"
              />
            </RouterLink>
          </Box>

          {/* Right side - User actions */}
          <Box className="nav-actions">
            {/* Artist upload icon */}
            {user && user.role === 'artist' && (
              <Tooltip title="Upload Artwork">
                <IconButton
                  component={RouterLink}
                  to="/upload"
                  className={`upload-icon ${themeClass}`}
                >
                  <CloudUploadIcon />
                </IconButton>
              </Tooltip>
            )}
            
            {/* Color Picker Button - Only show when logged in */}
            {user && (
              <Tooltip title="Choose Accent Color">
                <IconButton
                  onClick={handleOpenColorPicker}
                  className={`color-picker-icon ${themeClass}`}
                >
                  <PaletteIcon />
                </IconButton>
              </Tooltip>
            )}
            
            {/* Theme Toggle Button */}
            <IconButton 
              onClick={toggleTheme} 
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`theme-toggle ${themeClass}`}
            >
              {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>

            {user ? (
              /* Username with link to profile */
              <RouterLink to={`/users/${user.username}`} className={`username-link ${themeClass}`}>
                <Typography variant="body1" className="greeting-text">
                  Hi, {user.username || user.email}!
                </Typography>
              </RouterLink>
            ) : (
              <>
                <Button color="inherit" component={RouterLink} to="/login">
                  Login
                </Button>
                
                <Button
                  variant="contained"
                  component={RouterLink}
                  to="/register"
                  disableElevation
                  className={`primary-button ${themeClass}`}
                >
                  Register
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Color Picker Dialog */}
      <ColorPickerDialog
        open={colorPickerOpen}
        onClose={handleCloseColorPicker}
      />
      
      {/* Add toolbar placeholder to prevent content from hiding under the fixed navbar */}
      <Toolbar />
    </>
  );
}

export default Navbar;