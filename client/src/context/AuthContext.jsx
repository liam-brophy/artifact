import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Navigate } from 'react-router-dom';
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
      // Debug the auth status API call
      console.log("AuthContext - Making auth status API call to:", AUTH_STATUS_ENDPOINT);
      
      // We're using HTTP-only cookies, so we don't need to manually retrieve or send the token
      // Just make the request and the browser will automatically include the cookies
      const response = await apiService.get(AUTH_STATUS_ENDPOINT);
      
      console.log("AuthContext - Auth status API response:", response.data);
      
      const fetchedUser = response?.data?.user;

      if (fetchedUser) {
        console.log("AuthContext - User found in response, setting authenticated state");
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
        // console.log("User not authenticated - normal state before login");
      } else if (error.response && error.response.status === 422) {
        console.error("Unprocessable entity: Check the request payload or headers");
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
    // Debug logging for auth check
    console.log("AuthContext - Starting initial auth check");
    
    fetchUserDataAndCollection(true).then(result => {
      console.log("AuthContext - Auth check completed successfully", result);
    }).catch((error) => {
      console.error("AuthContext - Error during initial auth check:", error);
      // Make sure loading is set to false even if there's an error
      setIsLoading(false);
    });

    const handleTokenRefreshFailure = () => {
      console.log("AuthContext - Token refresh failed, logging out user");
      logout(true);
    };

    window.addEventListener('auth:tokenRefreshFailed', handleTokenRefreshFailure);

    return () => {
      window.removeEventListener('auth:tokenRefreshFailed', handleTokenRefreshFailure);
    };
  }, [fetchUserDataAndCollection]); // Depend on the stable useCallback function

  // --- Login Function ---
  // This function is called from the LoginPage component AFTER
  // a successful /api/auth/login API call. Pass the user data from the login response.
  const login = useCallback(async (userDataFromLoginResponse) => {
    console.log("AuthContext - Login function called with user data:", userDataFromLoginResponse);
    
    setUser(userDataFromLoginResponse);
    setIsAuthenticated(true);
    
    // No need to store tokens in localStorage as we're using HTTP-only cookies
    // The cookies are automatically sent with each request
    
    // Explicitly fetch auth status to ensure cookies are properly recognized
    try {
      console.log("AuthContext - Refreshing auth data after login");
      // Await the fetch operation to ensure it completes before login function returns
      await fetchUserDataAndCollection(false);
      console.log("AuthContext - Auth refresh completed after login");
      return true; // Indicate successful completion
    } catch (err) {
      console.error("AuthContext - Error refreshing auth after login:", err);
      // Still return true since we've already set authenticated state
      return true;
    }
  }, [fetchUserDataAndCollection]); // Depend on the stable useCallback function

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
    // No need to remove token from localStorage since we're using HTTP-only cookies

    if (!skipApiCall) {
      try {
        await apiService.post(LOGOUT_ENDPOINT);
        // The server should handle clearing the cookies in the response
      } catch (error) {
        // console.log("Logout API call failed, but continuing with client-side logout");
        // Silent failure is okay here - we're logging out anyway
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

  // --- Render with loading state ---
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // --- Render the context provider ---
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