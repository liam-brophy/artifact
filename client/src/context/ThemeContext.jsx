import React, { createContext, useState, useContext, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ThemeContext = createContext(null);

// Theme options
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const STORAGE_KEY = 'preferred-theme';

// Create Material UI themes with new color scheme
const getMuiTheme = (mode) => createTheme({
  palette: {
    mode,
    ...(mode === 'light' 
      ? {
          // Light mode colors - white with red accent
          primary: {
            main: '#F50801', // Red accent
          },
          secondary: {
            main: '#F50801', // Red accent
            light: '#ff3b35',
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
          // Dark mode colors - black with teal accent
          primary: {
            main: '#3BDBB2', // Teal accent
          },
          secondary: {
            main: '#3BDBB2', // Teal accent
            light: '#60e2c0',
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
        containedPrimary: {
          color: '#FFFFFF',
        },
      },
    },
  },
});

export const ThemeProvider = ({ children }) => {
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

  // Create MUI theme based on the current theme
  const muiTheme = getMuiTheme(theme);

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

  // Apply theme to document when it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
        setTheme: setSpecificTheme
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