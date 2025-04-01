import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
  const [user, setUser] = useState(() => {
      const storedUser = localStorage.getItem('user');
      try {
          return storedUser ? JSON.parse(storedUser) : null;
      } catch (e) {
          console.error("Failed to parse stored user:", e);
          return null;
      }
  });

  // Effect to update localStorage when state changes
  useEffect(() => {
    if (authToken) {
      localStorage.setItem('authToken', authToken);
    } else {
      localStorage.removeItem('authToken');
    }

    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [authToken, user]);

  const login = (token, userData) => {
    setAuthToken(token);
    setUser(userData);
  };

  const logout = () => {
    // Call backend logout if implemented (to blocklist refresh token)
    // fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('refreshToken')}` }}); // Assuming you store refresh token
    setAuthToken(null);
    setUser(null);
    // Also remove refresh token from storage if used
  };

  const value = {
    authToken,
    user,
    login,
    logout,
    isAuthenticated: !!authToken, // Simple check based on token existence
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context easily
export const useAuth = () => {
  return useContext(AuthContext);
};