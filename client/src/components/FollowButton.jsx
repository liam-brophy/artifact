import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios'; // Import axios

function FollowButton({ targetUserId, initialIsFollowing, onFollowChange }) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        setIsFollowing(initialIsFollowing);
    }, [initialIsFollowing]);

    const handleClick = async () => {
        setIsLoading(true);
        setError(null);

        // Use targetUserId from props
        const url = `/api/users/${targetUserId}/follow`;
        // Determine the correct axios method
        const axiosMethod = isFollowing ? axios.delete : axios.post;
        // Prepare config (only need withCredentials here)
        const config = {
            withCredentials: true,
        };

        try {
            // --- Use axios[method](url, data, config) ---
            // For POST, pass data as second argument (null or {} if no body needed)
            // For DELETE, config is the second argument
            if (isFollowing) { // DELETE request
                 await axiosMethod(url, config); // Equivalent to axios.delete(url, config)
            } else { // POST request
                 await axiosMethod(url, null, config); // Pass null/undefined/{} as data if no body needed
                                                       // Equivalent to axios.post(url, null, config)
            }

            // --- Success ---
            const newState = !isFollowing;
            setIsFollowing(newState);
            if (onFollowChange) {
                onFollowChange(newState);
            }
             // No need for response.ok check

        } catch (err) {
            // --- Axios Error Handling ---
            console.error(`Error ${isFollowing ? 'unfollowing' : 'following'} user:`, err);
            const errorMsg = err.response?.data?.message
                             || (err.response ? `Server error: ${err.response.status}` : null)
                             || err.message
                             || `Could not ${isFollowing ? 'unfollow' : 'follow'} user. Please try again.`;
            setError(errorMsg);
            // No need to revert state optimistically unless desired
        } finally {
            setIsLoading(false);
        }
    };

    // --- Render Logic (remains the same) ---
    return (
        <div className="follow-button-container">
            <button
                onClick={handleClick}
                disabled={isLoading}
                className={`button follow-button ${isFollowing ? 'following' : 'not-following'} ${isLoading ? 'loading' : ''}`}
            >
                {isLoading ? 'Processing...' : (isFollowing ? 'Unfollow' : 'Follow')}
            </button>
            {error && <p className="error-message" style={{ color: 'red', marginTop: '5px', fontSize: '0.9em' }}>{error}</p>}
        </div>
    );
}

FollowButton.propTypes = {
    targetUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, // Allow string or number ID
    initialIsFollowing: PropTypes.bool.isRequired,
    onFollowChange: PropTypes.func,
};

export default FollowButton;