import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import CreateIcon from '@mui/icons-material/Create';
import SearchIcon from '@mui/icons-material/Search';
import InputBase from '@mui/material/InputBase';
import Tooltip from '@mui/material/Tooltip';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Fade from '@mui/material/Fade';
import axios from 'axios';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Import the CSS file
import './NavBar.css';

function Navbar() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const themeClass = isDarkMode ? 'dark-theme navbar-transparent' : 'light-theme navbar-transparent';
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [userResults, setUserResults] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  // Logo paths based on theme
  const logoSrc = isDarkMode 
    ? '/assets/Artifact_Logo_White.png' 
    : '/assets/Artifact_Logo_Black.png';

  // Handle search submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  // Toggle search bar visibility
  const toggleSearch = () => {
    setSearchOpen(!searchOpen);
  };

  // Close search when clicking away
  const handleClickAway = () => {
    if (searchOpen && !searchQuery.trim()) {
      setSearchOpen(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const fetchUsers = async () => {
      if (searchQuery.trim()) {
        setIsFetching(true);
        try {
          console.log('Search query:', searchQuery);
          const response = await axios.get(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
          console.log('API response:', response.data);
          setUserResults(response.data.users || []);
          console.log('User results:', userResults);
        } catch (error) {
          console.error('Error fetching user results:', error);
        } finally {
          setIsFetching(false);
        }
      } else {
        setUserResults([]);
      }
    };

    const debounceTimeout = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  // Updated styles for search input transparency
  const searchInputStyles = {
    width: '100%',
    fontSize: '1rem',
    color: isDarkMode ? '#fff' : '#333',
    backgroundColor: isDarkMode ? 'rgba(51, 51, 51, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    '& input': {
      color: isDarkMode ? '#fff' : '#333',
      '&::placeholder': {
        color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
        opacity: 1,
      },
    },
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

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Right side - User actions including search */}
          <Box className="nav-actions">
            {/* Search icon and expandable search */}
            <ClickAwayListener onClickAway={handleClickAway}>
              <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {/* Search Icon */}
                <Tooltip title="Search">
                  <IconButton 
                    onClick={toggleSearch} 
                    aria-label="search"
                    className={`search-icon ${themeClass}`}
                  >
                    <SearchIcon />
                  </IconButton>
                </Tooltip>

                {/* Expandable Search Input */}
                <Fade in={searchOpen}>
                  <form 
                    onSubmit={handleSearchSubmit}
                    className="search-form"
                    style={{ 
                      display: searchOpen ? 'block' : 'none',
                      position: 'absolute',
                      right: '40px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '240px',
                    }}
                  >
                    <InputBase
                      sx={searchInputStyles}
                      placeholder="Search artworks, users..."
                      inputProps={{ 'aria-label': 'search artworks and users' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      className={`search-input ${themeClass}`}
                    />

                    {/* User Results Dropdown */}
                    {isFetching ? (
                      <Box className="search-results" sx={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: isDarkMode ? '#333' : '#fff', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', zIndex: 10, padding: '8px 12px', color: isDarkMode ? '#fff' : '#333', textAlign: 'center' }}>
                        Loading...
                      </Box>
                    ) : userResults.length > 0 ? (
                      <Box className="search-results" sx={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: isDarkMode ? '#333' : '#fff', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', zIndex: 10 }}>
                        {userResults.map((user) => (
                          <RouterLink 
                            key={user.id} 
                            to={`/users/${user.username}`} 
                            className="search-result-item"
                            style={{ display: 'block', padding: '8px 12px', color: isDarkMode ? '#fff' : '#333', textDecoration: 'none' }}
                          >
                            {user.username}
                          </RouterLink>
                        ))}
                      </Box>
                    ) : (
                      <Box className="search-results" sx={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: isDarkMode ? '#333' : '#fff', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', zIndex: 10, padding: '8px 12px', color: isDarkMode ? '#fff' : '#333', textAlign: 'center' }}>
                        No results found
                      </Box>
                    )}
                  </form>
                </Fade>
              </Box>
            </ClickAwayListener>

            {/* Artist upload icon */}
            {user && user.role === 'artist' && (
              <Tooltip title="Create a Card">
                <IconButton
                  component={RouterLink}
                  to="/upload"
                  className={`upload-icon ${themeClass}`}
                >
                  <CreateIcon />
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
      
      {/* Add toolbar placeholder to prevent content from hiding under the fixed navbar */}
      <Toolbar />
    </>
  );
}

export default Navbar;