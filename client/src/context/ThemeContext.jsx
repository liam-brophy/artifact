import React, { createContext, useState, useContext, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

// Theme options
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const STORAGE_KEY = 'preferred-theme';

// Default accent colors for light and dark themes
const DEFAULT_LIGHT_ACCENT = '#F50801'; // Red
const DEFAULT_DARK_ACCENT = '#3BDBB2';  // Teal

// Create Material UI themes with new color scheme
const getMuiTheme = (mode, userAccentColor) => {
  // Use the user's color if available, otherwise use defaults
  const accentColor = userAccentColor || (mode === 'light' ? DEFAULT_LIGHT_ACCENT : DEFAULT_DARK_ACCENT);
  
  // IMPORTANT: For trade status colors, Accepted must be teal green (#10B981) and Rejected must be red (#EF4444)
  return createTheme({
    palette: {
      mode,
      ...(mode === 'light' 
        ? {
            // Light mode colors - white with user's accent or default red
            primary: {
              main: '#6B7280', // Blue-gray for pending status
            },
            secondary: {
              main: accentColor,
              light: accentColor,
            },
            success: {
              main: '#10B981', // Teal green for accepted status
            },
            error: {
              main: '#EF4444', // Vibrant red for rejected status
            },
            background: {
              default: '#FFFFFF', // White background
              paper: '#F8F8F8', // Slight off-white for cards
            },
            text: {
              primary: '#333333',
              secondary: '#666666',
            },
          }
        : {
            // Dark mode colors - black with user's accent or default teal
            primary: {
              main: '#6B7280', // Blue-gray for pending status
            },
            secondary: {
              main: accentColor,
              light: accentColor,
            },
            success: {
              main: '#10B981', // Teal green for accepted status
            },
            error: {
              main: '#EF4444', // Vibrant red for rejected status
            },
            background: {
              default: '#000000', // Black background
              paper: '#121212', // Slightly lighter black for cards
            },
            text: {
              primary: '#FFFFFF',
              secondary: '#AAAAAA',
            },
          }
      ),
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: mode === 'light' 
              ? '0 2px 8px rgba(0, 0, 0, 0.1)'
              : '0 2px 8px rgba(0, 0, 0, 0.5)',
            backgroundColor: mode === 'light' ? '#FFFFFF' : '#000000',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          // Add overrides for all button variants
          root: {
            textTransform: 'none', // Remove uppercase transformation
          },
          containedPrimary: {
            color: '#FFFFFF',
            backgroundColor: '#6B7280', // Blue-gray for Pending
            '&:hover': {
              backgroundColor: '#4B5563', // Darker blue-gray on hover
            },
          },
          // Fixed: Applied teal to success and red to error
          containedSuccess: {
            color: '#FFFFFF',
            backgroundColor: '#10B981', // Teal for Accepted
            '&:hover': {
              backgroundColor: '#059669', // Darker teal on hover
            },
          },
          containedError: {
            color: '#FFFFFF',
            backgroundColor: '#EF4444', // Red for Rejected
            '&:hover': {
              backgroundColor: '#DC2626', // Darker red on hover
            },
          },
          outlinedPrimary: {
            color: '#6B7280', // Blue-gray for Pending
            borderColor: '#6B7280',
            '&:hover': {
              borderColor: '#4B5563', // Darker blue-gray on hover
              backgroundColor: 'rgba(107, 114, 128, 0.04)',
            },
          },
          // Fixed: Applied teal to success and red to error
          outlinedSuccess: {
            color: '#10B981', // Teal for Accepted
            borderColor: '#10B981',
            '&:hover': {
              borderColor: '#059669', // Darker teal on hover
              backgroundColor: 'rgba(16, 185, 129, 0.04)',
            },
          },
          outlinedError: {
            color: '#EF4444', // Red for Rejected
            borderColor: '#EF4444',
            '&:hover': {
              borderColor: '#DC2626', // Darker red on hover
              backgroundColor: 'rgba(239, 68, 68, 0.04)',
            },
          },
        },
      },
      // Override Chip styling to ensure consistent colors
      MuiChip: {
        styleOverrides: {
          colorSuccess: {
            backgroundColor: '#10B981', // Ensure Accepted chips use teal
            color: '#FFFFFF',
          },
          colorError: {
            backgroundColor: '#EF4444', // Ensure Rejected chips use red
            color: '#FFFFFF',
          },
          colorPrimary: {
            backgroundColor: '#6B7280', // Ensure Pending chips use blue-gray
            color: '#FFFFFF',
          },
          outlinedSuccess: {
            color: '#10B981',
            borderColor: '#10B981',
          },
          outlinedError: {
            color: '#EF4444',
            borderColor: '#EF4444',
          },
          outlinedPrimary: {
            color: '#6B7280',
            borderColor: '#6B7280',
          }
        }
      }
    },
  });
};

