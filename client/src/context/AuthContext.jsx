import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

// Assume you have an apiService configured to send credentials (cookies)
// e.g., using Axios: axios.defaults.withCredentials = true;
// or fetch: fetch(url, { credentials: 'include' });
import apiService from '../services/apiService'; // Adjust path as needed

const AuthContext = createContext(null);

// --- Constants ---
// Define API endpoint for checking auth status (adjust as needed)
const AUTH_STATUS_ENDPOINT = '/auth/status'; // Or '/api/users/me', etc.
const LOGOUT_ENDPOINT = '/api/auth/logout'; // Adjust as needed

export const AuthProvider = ({ children }) => {
  // --- State Initialization ---
  const [user, setUser] = useState(null); // Information about the logged-in user
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Client's belief about auth status
  const [isLoading, setIsLoading] = useState(true); // Loading state for initial auth check

  // --- Effect to Check Authentication Status on Load ---
  // Runs ONCE on component mount to verify session with the server
  useEffect(() => {
    console.log('AuthContext: Mounting - Initializing auth check.');
    const checkAuthStatus = async () => {
      console.log('AuthContext: Setting isLoading = true');
      setIsLoading(true);
      try {
        console.log('AuthContext: Calling apiService.get(AUTH_STATUS_ENDPOINT)');
        const response = await apiService.get(AUTH_STATUS_ENDPOINT);
        console.log('AuthContext: Received response status', response.status);
        console.log('AuthContext: Received response data', response.data);

        if (response.status === 200 && response.data.user) {
          console.log('AuthContext: User FOUND. Setting state:', response.data.user);
          setUser(response.data.user);
          setIsAuthenticated(true);
        } else {
          console.log('AuthContext: User NOT found or null response. Clearing state.');
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('AuthContext: Error during auth check:', error.response?.data || error.message);
        console.log('AuthContext: Clearing state due to error.');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        console.log('AuthContext: Auth check finished. Setting isLoading = false.');
        setIsLoading(false);
      }
    };
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Login Function ---
  // Called *after* a successful API login call which sets the cookie on the server
  const login = useCallback((userData) => {
    // The server handled setting the cookie. We just update the client state.
    console.log('AuthContext: login successful, updating state.', userData);
    setUser(userData);
    setIsAuthenticated(true);
    // No need to handle tokens or localStorage here
  }, []);

  // --- Update User Data ---
  // Useful for profile updates, etc.
  const updateUser = useCallback((newUserData) => {
    console.log("AuthContext: Updating user data in context");
    setUser(prevUser => ({ ...prevUser, ...newUserData }));
    // Optional: Persist non-sensitive parts of user data to localStorage
    // for faster UI rehydration if desired, but it's not the source of auth truth.
    // localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(newUserData.preferences));
  }, []);

  // --- Logout Function ---
  const logout = useCallback(async () => {
    console.log('AuthContext: logout called');
    // Clear client-side state immediately for faster UI update
    setUser(null);
    setIsAuthenticated(false);

    try {
      // Call the server endpoint to clear the HTTP-only cookie
      await apiService.post(LOGOUT_ENDPOINT); // Use POST or appropriate method
      console.log('AuthContext: Server logout successful.');
    } catch (error) {
      // Log error but proceed with client-side logout anyway
      console.error('AuthContext: Error during server logout:', error.response?.data?.message || error.message);
    }
    // No need to handle tokens or localStorage here
    // Consider redirecting the user after logout in the component calling this
  }, []);

  // --- Memoized Context Value ---
  // Provide state and actions to consuming components
  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading, // Crucial for initial load indication
    login,     // Provide the login state update function
    logout,    // Provide the logout function
    updateUser // Provide the user update function
  }), [user, isAuthenticated, isLoading, login, logout, updateUser]);

  // Render provider with context value, children will re-render when value changes
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// --- Custom Hook (No changes needed) ---
// Makes consuming the context easier and type-safe
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    // This error typically means useAuth was called outside of an AuthProvider
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};