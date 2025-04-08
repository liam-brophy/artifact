import React, { useState, useEffect } from 'react';
// 1. Import your configured apiService instead of axios
import apiService from '../services/apiService'; // <-- Adjust the path as needed

function FollowButton({ targetUserId, initialIsFollowing, onFollowChange }) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Update local state if the initial prop changes
    useEffect(() => {
        setIsFollowing(initialIsFollowing);
    }, [initialIsFollowing]);

    const handleClick = async () => {
        setIsLoading(true);
        setError(null);

        // 4. Adjust URL - Relative to the baseURL in apiService
        //    (e.g., if baseURL is '/api', this should be '/users/...')
        const url = `/users/${targetUserId}/follow`; // No '/api' prefix needed here

        try {
            // 3. Use apiService methods directly
            if (isFollowing) {
                // --- Unfollow (DELETE) ---
                // No need to pass config, apiService handles it
                await apiService.delete(url);
            } else {
                // --- Follow (POST) ---
                // Pass null or an empty object {} if your endpoint expects a body but doesn't need data
                // Pass nothing if the endpoint doesn't require a body for POST
                // No need to pass config, apiService handles it
                await apiService.post(url, null); // Or await apiService.post(url);
            }

            // --- Success ---
            const newState = !isFollowing;
            setIsFollowing(newState);
            if (onFollowChange) {
                onFollowChange(newState); // Notify parent component
            }

        } catch (err) {
             // --- Error Handling (largely the same) ---
            console.error(`Error ${isFollowing ? 'unfollowing' : 'following'} user:`, err);
            // Try to get a specific error message from the backend response
            const errorMsg = err.response?.data?.error?.message // Check nested error structure if applicable
                             || err.response?.data?.message // Standard message field
                             || (err.response ? `Server error: ${err.response.status}` : null) // Fallback to status code
                             || err.message // Fallback to general error message
                             || `Could not ${isFollowing ? 'unfollow' : 'follow'} user. Please try again.`; // Generic fallback
            setError(errorMsg);
            // Optional: Revert optimistic update on error
            // setIsFollowing(isFollowing);
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

export default FollowButton; // Ensure component is exported