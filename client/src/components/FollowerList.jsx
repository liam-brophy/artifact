import React, { useState, useEffect, useContext } from 'react'; // Added useContext
import PropTypes from 'prop-types';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth

function FollowerList({ userId }) {
    const [followers, setFollowers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token } = useAuth(); // Get token from AuthContext

    useEffect(() => {
        // Don't fetch if the required userId is missing
        if (!userId) {
            setError("User ID is required to fetch followers.");
            setIsLoading(false);
            return;
        }

        // Don't attempt fetch if the user isn't authenticated (no token)
        // The route requires authentication, so fetching without a token will fail.
        if (!token) {
             // Set a state that indicates login is required, or just show nothing/loading
             //setError("You must be logged in to view followers."); // Or could return null/empty
             setIsLoading(false); // Stop loading indicator
             setFollowers([]); // Ensure list is empty
             return; // Stop the effect
        }
        
        const fetchFollowers = async () => {
            setIsLoading(true);
            setError(null);
            setFollowers([]);

            try {
                console.log(`Fetching list for user ${userId}. Token being used:`, token);
                // Prepare Axios config with Authorization header
                const config = {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    // You might still need withCredentials depending on backend CORS and cookie settings,
                    // but the primary auth mechanism here is the Bearer token.
                    withCredentials: true,
                };

                // --- API Call with Auth Header ---
                const response = await axios.get(`/api/users/${userId}/followers`, config); // Pass config

                // Handle potential data structures (direct array or paginated)
                if (Array.isArray(response.data)) {
                    setFollowers(response.data);
                } else if (response.data && Array.isArray(response.data.followers)) {
                    // Adapt if your API returns { followers: [...] }
                    setFollowers(response.data.followers);
                } else if (response.data && Array.isArray(response.data.items)) {
                     // Adapt if your API returns { items: [...], ... } (common pagination)
                    setFollowers(response.data.items);
                }
                 else {
                    console.warn("Unexpected data format received for followers:", response.data);
                    setFollowers([]); // Set empty if format is wrong
                }

            } catch (err) {
                console.error("Error fetching followers:", err);
                const errorMsg = err.response?.data?.message
                                 || (err.response?.status === 401 ? "Unauthorized: Could not fetch followers." : null)
                                 || (err.response ? `Server error: ${err.response.status}` : null)
                                 || err.message
                                 || "Failed to load followers.";
                setError(errorMsg);
                 setFollowers([]); // Clear data on error
            } finally {
                setIsLoading(false);
            }
        };

        fetchFollowers();

    // Effect dependencies: Re-run if the target userId changes OR if the auth token changes
    }, [userId, token]);

    // --- Render Logic ---

    // Don't render anything or show placeholder if token was missing initially
    if (!token && !isLoading && !error) {
        return <p className="text-muted"><i>Login required to view followers.</i></p>; // Or return null;
    }

    if (isLoading) {
        return <div className="status-message">Loading followers...</div>;
    }

    if (error) {
        // Don't show auth error if we already have the placeholder above
        if (error.includes("Unauthorized") && !token) {
             return <p className="text-muted"><i>Login required to view followers.</i></p>;
        }
        return <div className="status-message error-message">Error: {error}</div>;
    }

    if (followers.length === 0) {
        return <p>This user currently has no followers.</p>;
    }

    return (
        <div className="follower-list">
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {followers.map((follower) => (
                    <li key={follower.user_id} className="follower-list-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', padding: '5px', borderBottom: '1px solid #eee' }}>
                        {follower.profile_image_url && (
                            <img
                                src={follower.profile_image_url}
                                alt={follower.username}
                                style={{ width: '35px', height: '35px', borderRadius: '50%', marginRight: '10px', objectFit: 'cover' }}
                            />
                        )}
                        <Link to={`/profile/${follower.username}`} className="profile-link">
                            {follower.username}
                        </Link>
                         {/* Optional: Display follower role */}
                         {/* {follower.role && <span style={{ marginLeft: 'auto', fontSize: '0.8em', color: '#777' }}>({follower.role})</span>} */}
                    </li>
                ))}
            </ul>
            {/* Optional: Add Pagination controls here */}
        </div>
    );
}

FollowerList.propTypes = {
    userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default FollowerList;