import { useState, useEffect, useCallback } from 'react';

// Key for storing the token in localStorage
const TOKEN_STORAGE_KEY = 'authToken';

export function useAuth() {
    // State for the token itself
    const [token, setToken] = useState(() => {
        // Initialize token from localStorage on initial load
        return localStorage.getItem(TOKEN_STORAGE_KEY);
    });

    // State for user data (optional, fetch if needed based on token)
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Still useful for initial load/user fetch

    // Function to handle successful login
    const login = useCallback((newToken, userData) => {
        localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
        setToken(newToken);
        setUser(userData); // Set user data received during login
    }, []);

    // Function to handle logout
    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
    }, []);

    // Effect to potentially fetch user data if token exists but user is not set
    // Or to validate the token on initial load
    useEffect(() => {
        const validateTokenAndFetchUser = async () => {
            const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
            if (storedToken) {
                 setToken(storedToken); // Ensure state matches storage
                try {
                    // --- IMPORTANT: Replace with your actual API call ---
                    // Example: Call an endpoint like '/api/auth/me' or '/api/users/profile'
                    // This endpoint should validate the token and return user info
                    const response = await fetch('/api/auth/me', { // Your actual profile endpoint
                        headers: {
                            'Authorization': `Bearer ${storedToken}`,
                        },
                    });
                    if (!response.ok) {
                         if (response.status === 401) {
                            // Token is invalid or expired
                             console.warn("Stored token is invalid/expired. Logging out.");
                             logout(); // Automatically log out if token fails validation
                         } else {
                            throw new Error(`Failed to fetch user data (Status: ${response.status})`);
                         }
                    } else {
                         const userData = await response.json();
                         setUser(userData); // Set user based on validated token
                    }
                } catch (error) {
                    console.error("Error validating token or fetching user:", error);
                     // Decide if you want to logout on any fetch error
                     // logout();
                } finally {
                     setIsLoading(false);
                }
            } else {
                 // No token found
                 setToken(null);
                 setUser(null);
                 setIsLoading(false);
            }
        };

        validateTokenAndFetchUser();
        // Dependency array might need adjustment based on your logic
    }, [logout]); // Re-run if logout function reference changes (though unlikely with useCallback)


    // Return the essential auth data and functions
    return {
        token, // <-- Now returning the token!
        user,
        setUser,
        isLoading,
        login,   // <-- Provide login function
        logout,  // <-- Provide logout function
    };
}