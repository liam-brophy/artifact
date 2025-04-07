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
const AUTH_STATUS_ENDPOINT = '/api/auth/status'; // Or '/api/users/me', etc.
const LOGOUT_ENDPOINT = '/api/auth/logout'; // Adjust as needed

export const AuthProvider = ({ children }) => {
  // --- State Initialization ---
  const [user, setUser] = useState(null); // Information about the logged-in user
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Client's belief about auth status
  const [isLoading, setIsLoading] = useState(true); // Loading state for initial auth check

  // --- Effect to Check Authentication Status on Load ---
  // Runs ONCE on component mount to verify session with the server
  useEffect(() => {
      console.log('AuthContext: Checking authentication status with server...');
      const checkAuthStatus = async () => {
          setIsLoading(true); // Start loading
          try {
              // Make API call to server endpoint that checks the HTTP-only cookie
              const response = await apiService.get(AUTH_STATUS_ENDPOINT);

              // Assuming the server responds with user data if authenticated
              if (response.status === 200 && response.data.user) {
                  console.log('AuthContext: User is authenticated.', response.data.user);
                  setUser(response.data.user);
                  setIsAuthenticated(true);
              } else {
                  // Handle cases where the endpoint returns OK but no user (e.g., session valid but data missing - depends on API design)
                  // Or if the API returns a specific status code for "not authenticated" but not an error (e.g., 204 No Content)
                  console.log('AuthContext: User is not authenticated (server response).');
                  setUser(null);
                  setIsAuthenticated(false);
              }
          } catch (error) {
              // If the API call fails (e.g., 401 Unauthorized, network error), assume not authenticated
              console.error('AuthContext: Error checking auth status:', error.response?.data?.message || error.message);
              setUser(null);
              setIsAuthenticated(false);
          } finally {
              // Finished initial check
              console.log('AuthContext: Initial auth check complete.');
              setIsLoading(false);
          }
      };

      checkAuthStatus();
      // No dependencies needed, runs only once on mount
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