import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// MUI Components
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Pagination from '@mui/material/Pagination';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// Icons
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';

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

    // Tab State
    const [activeTab, setActiveTab] = useState(0);

    // Created Artworks State (for artists)
    const [createdArtworks, setCreatedArtworks] = useState([]);
    const [isLoadingCreatedArtworks, setIsLoadingCreatedArtworks] = useState(false);
    const [createdArtworksPagination, setCreatedArtworksPagination] = useState({ 
        totalPages: 1, currentPage: 1, perPage: 12, totalItems: 0, hasNext: false, hasPrev: false 
    });
    const [createdArtworksPage, setCreatedArtworksPage] = useState(1);

    // Collected Artworks State
    const [collectedArtworks, setCollectedArtworks] = useState([]);
    const [isLoadingCollectedArtworks, setIsLoadingCollectedArtworks] = useState(false);
    const [collectedArtworksPagination, setCollectedArtworksPagination] = useState({ 
        totalPages: 1, currentPage: 1, perPage: 12, totalItems: 0, hasNext: false, hasPrev: false 
    });
    const [collectedArtworksPage, setCollectedArtworksPage] = useState(1);

    // Delete Dialog State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Derived State
    const isOwnProfile = isAuthenticated && profileUser && loggedInUser?.user_id === profileUser.user_id;
    const isArtist = profileUser?.role === 'artist';
    const isPatron = profileUser?.role === 'patron';

    // Tab change handler
    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };
    
    // Page change handlers
    const handleCreatedArtworksPageChange = (event, value) => {
        setCreatedArtworksPage(value);
    };
    
    const handleCollectedArtworksPageChange = (event, value) => {
        setCollectedArtworksPage(value);
    };

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
            
            // Reset created artworks state
            setCreatedArtworks([]);
            setIsLoadingCreatedArtworks(false);
            setCreatedArtworksPage(1);
            setCreatedArtworksPagination({ 
                totalPages: 1, currentPage: 1, perPage: 12, totalItems: 0, hasNext: false, hasPrev: false 
            });
            
            // Reset collected artworks state
            setCollectedArtworks([]);
            setIsLoadingCollectedArtworks(false);
            setCollectedArtworksPage(1);
            setCollectedArtworksPagination({ 
                totalPages: 1, currentPage: 1, perPage: 12, totalItems: 0, hasNext: false, hasPrev: false 
            });
            
            setIsFollowing(false);
            setIsDeleteDialogOpen(false);
            setIsDeleting(false);

            try {
                const response = await apiService.get(`/users/${username}`);
                setProfileUser(response.data.user || response.data);
                setIsFollowing(response.data.is_followed_by_viewer || false);
                
                // For artists, default to Created Artworks tab
                // For patrons, only Collected tab is available
                if (response.data.user?.role === 'artist' || response.data?.role === 'artist') {
                    setActiveTab(0); // Created artworks tab
                } else {
                    setActiveTab(0); // Collected artworks is the only tab for patrons
                }
                
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

    // --- Fetch Created Artworks ---
    useEffect(() => {
        // Don't fetch if profile hasn't loaded or failed specifically,
        // or if user is not an artist
        if (!profileUser?.user_id || profileLoadError || profileUser.role !== 'artist') {
            setIsLoadingCreatedArtworks(false);
            setCreatedArtworks([]);
            return;
        }

        const fetchCreatedArtworks = async (page) => {
            setIsLoadingCreatedArtworks(true);
            try {
                const endpoint = `/users/${profileUser.user_id}/created-artworks`;
                const response = await apiService.get(endpoint, { params: { page } });
                
                const artworksData = response.data.artworks || [];
                setCreatedArtworks(artworksData);

                if (response.data.pagination) {
                    setCreatedArtworksPagination(response.data.pagination);
                } else {
                    // Reset or provide default if backend doesn't return pagination
                    setCreatedArtworksPagination({ 
                        totalItems: artworksData.length, 
                        totalPages: 1, 
                        currentPage: 1, 
                        perPage: artworksData.length || 12, 
                        hasNext: false, 
                        hasPrev: false 
                    });
                }
            } catch (err) {
                // Interceptor will show toast error. Component logs it.
                console.error(`ProfilePage: Failed to fetch created artworks:`, err);
                setCreatedArtworks([]);
                setCreatedArtworksPagination({ 
                    totalPages: 1, currentPage: 1, perPage: 12, totalItems: 0, hasNext: false, hasPrev: false 
                }); // Reset pagination
            } finally {
                setIsLoadingCreatedArtworks(false);
            }
        };

        fetchCreatedArtworks(createdArtworksPage);
    }, [profileUser?.user_id, profileUser?.role, createdArtworksPage, profileLoadError]);

    // --- Fetch Collected Artworks ---
    useEffect(() => {
        // Don't fetch if profile hasn't loaded or failed specifically
        // Only fetch if viewing own profile (regardless of role) or if viewing artist profile (to show their collection)
        if (!profileUser?.user_id || profileLoadError || (!isOwnProfile && profileUser.role === 'patron')) {
            setIsLoadingCollectedArtworks(false);
            setCollectedArtworks([]);
            return;
        }

        const fetchCollectedArtworks = async (page) => {
            setIsLoadingCollectedArtworks(true);
            try {
                const endpoint = `/users/${profileUser.user_id}/collected-artworks`;
                const response = await apiService.get(endpoint, { params: { page } });
                
                const artworksData = response.data.collectedArtworks?.map(item => item.artwork).filter(art => art != null) || [];
                setCollectedArtworks(artworksData);

                if (response.data.pagination) {
                    setCollectedArtworksPagination(response.data.pagination);
                } else {
                    // Reset or provide default if backend doesn't return pagination
                    setCollectedArtworksPagination({ 
                        totalItems: artworksData.length, 
                        totalPages: 1, 
                        currentPage: 1, 
                        perPage: artworksData.length || 12, 
                        hasNext: false, 
                        hasPrev: false 
                    });
                }
            } catch (err) {
                // Interceptor will show toast error. Component logs it.
                console.error(`ProfilePage: Failed to fetch collected artworks:`, err);
                setCollectedArtworks([]);
                setCollectedArtworksPagination({ 
                    totalPages: 1, currentPage: 1, perPage: 12, totalItems: 0, hasNext: false, hasPrev: false 
                }); // Reset pagination
            } finally {
                setIsLoadingCollectedArtworks(false);
            }
        };

        fetchCollectedArtworks(collectedArtworksPage);
    }, [profileUser?.user_id, profileUser?.role, isOwnProfile, collectedArtworksPage, profileLoadError]);

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
    }, [profileUser?.user_id, profileUser?.username, isAuthenticated, isFollowing]);

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

    // Determine if specific artwork sections should be shown
    const shouldShowCreatedArtworks = isArtist;
    const shouldShowCollectedArtworks = isOwnProfile || (isArtist && isAuthenticated); // show collected for own profile or authenticated viewing artist
    const showTabs = isArtist && shouldShowCollectedArtworks; // Only show tabs if we have both created and collected to show

    // Determine which tab panels to show
    const availableTabs = [
        ...(shouldShowCreatedArtworks ? [{ label: isOwnProfile ? 'My Created Artworks' : `${profileUser.username}'s Created Artworks` }] : []),
        ...(shouldShowCollectedArtworks ? [{ label: isOwnProfile ? 'My Collected Artworks' : `${profileUser.username}'s Collection` }] : [])
    ];

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
                            <Tooltip title="Settings">
                                <IconButton 
                                    component={RouterLink} 
                                    to="/settings" 
                                    className="profile-settings-button"
                                    aria-label="Settings"
                                >
                                    <SettingsIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Logout">
                                <IconButton 
                                    onClick={logout} 
                                    className="profile-logout-button"
                                    aria-label="Logout"
                                >
                                    <LogoutIcon />
                                </IconButton>
                            </Tooltip>
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

            {/* === Tabs Navigation === */}
            {(shouldShowCreatedArtworks || shouldShowCollectedArtworks) && (
                <section className="profile-artworks-container">
                    {showTabs ? (
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                            <Tabs 
                                value={activeTab} 
                                onChange={handleTabChange} 
                                variant="fullWidth"
                                textColor="primary"
                                indicatorColor="primary"
                            >
                                {shouldShowCreatedArtworks && (
                                    <Tab label="Created Artworks" />
                                )}
                                {shouldShowCollectedArtworks && (
                                    <Tab label="Collection" />
                                )}
                            </Tabs>
                        </Box>
                    ) : (
                        <h2 className="profile-artworks-title">
                            {shouldShowCreatedArtworks 
                                ? (isOwnProfile ? 'My Created Artworks' : `${profileUser.username}'s Created Artworks`)
                                : (isOwnProfile ? 'My Collected Artworks' : `${profileUser.username}'s Collection`)}
                        </h2>
                    )}

                    {/* === Created Artworks Tab Panel === */}
                    {shouldShowCreatedArtworks && (!showTabs || (showTabs && activeTab === 0)) && (
                        <div className="profile-artworks-section">
                            {isLoadingCreatedArtworks && (<div className="profile-artworks-loading"><CircularProgress /></div>)}

                            {!isLoadingCreatedArtworks && createdArtworks.length === 0 && (
                                <p className="profile-artworks-empty">No created artworks found.</p>
                            )}

                            {!isLoadingCreatedArtworks && createdArtworks.length > 0 && (
                                <>
                                    <div className="profile-artworks-grid">
                                        {createdArtworks.map((artwork) => {
                                            const isOwnedByViewer = ownedArtworkIds.has(artwork?.artwork_id);
                                            const shouldBlur = !isOwnProfile && !isOwnedByViewer;
                                            return artwork ? (<div key={artwork.artwork_id} className={`profile-artwork-item ${shouldBlur ? 'artwork-blurred' : ''}`}><ArtworkCard artwork={artwork} /></div>) : null;
                                        })}
                                    </div>
                                    {createdArtworksPagination.totalPages > 1 && (
                                        <div className="profile-pagination-container">
                                            <Pagination
                                                count={createdArtworksPagination.totalPages || 1} // Ensure count is at least 1
                                                page={createdArtworksPage}
                                                onChange={handleCreatedArtworksPageChange}
                                                color="primary"
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* === Collected Artworks Tab Panel === */}
                    {shouldShowCollectedArtworks && (!showTabs || (showTabs && activeTab === (shouldShowCreatedArtworks ? 1 : 0))) && (
                        <div className="profile-artworks-section">
                            {isLoadingCollectedArtworks && (<div className="profile-artworks-loading"><CircularProgress /></div>)}

                            {!isLoadingCollectedArtworks && collectedArtworks.length === 0 && (
                                <p className="profile-artworks-empty">No collected artworks found.</p>
                            )}

                            {!isLoadingCollectedArtworks && collectedArtworks.length > 0 && (
                                <>
                                    <div className="profile-artworks-grid">
                                        {collectedArtworks.map((artwork) => {
                                            return artwork ? (<div key={artwork.artwork_id} className="profile-artwork-item"><ArtworkCard artwork={artwork} /></div>) : null;
                                        })}
                                    </div>
                                    {collectedArtworksPagination.totalPages > 1 && (
                                        <div className="profile-pagination-container">
                                            <Pagination
                                                count={collectedArtworksPagination.totalPages || 1} // Ensure count is at least 1
                                                page={collectedArtworksPage}
                                                onChange={handleCollectedArtworksPageChange}
                                                color="primary"
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </section>
            )}
            
            {/* Patron's private message */}
            {isPatron && !isOwnProfile && (
                <section className="profile-artworks-private">
                    <p>Patrons' collections are private.</p>
                </section>
            )}

        </div> // End profile-page-container
    );
}

export default ProfilePage;