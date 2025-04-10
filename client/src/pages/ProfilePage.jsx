import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// MUI Components (keep for now)
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert'; // Keep for specific non-API errors if needed
import Grid from '@mui/material/Grid';
import Pagination from '@mui/material/Pagination';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack'; // Optional, replace with CSS if desired

// Import Components
import ArtworkCard from '../components/ArtworkCard';

// Import the CSS file
import './ProfilePage.css'; // Ensure you have this file

function ProfilePage() {
    const { username } = useParams();
    const { user: loggedInUser, isLoading: isAuthLoading, isAuthenticated, ownedArtworkIds = new Set(), logout } = useAuth();
    const navigate = useNavigate();

    // Profile State
    const [profileUser, setProfileUser] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [profileLoadError, setProfileLoadError] = useState(null); // For specific profile load failure msg
    const [isFollowing, setIsFollowing] = useState(false);

    // Artworks State
    const [displayedArtworks, setDisplayedArtworks] = useState([]);
    const [isLoadingArtworks, setIsLoadingArtworks] = useState(false);
    // Error state for artwork fetch (optional, if specific handling needed beyond toast)
    // const [errorArtworks, setErrorArtworks] = useState(null);
    const [paginationData, setPaginationData] = useState({ totalPages: 1, currentPage: 1, perPage: 12, totalItems: 0, hasNext: false, hasPrev: false });
    const [currentPage, setCurrentPage] = useState(1);

    // Delete Dialog State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Derived State
    const isOwnProfile = isAuthenticated && profileUser && loggedInUser?.user_id === profileUser.user_id;

    // --- Fetch Profile User Data ---
    useEffect(() => {
        if (!username) {
            setProfileLoadError("Username parameter missing.");
            setIsLoadingProfile(false);
            return;
        }
        const fetchProfile = async () => {
            setIsLoadingProfile(true);
            setProfileLoadError(null); // Reset specific error
            setProfileUser(null);
            setDisplayedArtworks([]);
            // setErrorArtworks(null); // Reset if using local state
            setIsLoadingArtworks(false);
            setCurrentPage(1);
            setPaginationData({ totalPages: 1, currentPage: 1, perPage: 12, totalItems: 0, hasNext: false, hasPrev: false });
            setIsFollowing(false);
            setIsDeleteDialogOpen(false);
            setIsDeleting(false);

            try {
                const response = await apiService.get(`/users/${username}`);
                setProfileUser(response.data.user || response.data);
                setIsFollowing(response.data.is_followed_by_viewer || false);
            } catch (err) {
                console.error("ProfilePage: Failed to fetch profile:", err);
                const message = err.response?.data?.error?.message || err.response?.data?.message || (err.response?.status === 404 ? `Profile not found for user: ${username}` : null) || err.message || "Could not load profile.";
                setProfileLoadError(message); // Set specific error for conditional render
                // Interceptor will show a toast for general API errors (like 500)
                 if (err.response?.status === 404) {
                     toast.error(`Profile not found for ${username}`, { id: 'profile-not-found'});
                 }
            } finally {
                setIsLoadingProfile(false);
            }
        };
        fetchProfile();
    }, [username, loggedInUser?.user_id]);

    // --- Fetch Artworks ---
    useEffect(() => {
        // Don't fetch if profile hasn't loaded or failed specifically
        if (!profileUser?.user_id || profileLoadError) {
            setIsLoadingArtworks(false);
            setDisplayedArtworks([]);
            return;
        }

        let endpoint = '';
        let isFetchingCollected = false;

        if (isOwnProfile) {
            if (profileUser.role === 'artist') {
                endpoint = `/users/${profileUser.user_id}/created-artworks`;
            } else if (profileUser.role === 'patron') {
                endpoint = `/users/${profileUser.user_id}/collected-artworks`;
                isFetchingCollected = true;
            }
        } else {
            if (profileUser.role === 'artist') {
                endpoint = `/users/${profileUser.user_id}/created-artworks`;
            }
            // else: Viewing other patron - no endpoint set
        }

        if (!endpoint) {
            setIsLoadingArtworks(false);
            setDisplayedArtworks([]);
            return; // Don't fetch if no endpoint determined
        }

        const fetchArtworks = async (page) => {
            setIsLoadingArtworks(true);
            // setErrorArtworks(null); // Clear local error state if using it
            try {
                const response = await apiService.get(endpoint, { params: { page } }); // Assuming backend uses 'page'

                let artworksForState = [];
                if (isFetchingCollected) {
                    artworksForState = response.data.collectedArtworks?.map(item => item.artwork).filter(art => art != null) || [];
                } else {
                    artworksForState = response.data.artworks || [];
                }

                setDisplayedArtworks(artworksForState);

                if (response.data.pagination) {
                    setPaginationData(response.data.pagination);
                } else {
                    // Reset or provide default if backend doesn't return pagination
                    setPaginationData({ totalItems: artworksForState.length, totalPages: 1, currentPage: 1, perPage: artworksForState.length || 12, hasNext: false, hasPrev: false });
                }
            } catch (err) {
                // Interceptor will show toast error. Component logs it.
                console.error(`ProfilePage: Failed to fetch artworks from ${endpoint}:`, err);
                // setErrorArtworks("Could not load artworks."); // Set local state if needed for UI
                setDisplayedArtworks([]);
                setPaginationData({ totalPages: 1, currentPage: 1, perPage: 12, totalItems: 0, hasNext: false, hasPrev: false }); // Reset pagination
            } finally {
                setIsLoadingArtworks(false);
            }
        };

        fetchArtworks(currentPage);
    // Depend on profile ID, role (in case it changes?), ownership, page, and profile error status
    }, [profileUser?.user_id, profileUser?.role, isOwnProfile, currentPage, profileLoadError]);

    // --- Follow/Unfollow Handler ---
    const handleFollowToggle = useCallback(async () => {
        if (!profileUser?.user_id || !isAuthenticated) return;

        const targetUserId = profileUser.user_id; // ID of the user being viewed/followed/unfollowed
        const action = isFollowing ? 'delete' : 'post';

        // --- CORRECTED ENDPOINTS ---
        // Both POST and DELETE target the same path structure in your backend
        const endpoint = `/users/${targetUserId}/follow`;
        // -------------------------

        // Body is only needed for POST
        const body = action === 'post' ? {} : null; // No body needed for follow based on your backend

        // Use toast.promise for follow/unfollow actions
        const followPromise = action === 'post'
            ? apiService.post(endpoint, body) // POST to /users/<id>/follow
            : apiService.delete(endpoint);    // DELETE to /users/<id>/follow

        toast.promise(
            followPromise,
            {
                loading: isFollowing ? 'Unfollowing...' : 'Following...',
                success: (response) => { // Receive response on success
                    // Toggle state and optimistically update count
                    setIsFollowing(!isFollowing);
                    setProfileUser(prev => ({
                        ...prev,
                        // Optimistic update: Increment/decrement based on the *previous* state
                        followers_count: (prev.followers_count ?? 0) + (isFollowing ? -1 : 1)
                    }));
                    // Use message from backend if available (POST returns one)
                    // DELETE returns 204 No Content, so response.data might be empty
                    const successMsg = action === 'post'
                        ? (response?.data?.message || `Successfully followed ${profileUser.username}!`)
                        : `Successfully unfollowed ${profileUser.username}!`;
                    return successMsg; // Toast message
                },
                error: (err) => {
                    // Interceptor should show detailed error, this is fallback/summary
                    console.error(`ProfilePage: Failed to ${action} follow:`, err);
                    // Check for specific conflict error from backend
                    if (err.response?.status === 409) {
                         return "Already following this user."; // Specific message for conflict
                    }
                    return `Could not ${isFollowing ? 'unfollow' : 'follow'} user.`; // Toast message
                }
            }
        );
    // Include all dependencies used inside useCallback
    }, [profileUser?.user_id, profileUser?.username, isAuthenticated, isFollowing, navigate, logout]);

    // --- Delete Profile Handlers ---
    const openDeleteDialog = () => setIsDeleteDialogOpen(true);
    const closeDeleteDialog = () => { if (!isDeleting) setIsDeleteDialogOpen(false); };

    const handleConfirmDelete = async () => {
        if (!isOwnProfile) return;
        setIsDeleting(true);
        const deletePromise = apiService.delete('/auth/me'); // Ensure endpoint is correct

        toast.promise(
            deletePromise,
            {
                loading: 'Deleting your account...',
                success: async () => {
                    closeDeleteDialog();
                    await logout();
                    navigate('/');
                    return 'Account successfully deleted.';
                },
                error: (err) => {
                    console.error("ProfilePage: Failed to delete profile:", err);
                    setIsDeleting(false); // Re-enable dialog buttons on error
                    return err.response?.data?.error || err.message || 'Could not delete profile.';
                }
            }
        );
    };

    // --- Render Logic ---
    if (isAuthLoading || isLoadingProfile) {
        return <div className="profile-loading-container"><CircularProgress /></div>;
    }

    // Handle profile load error *before* trying to render profile info
    if (profileLoadError) {
        return <div className="profile-error-container"><Alert severity="error">{profileLoadError}</Alert></div>;
    }

    // Handle case where profile user wasn't found (should be caught by errorProfile now)
    if (!profileUser) {
        return <div className="profile-error-container"><Alert severity="warning">Profile data is unavailable for '{username}'.</Alert></div>;
    }

    // Determine if artworks section should be attempted
    const shouldAttemptArtworkLoad = (profileUser.role === 'artist') || (profileUser.role === 'patron' && isOwnProfile);

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
                        <Button variant={isFollowing ? "outlined" : "contained"} onClick={handleFollowToggle} size="small" className={`profile-follow-button ${isFollowing ? 'following' : ''}`}>
                            {isFollowing ? 'Unfollow' : 'Follow'}
                        </Button>
                    )}
                    {isOwnProfile && (
                         <Box sx={{ display: 'flex', gap: 1 }}> {/* Using Box for simple inline flex layout */}
                            <Button variant="outlined" size="small" component={RouterLink} to="/settings" className="profile-edit-button">
                                Edit Profile
                            </Button>
                            <Button variant="outlined" color="error" size="small" onClick={openDeleteDialog} className="profile-delete-button" disabled={isDeleting}>
                                {isDeleting ? <CircularProgress size={20} color="inherit"/> : 'Delete Profile'}
                            </Button>
                         </Box>
                     )}
                </div>
            </section>

            {/* --- Delete Confirmation Dialog --- */}
            <Dialog open={isDeleteDialogOpen} onClose={closeDeleteDialog}>
                <DialogTitle>Confirm Profile Deletion</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete your profile? This action is permanent and cannot be undone.
                    </DialogContentText>
                    {/* No need to show deleteError here, toast handles it */}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteDialog} disabled={isDeleting}>Cancel</Button>
                    <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={isDeleting} startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : null}>
                        Confirm Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* === Artwork Display Section === */}
            {shouldAttemptArtworkLoad ? (
                <section className="profile-artworks-section">
                     <h2 className="profile-artworks-title">{isOwnProfile ? (profileUser.role === 'artist' ? 'My Created Artworks' : 'My Collected Artworks') : `${profileUser.username}'s Artworks`}</h2>

                     {isLoadingArtworks && (<div className="profile-artworks-loading"><CircularProgress /></div>)}
                     {/* Removed local artwork error display */}
                     {/* {errorArtworks && !isLoadingArtworks && (<div className="profile-artworks-error"><Alert severity="warning">{errorArtworks}</Alert></div>)} */}

                     {!isLoadingArtworks && displayedArtworks.length === 0 && (
                        <p className="profile-artworks-empty">No {isOwnProfile && profileUser.role === 'patron' ? 'collected' : 'artworks'} found.</p>
                    )}

                     {!isLoadingArtworks && displayedArtworks.length > 0 && (
                         <>
                             <div className="profile-artworks-grid">
                                 {displayedArtworks.map((artwork) => {
                                     const isOwnedByViewer = ownedArtworkIds.has(artwork?.artwork_id);
                                     const shouldBlur = !isOwnProfile && profileUser.role === 'artist' && !isOwnedByViewer;
                                     return artwork ? (<div key={artwork.artwork_id} className={`profile-artwork-item ${shouldBlur ? 'artwork-blurred' : ''}`}><ArtworkCard artwork={artwork} /></div>) : null;
                                 })}
                             </div>
                             {paginationData.totalPages > 1 && (
                                 <div className="profile-pagination-container">
                                     <Pagination
                                         count={paginationData.totalPages || 1} // Ensure count is at least 1
                                         page={currentPage}
                                         onChange={handlePageChange}
                                         color="primary"
                                     />
                                 </div>
                             )}
                         </>
                     )}
                 </section>
             ) : ( // Only shows if viewing another patron's profile
                 <section className="profile-artworks-private">
                     <p>{profileUser.role === 'patron' ? "Patrons' collections are private." : "" /* Should ideally not reach here if artist */}</p>
                 </section>
             )}
            {/* === End Artwork Display Section === */}

        </div> // End profile-page-container
    );
}

export default ProfilePage;