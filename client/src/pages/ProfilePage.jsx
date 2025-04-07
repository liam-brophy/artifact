import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

// --- Child Component Imports ---
import FollowButton from '../components/FollowButton';
import FollowerList from '../components/FollowerList';
import FollowingList from '../components/FollowingList';

function ProfilePage() {
    const { username: routeUsername } = useParams();
    const { user: loggedInUser, token } = useAuth();

    // State for the profile data being viewed
    const [profileData, setProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    // State for whether the logged-in user is following the profile user
    const [isFollowing, setIsFollowing] = useState(false);

    // Debug logging
    useEffect(() => {
        console.log("loggedInUser:", loggedInUser);
    }, [loggedInUser]);

    // If we're viewing our own profile without a route username, use the user ID instead
    const targetIdentifier = routeUsername || 
                            (loggedInUser?.username) || 
                            (loggedInUser?.user_id ? `id/${loggedInUser.user_id}` : null);
    // Determine if the profile being viewed is the logged-in user's own profile
    const isOwnProfile = 
        loggedInUser && 
        (targetIdentifier === loggedInUser.username || 
         targetIdentifier === `id/${loggedInUser.id}`);

    // Callback function passed to FollowButton to update state here
    const handleFollowChange = useCallback((newState) => {
        setIsFollowing(newState);
        setProfileData(prev => {
            if (!prev || prev.follower_count === undefined) return prev;
            const currentFollowers = Number(prev.follower_count) || 0;
            return {
                ...prev,
                follower_count: Math.max(0, currentFollowers + (newState ? 1 : -1))
            };
        });
    }, []);

    // Fetch profile data when the targetIdentifier changes
    useEffect(() => {
        if (!targetIdentifier) {
            if (!loggedInUser) {
                setError("Please log in to view your profile.");
            } else {
                setError("User information is incomplete. Please update your profile.");
            }
            setIsLoading(false);
            setProfileData(null);
            return;
        }

        const fetchProfile = async () => {
            setIsLoading(true);
            setError(null);
            setProfileData(null);
            setIsFollowing(false);

            try {
                // Determine if we're fetching by ID or username
                const endpoint = targetIdentifier.startsWith('id/') 
                    ? `/api/users/id/${targetIdentifier.split('/')[1]}` 
                    : `/api/users/${targetIdentifier}`;
                
                const response = await apiService.get(endpoint, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    withCredentials: true,
                });

                setProfileData(response.data);

                if (response.data.isFollowing !== undefined) {
                    setIsFollowing(response.data.isFollowing);
                }

            } catch (err) {
                console.error("Error fetching profile:", err);
                const errorMsg = err.response?.data?.message
                                 || (err.response ? `Server error: ${err.response.status}` : null)
                                 || err.message
                                 || "Failed to load profile.";

                if (err.response?.status === 404) {
                    setError(`Profile not found for identifier "${targetIdentifier}".`);
                } else {
                    setError(errorMsg);
                }
                setProfileData(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();

    }, [targetIdentifier, loggedInUser, token]);


    // --- Render Logic ---
    if (isLoading) {
        return <div className="page-container status-message">Loading profile...</div>;
    }

    if (error) {
        return <div className="page-container status-message error-message">Error: {error}</div>;
    }

    if (!profileData) {
        return <div className="page-container status-message">Profile data could not be loaded.</div>;
    }

    // --- Profile Exists - Render Content ---
    return (
        <div className="page-container profile-page" style={{ padding: '20px' }}>
            {/* Profile Header */}
            <div className="profile-header" style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid #ccc' }}>
                {profileData.profile_image_url && (
                    <img
                        src={profileData.profile_image_url}
                        alt={`${profileData.username}'s profile`}
                        className="profile-picture"
                        style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', marginBottom: '15px', float: 'left', marginRight: '20px' }}
                    />
                )}
                <div className="profile-info">
                    <h1>{profileData.username || "User " + profileData.user_id}</h1>
                    <p className="profile-role" style={{ fontStyle: 'italic', color: '#555' }}>Role: {profileData.role || "User"}</p>
                    {profileData.bio && <p className="profile-bio" style={{ marginTop: '10px' }}>{profileData.bio}</p>}

                    {/* Display Follower/Following counts */}
                    <div className="profile-stats" style={{ marginTop: '10px' }}>
                        {profileData.follower_count !== undefined && (
                            <span style={{ marginRight: '15px' }}>
                                Followers: <strong>{profileData.follower_count}</strong>
                            </span>
                        )}
                        {profileData.following_count !== undefined && (
                             <span>
                                Following: <strong>{profileData.following_count}</strong>
                             </span>
                        )}
                    </div>
                </div>
                <div style={{ clear: 'both' }}></div>

                {/* Action Buttons */}
                <div className="profile-actions" style={{ marginTop: '20px' }}>
                    {isOwnProfile ? (
                        <Link to="/settings/profile" className="button button-secondary">
                            Edit Profile
                        </Link>
                    ) : (
                        loggedInUser && profileData.user_id && (
                            <FollowButton
                                targetUserId={profileData.user_id}
                                initialIsFollowing={isFollowing}
                                onFollowChange={handleFollowChange}
                            />
                        )
                    )}
                </div>
            </div>

            {/* Main Profile Content */}
            {/* Rest of your component remains the same */}
            <div className="profile-content">
                {/* Role-Specific Sections */}
                {profileData.role === 'artist' && (
                    <section className="profile-artist-specific-section profile-section" style={{ marginBottom: '30px' }}>
                        <h3>Artworks</h3>
                        {profileData.user_id ? (
                            <p><i>Artwork Grid Placeholder for user {profileData.user_id}</i></p>
                        ) : <p>Cannot load artworks: User ID missing.</p>}
                    </section>
                )}

                {profileData.role === 'patron' && (
                    <section className="profile-patron-specific-section profile-section" style={{ marginBottom: '30px' }}>
                        <h3>Collections</h3>
                         {profileData.user_id ? (
                            <p><i>Collection List Placeholder for user {profileData.user_id}</i></p>
                         ) : <p>Cannot load collections: User ID missing.</p>}
                    </section>
                )}

                {/* Common Sections */}
                {profileData && profileData.user_id && (
                    <>
                        <section className="profile-followers-section profile-section" style={{ marginBottom: '30px' }}>
                            <h3>Followers</h3>
                            <FollowerList userId={profileData.user_id} />
                        </section>

                        <section className="profile-following-section profile-section" style={{ marginBottom: '30px' }}>
                             <h3>Following</h3>
                             <FollowingList userId={profileData.user_id} />
                        </section>
                    </>
                )}
                {!profileData && !isLoading && (
                     <p>Cannot load follower/following lists: User ID missing or profile failed to load.</p>
                )}
            </div>
        </div>
    );
}

export default ProfilePage;