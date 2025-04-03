import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
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
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }

    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [token, user]);

  const login = (accessToken, refreshToken, userData) => { // NEW - Accept all 3 args
    console.log("AuthContext: login called with:", { accessToken, refreshToken, userData });
    setToken(accessToken); // Use the correct access token
    // Decide if/how you want to store/use the refreshToken (localStorage, state, etc.)
    // For now, we just need to make sure userData is assigned correctly:
    setUser(userData); // Use the correct user data object
  };

  const updateUser = (userData) => {
    console.log("Updating user data:", userData);
    setUser(userData);
  };

  const logout = () => {
    // Call backend logout if implemented (to blocklist refresh token)
    setToken(null);
    setUser(null);
  };

  const value = {
    token,
    user,
    login,
    logout,
    updateUser,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context easily
export const useAuth = () => {
  return useContext(AuthContext);
};