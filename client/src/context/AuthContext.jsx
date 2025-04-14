import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import apiService from '../services/apiService'; // Adjust path as needed

const AuthContext = createContext(null);

// --- Constants ---
const AUTH_STATUS_ENDPOINT = '/auth/status'; // Now points to http://localhost:5000/api/auth/status
const LOGOUT_ENDPOINT = '/auth/logout';      // Now points to http://localhost:5000/api/auth/logout

export const AuthProvider = ({ children }) => {
  // --- State Initialization ---
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // --- New State for Owned Artwork IDs ---
  const [ownedArtworkIds, setOwnedArtworkIds] = useState(new Set()); // Initialize as empty Set

  // --- Renamed Function to Fetch User Data AND Collection ---
  // This runs on initial load and potentially after login
  const fetchUserDataAndCollection = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setIsLoading(true);
    }

    try {
      const response = await apiService.get(AUTH_STATUS_ENDPOINT);
      const fetchedUser = response?.data?.user;
      
      if (fetchedUser) {
        setUser(fetchedUser);
        setIsAuthenticated(true);

        // Only fetch collection if we have a valid user
        if (fetchedUser.user_id) {
          try {
            const collectionResponse = await apiService.get(`/users/${fetchedUser.user_id}/collected-artworks`);
            const ids = collectionResponse.data?.collectedArtworks
              ?.map(item => item?.artwork?.artwork_id)
              .filter(Boolean) || [];
            setOwnedArtworkIds(new Set(ids));
          } catch (err) {
            console.error("Failed to fetch collection:", err);
            // Don't stop the authentication flow due to collection fetch failure
            setOwnedArtworkIds(new Set());
          }
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setOwnedArtworkIds(new Set());
      }
    } catch (error) {
      // Don't treat 401 as an error - it's expected when not logged in
      if (error.response && error.response.status === 401) {
        console.log("User not authenticated - normal state before login");
      } else {
        console.error("Auth status check failed:", error);
      }
      
      setUser(null);
      setIsAuthenticated(false);
      setOwnedArtworkIds(new Set());
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, []); // useCallback with empty dependency array makes this function stable

  // --- Effect to Check Authentication Status on Load ---
  useEffect(() => {
    fetchUserDataAndCollection(true); // Pass true for initial load
    
    // Add event listener for token refresh failure
    const handleTokenRefreshFailure = () => {
      console.log("Token refresh failed, logging out user");
      // Skip the API call when logging out due to token refresh failure
      // since the token is already invalid
      logout(true);
    };
    
    window.addEventListener('auth:tokenRefreshFailed', handleTokenRefreshFailure);
    
    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('auth:tokenRefreshFailed', handleTokenRefreshFailure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUserDataAndCollection]); // Depend on the stable useCallback function

  // --- Login Function ---
  // This function is likely called from your LoginPage component AFTER
  // a successful /api/auth/login API call. Pass the user data from the login response.
  const login = useCallback(async (userDataFromLoginResponse) => {
    setUser(userDataFromLoginResponse);
    setIsAuthenticated(true);
    await fetchUserDataAndCollection(false);
  }, [fetchUserDataAndCollection]); // Depend on the fetch function

  // --- Update User Data ---
  const updateUser = useCallback((newUserData) => {
    setUser(prevUser => {
      // If prevUser is null, initialize with an empty object
      const updatedUser = {...(prevUser || {}), ...newUserData};
      return updatedUser;
    });
  }, []);

  // --- Logout Function ---
  const logout = useCallback(async (skipApiCall = false) => {
    setUser(null);
    setIsAuthenticated(false);
    setOwnedArtworkIds(new Set());

    if (!skipApiCall) {
      try {
        await apiService.post(LOGOUT_ENDPOINT);
      } catch (error) {
        // Silent failure is okay here - we're logging out anyway
        console.log("Logout API call failed, but continuing with client-side logout");
      }
    }
  }, []);

  // --- Memoized Context Value ---
  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateUser,
    fetchUserDataAndCollection, // Expose if needed for manual refresh
    ownedArtworkIds, // <-- Expose the Set of owned IDs
  }), [user, isAuthenticated, isLoading, login, logout, updateUser, ownedArtworkIds, fetchUserDataAndCollection]); // Added ownedArtworkIds and fetch func

  // Render provider
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// --- Custom Hook --- (remains the same)
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};