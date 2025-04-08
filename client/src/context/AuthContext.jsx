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
const AUTH_STATUS_ENDPOINT = '/auth/status'; // Or '/api/auth/me', '/api/users/me' etc.
const LOGOUT_ENDPOINT = '/api/auth/logout';

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
    // Only set global loading true on initial load, not on subsequent fetches (e.g., after login)
    if (isInitialLoad) {
        console.log('AuthContext: Initializing auth check.');
        setIsLoading(true);
    } else {
        console.log('AuthContext: Re-fetching user data and collection (e.g., after login).');
    }

    let fetchedUser = null; // Temporary variable to hold user

    try {
        console.log('AuthContext: Calling apiService.get(AUTH_STATUS_ENDPOINT)');
        const response = await apiService.get(AUTH_STATUS_ENDPOINT);
        console.log('AuthContext: Received response status', response.status);
        console.log('AuthContext: Received response data', response.data);

        if (response.status === 200 && response.data.user) {
            console.log('AuthContext: User FOUND.');
            fetchedUser = response.data.user; // Store user temporarily
            setUser(fetchedUser);             // Update user state
            setIsAuthenticated(true);       // Update auth state
        } else {
            console.log('AuthContext: User NOT found or null response. Clearing state.');
            setUser(null);
            setIsAuthenticated(false);
            setOwnedArtworkIds(new Set()); // Clear collection if no user
            if(isInitialLoad) setIsLoading(false); // Stop loading if initial check failed here
            return; // Stop execution if no user found
        }
    } catch (error) {
        console.error('AuthContext: Error during auth check:', error.response?.data || error.message);
        console.log('AuthContext: Clearing state due to error.');
        setUser(null);
        setIsAuthenticated(false);
        setOwnedArtworkIds(new Set()); // Clear collection on error
        if(isInitialLoad) setIsLoading(false); // Stop loading if initial check failed here
        return; // Stop execution on error
    }

    // --- Fetch Collection IDs IF User was found ---
    if (fetchedUser?.user_id) {
        const userId = fetchedUser.user_id;
        console.log(`AuthContext: Fetching collection IDs for user ${userId}`);
        try {
            // Fetch collection data - consider a dedicated lightweight endpoint later
            // For now, fetch with a large limit. Ensure your backend handles large per_page.
            const collectionResponse = await apiService.get(`/users/${userId}/collected-artworks`, {
                params: { page: 1, per_page: 5000 } // Fetch a large number
            });

            // Extract IDs from the 'collectedArtworks' array, accessing the nested 'artwork' object
            const ids = collectionResponse.data?.collectedArtworks
                ?.map(item => item?.artwork?.artwork_id) // Safely access nested ID
                .filter(id => id != null) || [];      // Filter out any null/undefined IDs

            const newIdSet = new Set(ids);
            setOwnedArtworkIds(newIdSet);
            console.log(`AuthContext: Set of owned artwork IDs updated`, newIdSet);

        } catch (collectionError) {
            // Don't block the app if collection fetch fails, just log it
            console.error("AuthContext: Failed to fetch collection IDs:", collectionError.response?.data || collectionError.message);
            setOwnedArtworkIds(new Set()); // Reset to empty set on error
        }
    } else {
        // Should not happen if fetchedUser was set, but as a safeguard
        setOwnedArtworkIds(new Set());
    }
    // -------------------------------------------------

    // Finally, stop loading indicator if it was the initial load
    if (isInitialLoad) {
        console.log('AuthContext: Auth check finished. Setting isLoading = false.');
        setIsLoading(false);
    }
  }, []); // useCallback with empty dependency array makes this function stable

  // --- Effect to Check Authentication Status on Load ---
  useEffect(() => {
    fetchUserDataAndCollection(true); // Pass true for initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUserDataAndCollection]); // Depend on the stable useCallback function

  // --- Login Function ---
  // This function is likely called from your LoginPage component AFTER
  // a successful /api/auth/login API call. Pass the user data from the login response.
  const login = useCallback(async (userDataFromLoginResponse) => {
    console.log('AuthContext: login called with user data:', userDataFromLoginResponse);
    // Immediately update user state for faster UI feedback
    setUser(userDataFromLoginResponse);
    setIsAuthenticated(true);
    // Fetch the collection IDs associated with the logged-in user
    // We refetch everything here to ensure context is fully up-to-date
    await fetchUserDataAndCollection(false); // Pass false as it's not initial load
    console.log('AuthContext: User data and collection refetched after login.');
  }, [fetchUserDataAndCollection]); // Depend on the fetch function

  // --- Update User Data --- (remains the same)
  const updateUser = useCallback((newUserData) => {
    console.log("AuthContext: Updating user data in context");
    setUser(prevUser => ({ ...prevUser, ...newUserData }));
  }, []);

  // --- Logout Function ---
  const logout = useCallback(async () => {
    console.log('AuthContext: logout called');
    // Clear client-side state immediately
    setUser(null);
    setIsAuthenticated(false);
    setOwnedArtworkIds(new Set()); // <-- Clear owned IDs

    try {
      await apiService.post(LOGOUT_ENDPOINT);
      console.log('AuthContext: Server logout successful.');
    } catch (error) {
      console.error('AuthContext: Error during server logout:', error.response?.data?.message || error.message);
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