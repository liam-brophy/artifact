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
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import ListItemAvatar from '@mui/material/ListItemAvatar';

// Icons
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'; // Import SwapHorizIcon
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'; // Added for trade buttons
import CancelIcon from '@mui/icons-material/Cancel'; // Added for trade buttons and delete button
import PaletteIcon from '@mui/icons-material/Palette'; // Import PaletteIcon for artist role
import ArtworkCard from '../components/ArtworkCard';
import TradeOfferDialog from '../components/TradeOfferDialog';

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

    // Trades State
    const [sentTrades, setSentTrades] = useState([]);
    const [receivedTrades, setReceivedTrades] = useState([]);
    const [isLoadingSentTrades, setIsLoadingSentTrades] = useState(false);
    const [isLoadingReceivedTrades, setIsLoadingReceivedTrades] = useState(false);
    const [activeTradeSubTab, setActiveTradeSubTab] = useState(0); // 0 for received, 1 for sent
    const [sentTradesFilter, setSentTradesFilter] = useState('all');
    const [receivedTradesFilter, setReceivedTradesFilter] = useState('all');
    const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
    
    // Delete Dialog State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Follow List Modal State
    const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
    const [followModalType, setFollowModalType] = useState(''); // 'followers' or 'following'
    const [followListData, setFollowListData] = useState([]);
    const [isLoadingFollowList, setIsLoadingFollowList] = useState(false);
    const [followListError, setFollowListError] = useState(null);

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

    // --- Trade Functions ---
    const handleTradeSubTabChange = (event, newValue) => {
        setActiveTradeSubTab(newValue);
    };
    
    const fetchReceivedTrades = useCallback(async () => {
        if (!isOwnProfile) return;
        
        setIsLoadingReceivedTrades(true);
        try {
            const response = await apiService.get('/trades/received');
            setReceivedTrades(response.data.trades || []);
        } catch (err) {
            console.error("Failed to fetch received trades:", err);
            toast.error("Could not load received trades");
        } finally {
            setIsLoadingReceivedTrades(false);
        }
    }, [isOwnProfile]);
    
    const fetchSentTrades = useCallback(async () => {
        if (!isOwnProfile) return;
        
        setIsLoadingSentTrades(true);
        try {
            const response = await apiService.get('/trades/sent');
            setSentTrades(response.data.trades || []);
        } catch (err) {
            console.error("Failed to fetch sent trades:", err);
            toast.error("Could not load sent trades");
        } finally {
            setIsLoadingSentTrades(false);
        }
    }, [isOwnProfile]);
    
    // Fetch trades when tab changes to trades
    useEffect(() => {
        if (activeTab === (isArtist ? 2 : 1) && isOwnProfile) {
            fetchReceivedTrades();
            fetchSentTrades();
        }
    }, [activeTab, isOwnProfile, isArtist, fetchReceivedTrades, fetchSentTrades]);
    
    const handleAcceptTrade = async (tradeId) => {
        try {
            await apiService.post(`/trades/${tradeId}/accept`);
            toast.success("Trade accepted successfully!");
            // Refresh both trades and collections
            fetchReceivedTrades();
            fetchSentTrades();
            // Also refresh collected artworks since ownership changed
            if (collectedArtworksPage === 1) {
                // If on first page, just refresh
                const collectedPage = 1;
                setCollectedArtworksPage(collectedPage);
            } else {
                // If on another page, go back to first page
                setCollectedArtworksPage(1);
            }
        } catch (err) {
            console.error("Failed to accept trade:", err);
            toast.error(err.response?.data?.error || "Failed to accept trade");
        }
    };
    
    const handleRejectTrade = async (tradeId) => {
        try {
            await apiService.post(`/trades/${tradeId}/reject`);
            toast.success("Trade rejected");
            fetchReceivedTrades();
        } catch (err) {
            console.error("Failed to reject trade:", err);
            toast.error(err.response?.data?.error || "Failed to reject trade");
        }
    };
    
    const handleCancelTrade = async (tradeId) => {
        try {
            await apiService.post(`/trades/${tradeId}/cancel`);
            toast.success("Trade canceled");
            fetchSentTrades();
        } catch (err) {
            console.error("Failed to cancel trade:", err);
            toast.error(err.response?.data?.error || "Failed to cancel trade");
        }
    };

    // --- Follow List Modal Functions ---
    const fetchFollowList = useCallback(async (type) => {
        if (!profileUser?.user_id) return;
        
        setIsLoadingFollowList(true);
        setFollowListData([]);
        setFollowListError(null);
        setFollowModalType(type); // Set the type ('followers' or 'following')

        const endpoint = `/users/${profileUser.user_id}/${type}`; // e.g., /users/123/followers

        try {
            const response = await apiService.get(endpoint);
            // Adjust based on actual API response structure
            // Assuming the API returns an object like { followers: [{ user_id: ..., username: ... }, ...] }
            // or { following: [...] }
            setFollowListData(response.data[type] || []); 
            setIsFollowModalOpen(true); // Open modal only after successful fetch
        } catch (err) {
            console.error(`ProfilePage: Failed to fetch ${type}:`, err);
            setFollowListError(`Could not load ${type}. Please try again later.`);
            // Optionally open the modal even on error to show the error message
            setIsFollowModalOpen(true); 
        } finally {
            setIsLoadingFollowList(false);
        }
    }, [profileUser?.user_id]); // Dependency on profileUser.user_id

    const openFollowersModal = () => {
        fetchFollowList('followers');
    };

    const openFollowingModal = () => {
        fetchFollowList('following');
    };

    const closeFollowModal = () => {
        setIsFollowModalOpen(false);
        // Reset state when closing
        setFollowListData([]);
        setFollowListError(null);
        setFollowModalType('');
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
                    {/* Display username and artist icon side-by-side */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <h1 className="profile-username" style={{ margin: 0, marginRight: '8px' }}>{profileUser.username}</h1>
                        {/* Conditionally render PaletteIcon if user is an artist */}
                        {isArtist && (
                            <Tooltip title="Artist">
                                <PaletteIcon color="primary" sx={{ fontSize: '1.5rem' }} />
                            </Tooltip>
                        )}
                    </Box>
                    <div className="profile-social-counts">
                        {/* Make Followers count clickable */}
                        <Button
                            onClick={openFollowersModal}
                            disabled={isLoadingFollowList && followModalType === 'followers'}
                            sx={{
                                textTransform: 'none',
                                p: '6px 8px',
                                minWidth: 'auto',
                                color: 'text.primary', // Ensure button base color is correct
                                mr: 1,
                                '&:hover': { backgroundColor: 'action.hover' },
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}
                        >
                            {/* Ensure number has no shadow and uses primary text color */}
                            <Typography variant="h6" component="span" sx={{ lineHeight: 1.2, color: 'text.primary', textShadow: 'none' }}>
                                {profileUser.followers_count ?? 0}
                            </Typography>
                            {/* Ensure text has no shadow and uses primary text color */}
                            <Typography variant="caption" component="span" sx={{ lineHeight: 1.2, color: 'text.primary', textShadow: 'none' }}>
                                Followers
                            </Typography>
                            {isLoadingFollowList && followModalType === 'followers' && <CircularProgress size={12} sx={{ position: 'absolute', top: '50%', left: '50%', marginTop: '-6px', marginLeft: '-6px' }} />}
                        </Button>
                        {/* Make Following count clickable */}
                        <Button
                            onClick={openFollowingModal}
                            disabled={isLoadingFollowList && followModalType === 'following'}
                            sx={{
                                textTransform: 'none',
                                p: '6px 8px',
                                minWidth: 'auto',
                                color: 'text.primary', // Ensure button base color is correct
                                '&:hover': { backgroundColor: 'action.hover' },
                                display: 'flex', // Use flex for centering content
                                flexDirection: 'column', // Stack vertically
                                alignItems: 'center' // Center horizontally
                            }}
                        >
                            {/* Ensure number has no shadow and uses primary text color */}
                            <Typography variant="h6" component="span" sx={{ lineHeight: 1.2, color: 'text.primary', textShadow: 'none' }}>
                                {profileUser.following_count ?? 0}
                            </Typography>
                            {/* Ensure text has no shadow and uses primary text color */}
                            <Typography variant="caption" component="span" sx={{ lineHeight: 1.2, color: 'text.primary', textShadow: 'none' }}>
                                Following
                            </Typography>
                            {isLoadingFollowList && followModalType === 'following' && <CircularProgress size={12} sx={{ position: 'absolute', top: '50%', left: '50%', marginTop: '-6px', marginLeft: '-6px' }} />}
                        </Button>
                    </div>
                </div>
                <div className="profile-actions">
                    {isAuthenticated && !isOwnProfile && (
                        <>
                            <Button 
                                variant={isFollowing ? "outlined" : "contained"} 
                                onClick={handleFollowToggle} 
                                size="small" 
                                className={`profile-follow-button ${isFollowing ? 'following' : ''}`}
                            >
                                {isFollowing ? 'Unfollow' : 'Follow'}
                            </Button>
                            
                            {/* Only show propose trade if FOLLOWING the user */}
                            {isFollowing && (
                                <Button
                                    variant="outlined"
                                    color="primary"
                                    // startIcon={<SwapHorizIcon />} // Icon was causing issues, removed for now
                                    onClick={() => setTradeDialogOpen(true)}
                                    size="small"
                                    sx={{ ml: 1 }}
                                >
                                    Propose Trade
                                </Button>
                            )}
                        </>
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
                                    sx={{ color: loggedInUser?.favorite_color || 'inherit' }} // Apply favorite color
                                >
                                    <LogoutIcon />
                                </IconButton>
                            </Tooltip>
                            {/* Removed Delete button temporarily to fix syntax errors, can be re-added */}
                            {/* 
                            <Tooltip title="Delete Account">
                                <IconButton 
                                    onClick={openDeleteDialog} 
                                    className="profile-delete-button"
                                    aria-label="Delete Account"
                                    color="error" // Indicate destructive action
                                >
                                    <CancelIcon />
                                </IconButton>
                            </Tooltip>
                            */}
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
                                {isOwnProfile && (
                                    <Tab label="Trades" icon={<SwapHorizIcon />} iconPosition="start" />
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
                                            return artwork ? (
                                                <div 
                                                    key={artwork.artwork_id} 
                                                    className={`profile-artwork-item ${shouldBlur ? 'artwork-blurred' : ''}`}
                                                >
                                                    <ArtworkCard 
                                                        artwork={artwork} 
                                                        isBlurred={shouldBlur}
                                                        blurContext="created" 
                                                    />
                                                </div>
                                            ) : null;
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
                                            // For collected artworks:
                                            // - No blur if viewing own profile
                                            // - No blur if the viewer follows this user
                                            // - Apply blur otherwise (for privacy)
                                            const shouldBlur = !isOwnProfile && !isFollowing;
                                            return artwork ? (
                                                <div 
                                                    key={artwork.artwork_id} 
                                                    className={`profile-artwork-item ${shouldBlur ? 'artwork-blurred' : ''}`}
                                                >
                                                    <ArtworkCard 
                                                        artwork={artwork} 
                                                        isBlurred={shouldBlur}
                                                        blurContext="collection"
                                                        isOwnArtwork={isOwnProfile}
                                                        ownerId={profileUser?.user_id}
                                                        ownerUsername={profileUser?.username}
                                                    />
                                                </div>
                                            ) : null;
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
            
            {/* === Trades Tab Panel === */}
            {isOwnProfile && showTabs && activeTab === (isArtist ? 2 : 1) && (
                <div className="profile-trades-section">
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                        <Tabs 
                            value={activeTradeSubTab} 
                            onChange={handleTradeSubTabChange}
                            variant="fullWidth"
                            textColor="primary"
                            indicatorColor="primary"
                            sx={{ minHeight: '48px' }}
                        >
                            {/* Use case-insensitive filter for counts */}
                            <Tab label={`Incoming (${receivedTrades.filter(t => t.status && t.status.toLowerCase() === 'pending').length})`} />
                            <Tab label={`Outgoing (${sentTrades.filter(t => t.status && t.status.toLowerCase() === 'pending').length})`} />
                        </Tabs>
                    </Box>

                    {/* Incoming Trades Tab */}
                    {activeTradeSubTab === 0 && (
                        <div className="profile-trades-list incoming-trades">
                            {isLoadingReceivedTrades && (
                                <div className="profile-loading-indicator">
                                    <CircularProgress size={40} />
                                </div>
                            )}

                            {!isLoadingReceivedTrades && receivedTrades.length === 0 && (
                                <Alert severity="info" sx={{ mb: 2 }}>You don't have any incoming trade offers.</Alert>
                            )}

                            {!isLoadingReceivedTrades && receivedTrades.length > 0 && (
                                <>
                                    <Typography variant="h6" sx={{ mb: 2 }}>Trade Offers Received</Typography>
                                    <Box sx={{ mb: 2 }}>
                                        <strong>Filter:</strong> 
                                        <Button 
                                            variant={!receivedTrades.filter || receivedTrades.filter === 'all' ? "contained" : "outlined"}
                                            size="small"
                                            onClick={() => setReceivedTradesFilter('all')}
                                            sx={{ ml: 1, mr: 1 }}
                                        >
                                            All
                                        </Button>
                                        <Button 
                                            variant={receivedTradesFilter === 'pending' ? "contained" : "outlined"}
                                            size="small"
                                            onClick={() => setReceivedTradesFilter('pending')}
                                            sx={{ mr: 1 }}
                                            color="primary"
                                        >
                                            Pending
                                        </Button>
                                        {/* Replace Completed with Accepted */}
                                        <Button 
                                            variant={receivedTradesFilter === 'accepted' ? "contained" : "outlined"} // Check for 'accepted'
                                            size="small"
                                            onClick={() => setReceivedTradesFilter('accepted')} // Set state to 'accepted'
                                            sx={{ mr: 1 }}
                                            color="success"
                                        >
                                            Accepted 
                                        </Button>
                                        <Button 
                                            variant={receivedTradesFilter === 'rejected' ? "contained" : "outlined"} // Ensure lowercase state check
                                            size="small"
                                            onClick={() => setReceivedTradesFilter('rejected')} // Ensure lowercase onClick
                                            color="error"
                                        >
                                            Rejected
                                        </Button>
                                    </Box>

                                    {/* Apply filter before mapping - Case-insensitive comparison */}
                                    {receivedTrades
                                        .filter(trade => 
                                            receivedTradesFilter === 'all' || 
                                            (trade.status && trade.status.toLowerCase() === receivedTradesFilter)
                                        )
                                        .map((trade) => {
                                            // Add this console log to inspect the trade object
                                            console.log('Rendering received trade:', trade); 
                                            return (
                                                <Box 
                                                    key={trade.trade_id} 
                                                    sx={{ 
                                                        mb: 3, 
                                                        p: 2, 
                                                        border: '1px solid',
                                                        borderColor: 
                                                            trade.status === 'accepted' ? 'success.main' : 
                                                            trade.status === 'rejected' ? 'error.main' : 
                                                            trade.status === 'canceled' ? 'text.disabled' : 
                                                            'grey.300',
                                                        borderRadius: 1,
                                                        backgroundColor: 'background.paper',
                                                        boxShadow: 1
                                                    }}
                                                >
                                                    <Grid container spacing={2}>
                                                        {/* Trade information */}
                                                        <Grid item xs={12}>
                                                            <Typography variant="subtitle1" fontWeight="bold">
                                                                Trade from: {trade.initiator_username}
                                                                {trade.status !== 'pending' && (
                                                                    <span className={`trade-status ${trade.status}`}>
                                                                        ({trade.status})
                                                                    </span>
                                                                )}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {new Date(trade.created_at).toLocaleString()}
                                                            </Typography>
                                                            {trade.message && (
                                                                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', p: 1, backgroundColor: 'grey.100', borderRadius: 1 }}>
                                                                    "{trade.message}"
                                                                </Typography>
                                                            )}
                                                        </Grid>

                                                        {/* Artworks involved */}
                                                        <Grid item xs={12} container spacing={2}>
                                                            {/* Their offer */}
                                                            <Grid item xs={12} sm={6}>
                                                                <Typography variant="subtitle2">They offer:</Typography>
                                                                {trade.offered_artwork ? (
                                                                    <ArtworkCard 
                                                                        artwork={trade.offered_artwork} 
                                                                        isBlurred={false} // Don't blur in trade view
                                                                        // Add any other relevant props if needed
                                                                    />
                                                                ) : (
                                                                    <Typography>Artwork details unavailable</Typography>
                                                                )}
                                                            </Grid>
                                                            {/* Your artwork */}
                                                            <Grid item xs={12} sm={6}>
                                                                <Typography variant="subtitle2">They want:</Typography>
                                                                {trade.requested_artwork ? (
                                                                    <ArtworkCard 
                                                                        artwork={trade.requested_artwork} 
                                                                        isBlurred={false} // Don't blur in trade view
                                                                        // Add any other relevant props if needed
                                                                    />
                                                                ) : (
                                                                    <Typography>Artwork details unavailable</Typography>
                                                                )}
                                                            </Grid>
                                                        </Grid>

                                                        {/* Trade actions - Check against uppercase PENDING */}
                                                        {trade.status === 'PENDING' && (
                                                            <Grid item xs={12} container spacing={1} justifyContent="center">
                                                                <Grid item>
                                                                    <Button 
                                                                        variant="contained" 
                                                                        color="success" 
                                                                        startIcon={<CheckCircleOutlineIcon />}
                                                                        onClick={() => handleAcceptTrade(trade.trade_id)}
                                                                    >
                                                                        Accept Trade
                                                                    </Button>
                                                                </Grid>
                                                                <Grid item>
                                                                    <Button 
                                                                        variant="outlined" 
                                                                        color="error" 
                                                                        startIcon={<CancelIcon />}
                                                                        onClick={() => handleRejectTrade(trade.trade_id)}
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                </Grid>
                                                            </Grid>
                                                        )}
                                                    </Grid>
                                                </Box>
                                            );
                                        })}
                                </>
                            )}
                        </div>
                    )}

                    {/* Outgoing Trades Tab */}
                    {activeTradeSubTab === 1 && (
                        <div className="profile-trades-list outgoing-trades">
                            {isLoadingSentTrades && (
                                <div className="profile-loading-indicator">
                                    <CircularProgress size={40} />
                                </div>
                            )}

                            {!isLoadingSentTrades && sentTrades.length === 0 && (
                                <Alert severity="info" sx={{ mb: 2 }}>You haven't sent any trade offers.</Alert>
                            )}

                            {!isLoadingSentTrades && sentTrades.length > 0 && (
                                <>
                                    <Typography variant="h6" sx={{ mb: 2 }}>Trade Offers Sent</Typography>
                                    <Box sx={{ mb: 2 }}>
                                        <strong>Filter:</strong> 
                                        <Button 
                                            variant={!sentTrades.filter || sentTrades.filter === 'all' ? "contained" : "outlined"}
                                            size="small"
                                            onClick={() => setSentTradesFilter('all')}
                                            sx={{ ml: 1, mr: 1 }}
                                        >
                                            All
                                        </Button>
                                        <Button 
                                            variant={sentTradesFilter === 'pending' ? "contained" : "outlined"}
                                            size="small"
                                            onClick={() => setSentTradesFilter('pending')}
                                            sx={{ mr: 1 }}
                                            color="primary"
                                        >
                                            Pending
                                        </Button>
                                        {/* Replace Completed with Accepted */}
                                        <Button 
                                            variant={sentTradesFilter === 'accepted' ? "contained" : "outlined"} // Check for 'accepted'
                                            size="small"
                                            onClick={() => setSentTradesFilter('accepted')} // Set state to 'accepted'
                                            sx={{ mr: 1 }}
                                            color="success"
                                        >
                                            Accepted
                                        </Button>
                                        <Button 
                                            variant={sentTradesFilter === 'rejected' ? "contained" : "outlined"} // Ensure lowercase state check
                                            size="small"
                                            onClick={() => setSentTradesFilter('rejected')} // Ensure lowercase onClick
                                            color="error"
                                        >
                                            Rejected
                                        </Button>
                                    </Box>

                                    {sentTrades.map((trade) => (
                                        <Box 
                                            key={trade.trade_id} 
                                            sx={{ 
                                                mb: 3, 
                                                p: 2, 
                                                border: '1px solid',
                                                borderColor: 
                                                    trade.status === 'accepted' ? 'success.main' : 
                                                    trade.status === 'rejected' ? 'error.main' : 
                                                    trade.status === 'canceled' ? 'text.disabled' : 
                                                    'grey.300',
                                                borderRadius: 1,
                                                backgroundColor: 'background.paper',
                                                boxShadow: 1
                                            }}
                                        >
                                            <Grid container spacing={2}>
                                                {/* Trade information */}
                                                <Grid item xs={12}>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        Trade to: {trade.recipient_username}
                                                        {trade.status !== 'pending' && (
                                                            <span className={`trade-status ${trade.status}`}>
                                                                ({trade.status})
                                                            </span>
                                                        )}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {new Date(trade.created_at).toLocaleString()}
                                                    </Typography>
                                                    {trade.message && (
                                                        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', p: 1, backgroundColor: 'grey.100', borderRadius: 1 }}>
                                                            "{trade.message}"
                                                        </Typography>
                                                    )}
                                                </Grid>

                                                {/* Artworks involved */}
                                                <Grid item xs={12} container spacing={2}>
                                                    {/* Your offer */}
                                                    <Grid item xs={12} sm={6}>
                                                        <Typography variant="subtitle2">You offer:</Typography>
                                                        {trade.offered_artwork ? (
                                                            <ArtworkCard 
                                                                artwork={trade.offered_artwork} 
                                                                isBlurred={false} 
                                                            />
                                                        ) : (
                                                            <Typography>Artwork details unavailable</Typography>
                                                        )}
                                                    </Grid>
                                                    {/* Their artwork */}
                                                    <Grid item xs={12} sm={6}>
                                                        <Typography variant="subtitle2">You want:</Typography>
                                                        {trade.requested_artwork ? (
                                                            <ArtworkCard 
                                                                artwork={trade.requested_artwork} 
                                                                isBlurred={false} 
                                                            />
                                                        ) : (
                                                            <Typography>Artwork details unavailable</Typography>
                                                        )}
                                                    </Grid>
                                                </Grid>

                                                {/* Trade actions - Check against uppercase PENDING */}
                                                {trade.status === 'PENDING' && (
                                                    <Grid item xs={12} container spacing={1} justifyContent="center">
                                                        <Grid item>
                                                            <Button 
                                                                variant="outlined" 
                                                                color="warning" 
                                                                startIcon={<CancelIcon />}
                                                                onClick={() => handleCancelTrade(trade.trade_id)}
                                                            >
                                                                Cancel Trade
                                                            </Button>
                                                        </Grid>
                                                    </Grid>
                                                )}
                                            </Grid>
                                        </Box>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {/* Patron's private message */}
            {isPatron && !isOwnProfile && (
                <section className="profile-artworks-private">
                    <p>Patrons' collections are private.</p>
                </section>
            )}

            {/* Trade Offer Dialog */}
            <TradeOfferDialog
                open={tradeDialogOpen}
                onClose={() => setTradeDialogOpen(false)}
                recipientId={profileUser?.user_id}
                recipientUsername={profileUser?.username}
            />

            {/* Follow List Modal */}
             <Dialog open={isFollowModalOpen} onClose={closeFollowModal} maxWidth="xs" fullWidth>
                 <DialogTitle>
                     {isLoadingFollowList 
                        ? 'Loading...' 
                        : `${followModalType === 'followers' ? 'Followers' : 'Following'} (${followListData.length})`}
                 </DialogTitle>
                 <DialogContent dividers> {/* Add dividers for better separation */}
                     {isLoadingFollowList ? (
                         <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                             <CircularProgress />
                         </Box>
                     ) : followListError ? (
                         <Alert severity="error">{followListError}</Alert>
                     ) : followListData.length === 0 ? (
                         <Typography sx={{ p: 2, textAlign: 'center' }}>
                             No users found.
                         </Typography>
                     ) : (
                         <List dense> {/* dense makes the list items smaller */}
                             {followListData.map((user) => (
                                 <ListItem 
                                     key={user.user_id} 
                                     button // Make list item clickable
                                     component={RouterLink} // Use RouterLink for navigation
                                     to={`/profile/${user.username}`} // Link to user's profile
                                     onClick={closeFollowModal} // Close modal when a user is clicked
                                 >
                                     <ListItemAvatar>
                                         {/* Placeholder Avatar - replace with actual user avatar if available */}
                                         {/* You might need to fetch avatar URLs or generate initials */}
                                         <Avatar sx={{ bgcolor: 'primary.light' }}> 
                                             {user.username?.[0]?.toUpperCase()}
                                         </Avatar>
                                     </ListItemAvatar>
                                     <ListItemText primary={user.username} />
                                 </ListItem>
                             ))}
                         </List>
                     )}
                 </DialogContent>
                 <DialogActions>
                     <Button onClick={closeFollowModal}>Close</Button>
                 </DialogActions>
             </Dialog>

        </div> // End profile-page-container
    );
}

export default ProfilePage;