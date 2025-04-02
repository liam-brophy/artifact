import React, { useState, useEffect, useContext } from 'react'; // Added useContext
import PropTypes from 'prop-types';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth

function FollowingList({ userId }) {
    const [followingUsers, setFollowingUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token } = useAuth(); // Get token from AuthContext

    useEffect(() => {
         // Don't fetch if the required userId is missing
        if (!userId) {
            setError("User ID is required to fetch the following list.");
            setIsLoading(false);
            return;
        }

        // Don't attempt fetch if the user isn't authenticated (no token)
        if (!token) {
            // setError("You must be logged in to view the following list.");
            setIsLoading(false);
            setFollowingUsers([]); // Ensure list is empty
            return; // Stop the effect
        }

        const fetchFollowing = async () => {
            setIsLoading(true);
            setError(null);
            setFollowingUsers([]);

            try {
                console.log(`Fetching list for user ${userId}. Token being used:`, token);
                // Prepare Axios config with Authorization header
                const config = {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    withCredentials: true, // Keep for consistency or specific backend needs
                };

                // --- API Call with Auth Header ---
                const response = await axios.get(`/api/users/${userId}/following`, config); // Pass config

                // Handle potential data structures
                if (Array.isArray(response.data)) {
                    setFollowingUsers(response.data);
                } else if (response.data && Array.isArray(response.data.following)) {
                     // Adapt if your API returns { following: [...] }
                    setFollowingUsers(response.data.following);
                } else if (response.data && Array.isArray(response.data.items)) {
                    // Adapt if your API returns { items: [...], ... } (common pagination)
                   setFollowingUsers(response.data.items);
                } else {
                    console.warn("Unexpected data format received for following list:", response.data);
                    setFollowingUsers([]); // Set empty if format is wrong
                }

            } catch (err) {
                console.error("Error fetching following list:", err);
                 const errorMsg = err.response?.data?.message
                                 || (err.response?.status === 401 ? "Unauthorized: Could not fetch following list." : null)
                                 || (err.response ? `Server error: ${err.response.status}` : null)
                                 || err.message
                                 || "Failed to load following list.";
                setError(errorMsg);
                setFollowingUsers([]); // Clear data on error
            } finally {
                setIsLoading(false);
            }
        };

        fetchFollowing();

     // Effect dependencies: Re-run if the target userId changes OR if the auth token changes
    }, [userId, token]);

    // --- Render Logic ---

     // Don't render anything or show placeholder if token was missing initially
    if (!token && !isLoading && !error) {
        return <p className="text-muted"><i>Login required to view following list.</i></p>; // Or return null;
    }


    if (isLoading) {
        return <div className="status-message">Loading following list...</div>;
    }

    if (error) {
        // Don't show auth error if we already have the placeholder above
        if (error.includes("Unauthorized") && !token) {
             return <p className="text-muted"><i>Login required to view following list.</i></p>;
        }
        return <div className="status-message error-message">Error: {error}</div>;
    }

    if (followingUsers.length === 0) {
        return <p>This user isn't following anyone yet.</p>;
    }

    return (
        <div className="following-list">
             <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {followingUsers.map((followedUser) => (
                    <li key={followedUser.user_id} className="following-list-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', padding: '5px', borderBottom: '1px solid #eee' }}>
                        {followedUser.profile_image_url && (
                            <img
                                src={followedUser.profile_image_url}
                                alt={followedUser.username}
                                style={{ width: '35px', height: '35px', borderRadius: '50%', marginRight: '10px', objectFit: 'cover' }}
                            />
                        )}
                        <Link to={`/profile/${followedUser.username}`} className="profile-link">
                            {followedUser.username}
                        </Link>
                         {/* Optional: Display followed user's role */}
                         {/* {followedUser.role && <span style={{ marginLeft: 'auto', fontSize: '0.8em', color: '#777' }}>({followedUser.role})</span>} */}
                    </li>
                ))}
            </ul>
            {/* Optional: Add Pagination controls here */}
        </div>
    );
}

FollowingList.propTypes = {
    userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default FollowingList;