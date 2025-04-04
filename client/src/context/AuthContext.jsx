import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo
} from 'react';

const AuthContext = createContext(null);

// Define storage keys centrally
const TOKEN_STORAGE_KEY = 'token'; // Matches your existing key
const USER_STORAGE_KEY = 'user';   // Matches your existing key

export const AuthProvider = ({ children }) => {
  // --- State Initialization ---
  const [token, setToken] = useState(null); // Start null, read from storage in effect
  const [user, setUser] = useState(null);   // Start null, read from storage in effect
  // Add isLoading state for initial setup from localStorage
  const [isLoading, setIsLoading] = useState(true);
  // Derived state for authentication status
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Start false

  // --- Effect to Initialize State from localStorage ---
  // Runs ONCE on component mount to load initial state
  useEffect(() => {
      console.log("AuthContext: Initializing state from localStorage...");
      try {
          const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
          const storedUserString = localStorage.getItem(USER_STORAGE_KEY);
          let parsedUser = null;

          if (storedUserString) {
              try {
                  parsedUser = JSON.parse(storedUserString);
              } catch (e) {
                  console.error("Failed to parse stored user, removing:", e);
                  localStorage.removeItem(USER_STORAGE_KEY); // Clear invalid stored user data
              }
          }

          if (storedToken) {
              console.log("AuthContext: Found token in storage.");
              setToken(storedToken);
              setUser(parsedUser); // Set user (could be null if parsing failed)
              setIsAuthenticated(true); // Assume authenticated if token exists
          } else {
              console.log("AuthContext: No token found in storage.");
              // Ensure state is clear if no token
              setToken(null);
              setUser(null);
              setIsAuthenticated(false);
          }
      } catch (error) {
          // Should not happen with localStorage but good practice
          console.error("Error reading from localStorage:", error);
           setToken(null);
           setUser(null);
           setIsAuthenticated(false);
      } finally {
          // Finished loading initial state from storage
          console.log("AuthContext: Initial state loading complete.");
          setIsLoading(false);
      }
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Effect to Update localStorage on State Change ---
  // Your existing effect - keep this as is
  useEffect(() => {
      console.log("AuthContext: State changed, updating localStorage...");
      if (localStorage.getItem(TOKEN_STORAGE_KEY)) {
          setToken(localStorage.getItem(TOKEN_STORAGE_KEY));
      } 
      

      if (localStorage.getItem(USER_STORAGE_KEY)) {
          try {
               setUser(JSON.parse(localStorage.getItem(USER_STORAGE_KEY)));
          } catch(e) {
               console.error("Failed to stringify user for storage:", e);
          }
      }
      //  // Update derived isAuthenticated state whenever token changes
      //  setIsAuthenticated(!!token);
      //  console.log("AuthContext: isAuthenticated updated to:", !!token);

  }, []);


  // --- Login Function ---
  // Assumes login API call happened externally, receives results
  const login = useCallback((accessToken, refreshToken, userData) => {
      console.log("AuthContext: login called");
      setToken(accessToken);
      localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      setUser(userData);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      // The useEffect above handles localStorage and isAuthenticated
  }, []);


  // --- Update User Data ---
  const updateUser = useCallback((userData) => {
      console.log("AuthContext: Updating user data");
      setUser(prevUser => ({ ...prevUser, ...userData }));
      // The useEffect above handles localStorage
  }, []);


  // --- Logout Function ---
  const logout = useCallback(() => {
      console.log("AuthContext: logout called");
      setToken(null);
      setUser(null);
      // The useEffect above handles localStorage and isAuthenticated
      // Consider redirecting the user after logout in the component calling this
  }, []);


  // --- Memoized Context Value ---
  const value = useMemo(() => ({
      token,
      user,
      isLoading, // Still useful to know when initial load from localStorage is done
      isAuthenticated, // Use the derived state
      login,
      logout,
      updateUser,
  }), [token, user, isLoading, isAuthenticated, login, logout, updateUser]); // Add isAuthenticated dependency


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// --- Custom Hook (No changes needed) ---
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
      throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};