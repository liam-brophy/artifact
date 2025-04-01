import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('patron'); // Default role
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!username || !email || !password || !confirmPassword || !role) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    // Add more frontend validation based on backend rules if desired (length, format)

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Use specific error details if backend provides them
        let errorMessage = data.error?.message || `HTTP error! status: ${response.status}`;
        if (data.error?.details) {
            const details = Object.entries(data.error.details)
                .map(([key, value]) => `${key}: ${value}`)
                .join('; ');
            errorMessage += ` (${details})`;
        }
        throw new Error(errorMessage);
      }

      // --- Registration Success ---
      console.log('Registration successful:', data);
      // Optionally show a success message before redirecting
      alert('Registration successful! Please log in.');
      navigate('/login'); // Redirect to login page after successful registration

    } catch (err) {
      console.error("Registration failed:", err);
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="px-8 py-6 mt-4 text-left bg-white shadow-lg rounded-lg">
        <h3 className="text-2xl font-bold text-center">Create an Account</h3>
        <form onSubmit={handleSubmit}>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block" htmlFor="username">Username</label>
              <input
                type="text"
                placeholder="Username"
                id="username"
                onChange={(e) => setUsername(e.target.value)}
                value={username}
                className="w-full px-4 py-2 mt-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
                required
              />
            </div>
             <div>
              <label className="block" htmlFor="email">Email</label>
              <input
                type="email"
                placeholder="Email"
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                value={email}
                className="w-full px-4 py-2 mt-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
                required
              />
            </div>
            <div>
              <label className="block" htmlFor="password">Password</label>
              <input
                type="password"
                placeholder="Password (min 8 characters)"
                id="password"
                onChange={(e) => setPassword(e.target.value)}
                value={password}
                className="w-full px-4 py-2 mt-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
                required
              />
            </div>
             <div>
              <label className="block" htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm Password"
                id="confirmPassword"
                onChange={(e) => setConfirmPassword(e.target.value)}
                value={confirmPassword}
                className="w-full px-4 py-2 mt-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
                required
              />
            </div>
             <div>
              <label className="block" htmlFor="role">Register As</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2 mt-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
              >
                <option value="patron">Patron (Collector)</option>
                <option value="artist">Artist (Creator)</option>
              </select>
            </div>

            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

            <div className="flex items-baseline justify-between">
              <button
                type="submit"
                className="px-6 py-2 mt-4 text-white bg-blue-600 rounded-lg hover:bg-blue-900 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
               <Link to="/login" className="text-sm text-blue-600 hover:underline">
                Already have an account?
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RegisterPage;