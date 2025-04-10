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
    if (isInitialLoad) {
        setIsLoading(true);
    }

    let fetchedUser = null;

    try {
        // Improved error handling for the auth status request
        const response = await apiService.get(AUTH_STATUS_ENDPOINT);
        
        if (response && response.status === 200 && response.data && response.data.user) {
            fetchedUser = response.data.user;
            setUser(fetchedUser);
            setIsAuthenticated(true);
        } else {
            console.log("Auth status check: Invalid or empty response");
            setUser(null);
            setIsAuthenticated(false);
            setOwnedArtworkIds(new Set());
            if(isInitialLoad) setIsLoading(false);
            return;
        }
    } catch (error) {
        console.error("Auth status check failed:", error.message || error);
        setUser(null);
        setIsAuthenticated(false);
        setOwnedArtworkIds(new Set());
        if(isInitialLoad) setIsLoading(false);
        return;
    }

    if (fetchedUser?.user_id) {
        const userId = fetchedUser.user_id;
        try {
            const collectionResponse = await apiService.get(`/users/${userId}/collected-artworks`, {
                params: { page: 1, per_page: 5000 }
            });

            const ids = collectionResponse.data?.collectedArtworks
                ?.map(item => item?.artwork?.artwork_id)
                .filter(id => id != null) || [];

            const newIdSet = new Set(ids);
            setOwnedArtworkIds(newIdSet);
        } catch (collectionError) {
            setOwnedArtworkIds(new Set());
        }
    } else {
        setOwnedArtworkIds(new Set());
    }

    if (isInitialLoad) {
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
    setUser(userDataFromLoginResponse);
    setIsAuthenticated(true);
    await fetchUserDataAndCollection(false);
  }, [fetchUserDataAndCollection]); // Depend on the fetch function

  // --- Update User Data --- (remains the same)
  const updateUser = useCallback((newUserData) => {
    setUser(prevUser => ({ ...prevUser, ...newUserData }));
  }, []);

  // --- Logout Function ---
  const logout = useCallback(async () => {
    setUser(null);
    setIsAuthenticated(false);
    setOwnedArtworkIds(new Set());

    try {
      await apiService.post(LOGOUT_ENDPOINT);
    } catch (error) {}
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