import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config'; // Import API URL

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth(); // Get login function from context

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Clear previous errors

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Use error message from backend if available
        throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
      }

      // --- Login Success ---
      console.log('Login successful:', data);
      if (data.access_token && data.user) {
        login(data.access_token, data.user); // Update auth context
        navigate('/dashboard'); // Redirect to dashboard (or desired page) after login
      } else {
         throw new Error("Login response missing token or user data.");
      }

    } catch (err) {
      console.error("Login failed:", err);
      setError(err.message || "Failed to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div>
        <h3>Login to your account</h3>
        <form onSubmit={handleSubmit}>
          <div>
            <div>
              <label htmlFor="email">Email</label>
              <input
                type="email"
                placeholder="Email"
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                value={email}
                required
              />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input
                type="password"
                placeholder="Password"
                id="password"
                onChange={(e) => setPassword(e.target.value)}
                value={password}
                required
              />
            </div>
            {error && <p>{error}</p>}
            <div>
              <button
                type="submit"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <Link to="/register">
                Create account
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;