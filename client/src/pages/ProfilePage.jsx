import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom'; // Import RouterLink
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';

// Import components we'll still use
import ArtworkCard from '../components/ArtworkCard';
import CircularProgress from '@mui/material/CircularProgress'; // Keep for loading
import Alert from '@mui/material/Alert'; // Keep for errors
import Button from '@mui/material/Button'; // Keep for actions
import Pagination from '@mui/material/Pagination'; // Keep for pagination UI

// Import the CSS file for styling
import './ProfilePage.css';

function ProfilePage() {
    const { username } = useParams();
    const { user: loggedInUser, isLoading: isAuthLoading, isAuthenticated, ownedArtworkIds = new Set() } = useAuth();

    // Profile User State
    const [profileUser, setProfileUser] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [errorProfile, setErrorProfile] = useState(null);
    const [isFollowing, setIsFollowing] = useState(false);

    // Artworks State (Created or Collected)
    const [displayedArtworks, setDisplayedArtworks] = useState([]);
    const [isLoadingArtworks, setIsLoadingArtworks] = useState(false);
    const [errorArtworks, setErrorArtworks] = useState(null);
    const [paginationData, setPaginationData] = useState({ totalPages: 1, currentPage: 1, perPage: 12 });
    const [currentPage, setCurrentPage] = useState(1);

    // Derived State
    const isOwnProfile = isAuthenticated && profileUser && loggedInUser?.user_id === profileUser.user_id;

    // --- Fetch Profile User Data ---
    useEffect(() => {
        if (!username) {
            setErrorProfile("Username parameter is missing.");
            setIsLoadingProfile(false);
            return;
        }
        const fetchProfile = async () => {
            setIsLoadingProfile(true);
            setErrorProfile(null);
            // Reset states on username change
            setProfileUser(null);
            setDisplayedArtworks([]);
            setErrorArtworks(null);
            setIsLoadingArtworks(false);
            setCurrentPage(1);
            setPaginationData({ totalPages: 1, currentPage: 1, perPage: 12 });
            setIsFollowing(false);

            try {
                // Assuming API returns { user: {...}, is_followed_by_viewer: boolean }
                const response = await apiService.get(`/users/${username}`);
                setProfileUser(response.data.user || response.data);
                setIsFollowing(response.data.is_followed_by_viewer || false);
            } catch (err) {
                console.error("Failed to fetch profile:", err);
                const message = err.response?.data?.error?.message || err.response?.data?.message || (err.response?.status === 404 ? `Profile not found for user: ${username}` : null) || err.message || "Could not load profile.";
                setErrorProfile(message);
            } finally {
                setIsLoadingProfile(false);
            }
        };
        fetchProfile();
    }, [username, loggedInUser?.user_id]); // Refetch if username or loggedInUser changes

    // --- Fetch Artworks ---
    useEffect(() => {
        if (!profileUser?.user_id || errorProfile) {
             setIsLoadingArtworks(false); setDisplayedArtworks([]); return; // Skip if no profile user or error
        }

        let endpoint = '';
        let isFetchingCollected = false;

        if (isOwnProfile) { // Viewing Own Profile
            if (profileUser.role === 'artist') endpoint = `/users/${profileUser.user_id}/created-artworks`;
            else if (profileUser.role === 'patron') { endpoint = `/users/${profileUser.user_id}/collected-artworks`; isFetchingCollected = true; }
        } else { // Viewing Someone Else's Profile
            if (profileUser.role === 'artist') endpoint = `/users/${profileUser.user_id}/created-artworks`;
            // else: Don't fetch for other patrons
        }

        if (!endpoint) { // No valid endpoint determined (e.g., viewing other patron)
             setIsLoadingArtworks(false); setDisplayedArtworks([]); return;
        }

        const fetchArtworks = async (page) => {
            setIsLoadingArtworks(true); setErrorArtworks(null);
            try {
                const response = await apiService.get(endpoint, { params: { page } });
                let artworksForState = [];
                if (isFetchingCollected) artworksForState = response.data.collectedArtworks?.map(item => item.artwork).filter(art => art != null) || [];
                else artworksForState = response.data.artworks || [];

                setDisplayedArtworks(artworksForState);
                if (response.data.pagination) setPaginationData(response.data.pagination);
                else setPaginationData({ totalItems: artworksForState.length, totalPages: 1, currentPage: 1, perPage: artworksForState.length || 12, hasNext: false, hasPrev: false });
            } catch (err) {
                console.error(`Failed to fetch artworks from ${endpoint}:`, err);
                setErrorArtworks(err.response?.data?.error?.message || err.message || "Could not load artworks.");
                setDisplayedArtworks([]);
                setPaginationData({ totalPages: 1, currentPage: 1, perPage: 12 });
            } finally { setIsLoadingArtworks(false); }
        };

        fetchArtworks(currentPage);
    }, [profileUser?.user_id, profileUser?.role, isOwnProfile, currentPage, errorProfile]); // Dependencies

    // --- Follow/Unfollow Handlers ---
    const handleFollowToggle = useCallback(async () => {
        if (!profileUser?.user_id || !isAuthenticated) return;
        const action = isFollowing ? 'delete' : 'post';
        const endpoint = isFollowing ? `/follows/${profileUser.user_id}` : `/follows`; // Adjust endpoint structure as needed
        const body = isFollowing ? null : { followed_id: profileUser.user_id };

        try {
            if (action === 'post') await apiService.post(endpoint, body);
            else await apiService.delete(endpoint); // Assumes DELETE for unfollow

            // Toggle state and optimistically update count
            setIsFollowing(!isFollowing);
            setProfileUser(prev => ({
                 ...prev,
                 followers_count: (prev.followers_count ?? 0) + (isFollowing ? -1 : 1)
            }));
        } catch (err) {
            console.error(`Failed to ${action} follow user:`, err);
            // Add user feedback (e.g., toast notification)
        }
    }, [profileUser?.user_id, isAuthenticated, isFollowing]);

    // --- Pagination Handler ---
    const handlePageChange = (event, value) => {
        if (value !== currentPage) setCurrentPage(value);
    };

    // --- Render Logic ---
    if (isAuthLoading || isLoadingProfile) {
        return <div className="profile-loading-container"><CircularProgress /></div>;
    }
    if (errorProfile) {
        return <div className="profile-error-container"><Alert severity="error">{errorProfile}</Alert></div>;
    }
    if (!profileUser) {
        return <div className="profile-error-container"><Alert severity="warning">Profile data could not be loaded for '{username}'.</Alert></div>;
    }

    // Determine if artworks should be shown based on logic
    const shouldShowArtworks = (profileUser.role === 'artist' || (profileUser.role === 'patron' && isOwnProfile));

    return (
        <div className="profile-page-container"> {/* Main container */}

            {/* Profile Header Section */}
            <section className="profile-header">
                <div className="profile-info">
                    <h1 className="profile-username">{profileUser.username}</h1>
                    <p className="profile-role">Role: {profileUser.role}</p>
                    <div className="profile-social-counts">
                        <span>Followers: {profileUser.followers_count ?? 0}</span>
                        <span>Following: {profileUser.following_count ?? 0}</span>
                    </div>
                </div>
                <div className="profile-actions">
                    {isAuthenticated && !isOwnProfile && (
                        <Button
                            variant={isFollowing ? "outlined" : "contained"}
                            onClick={handleFollowToggle}
                            size="small"
                            className={`profile-follow-button ${isFollowing ? 'following' : ''}`}
                        >
                            {isFollowing ? 'Unfollow' : 'Follow'}
                        </Button>
                    )}
                    {isOwnProfile && (
                         <Button
                            variant="outlined"
                            size="small"
                            component={RouterLink}
                            to="/settings" /* Or your edit profile route */
                            className="profile-edit-button"
                         >
                             Edit Profile
                         </Button>
                     )}
                </div>
            </section>

            {/* Artwork Display Section */}
            {shouldShowArtworks ? (
                <section className="profile-artworks-section">
                    <h2 className="profile-artworks-title">
                        {isOwnProfile
                            ? (profileUser.role === 'artist' ? 'My Created Artworks' : 'My Collected Artworks')
                            : `${profileUser.username}'s Artworks`
                        }
                    </h2>

                    {isLoadingArtworks && (<div className="profile-artworks-loading"><CircularProgress /></div>)}
                    {errorArtworks && !isLoadingArtworks && (<div className="profile-artworks-error"><Alert severity="warning">{errorArtworks}</Alert></div>)}

                    {!isLoadingArtworks && !errorArtworks && displayedArtworks.length === 0 && (
                        <p className="profile-artworks-empty">
                            No {isOwnProfile && profileUser.role === 'patron' ? 'collected' : 'artworks'} found.
                        </p>
                    )}

                    {!isLoadingArtworks && !errorArtworks && displayedArtworks.length > 0 && (
                        <>
                            <div className="profile-artworks-grid"> {/* Use CSS Grid or Flexbox */}
                                {displayedArtworks.map((artwork) => {
                                    const isOwnedByViewer = ownedArtworkIds.has(artwork?.artwork_id);
                                    // Blur only when viewing someone else's ARTIST profile and viewer doesn't own it
                                    const shouldBlur = !isOwnProfile && profileUser.role === 'artist' && !isOwnedByViewer;

                                    return artwork ? (
                                        <div
                                            key={artwork.artwork_id}
                                            className={`profile-artwork-item ${shouldBlur ? 'artwork-blurred' : ''}`}
                                        >
                                            <ArtworkCard artwork={artwork} />
                                        </div>
                                    ) : null;
                                })}
                            </div>

                            {/* Pagination */}
                            {paginationData.totalPages > 1 && (
                                <div className="profile-pagination-container">
                                    <Pagination
                                        count={paginationData.totalPages}
                                        page={currentPage}
                                        onChange={handlePageChange}
                                        color="primary" // MUI prop
                                        // Add classes here if you want to style Pagination further
                                    />
                                </div>
                            )}
                        </>
                    )}
                </section>
            ) : (
                // Message if viewing another Patron's profile (or adjust as needed)
                <section className="profile-artworks-private">
                    <p>
                        {profileUser.role === 'patron' ? "Patrons' collections are private." : "No artworks to display for this profile."}
                    </p>
                </section>
            )}
        </div> // End profile-page-container
    );
}

export default ProfilePage;