// Helper to apply CSS custom properties to the document root
const applyCustomProperties = (theme, accentColor) => {
  const root = document.documentElement;
  
  // Set the theme attribute
  root.setAttribute('data-theme', theme);
  
  // Set the accent color and accent hover CSS variables
  if (accentColor) {
    // Set main accent color
    root.style.setProperty('--accent-color', accentColor);
    
    // Calculate a slightly darker version for hover state (20% darker)
    const darkenColor = (color) => {
      // This is a simplified approach - for production you might want a more sophisticated color manipulation
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      const darkenFactor = 0.8; // 20% darker
      const newR = Math.floor(r * darkenFactor);
      const newG = Math.floor(g * darkenFactor);
      const newB = Math.floor(b * darkenFactor);
      
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    };
    
    root.style.setProperty('--accent-hover', darkenColor(accentColor));
  } else {
    // Reset to theme defaults
    if (theme === THEME_LIGHT) {
      root.style.setProperty('--accent-color', DEFAULT_LIGHT_ACCENT);
      root.style.setProperty('--accent-hover', '#D90701'); // Slightly darker red
    } else {
      root.style.setProperty('--accent-color', DEFAULT_DARK_ACCENT);
      root.style.setProperty('--accent-hover', '#2FC69F'); // Slightly darker teal
    }
  }
};

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth(); // Get current user from AuthContext
  
  // Initialize theme from localStorage or system preference
  const [theme, setTheme] = useState(() => {
    // Check if running in a browser environment
    if (typeof window !== 'undefined') {
      // Check local storage first
      const storedTheme = localStorage.getItem(STORAGE_KEY);
      if (storedTheme) {
        return storedTheme;
      }

      // Otherwise use prefers-color-scheme media query
      return window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? THEME_DARK 
        : THEME_LIGHT;
    }
    // Fallback for non-browser environments
    return THEME_LIGHT;
  });

  // Get the user's favorite color if available
  const userAccentColor = user?.favorite_color || null;

  // Create MUI theme based on the current theme and user accent color
  const muiTheme = getMuiTheme(theme, userAccentColor);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(currentTheme => {
      const newTheme = currentTheme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
      localStorage.setItem(STORAGE_KEY, newTheme);
      return newTheme;
    });
  };

  // Set a specific theme
  const setSpecificTheme = (newTheme) => {
    if (newTheme === THEME_LIGHT || newTheme === THEME_DARK) {
      localStorage.setItem(STORAGE_KEY, newTheme);
      setTheme(newTheme);
    }
  };

  // Apply theme and accent color to document when they change
  useEffect(() => {
    applyCustomProperties(theme, userAccentColor);
  }, [theme, userAccentColor]);

  // Listen for system theme changes
  useEffect(() => {
    // Check if running in a browser environment
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e) => {
        // Only update if user hasn't set a preference
        if (!localStorage.getItem(STORAGE_KEY)) {
          setTheme(e.matches ? THEME_DARK : THEME_LIGHT);
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDarkMode: theme === THEME_DARK,
        toggleTheme,
        setTheme: setSpecificTheme,
        accentColor: userAccentColor || (theme === THEME_LIGHT ? DEFAULT_LIGHT_ACCENT : DEFAULT_DARK_ACCENT)
      }}
    >
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// Custom hook for using the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};