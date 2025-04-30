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
import Chip from '@mui/material/Chip'; // Import Chip
import { styled } from '@mui/material/styles';

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

// Create custom styled buttons with exact colors
const PendingButton = styled(Button)(({ theme, isActive }) => ({
  marginRight: '8px',
  color: isActive ? 'white' : '#6B7280',
  backgroundColor: isActive ? '#6B7280' : 'transparent',
  borderColor: '#6B7280',
  mixBlendMode: 'normal', // Override global mix-blend-mode
  '&:hover': {
    backgroundColor: isActive ? '#4B5563' : 'rgba(107, 114, 128, 0.04)',
  },
}));

const AcceptedButton = styled(Button)(({ theme, isActive }) => ({
  marginRight: '8px',
  color: isActive ? 'white' : '#10B981', // Teal
  backgroundColor: isActive ? '#10B981' : 'transparent',
  borderColor: '#10B981',
  mixBlendMode: 'normal', // Override global mix-blend-mode
  '&:hover': {
    backgroundColor: isActive ? '#059669' : 'rgba(16, 185, 129, 0.04)',
  },
}));

const RejectedButton = styled(Button)(({ theme, isActive }) => ({
  color: isActive ? 'white' : '#EF4444', // Red
  backgroundColor: isActive ? '#EF4444' : 'transparent',
  borderColor: '#EF4444',
  mixBlendMode: 'normal', // Override global mix-blend-mode
  '&:hover': {
    backgroundColor: isActive ? '#DC2626' : 'rgba(239, 68, 68, 0.04)',
  },
}));

// Helper function to safely format date strings with logging
const formatDate = (dateString) => {
    // Check if the input is a non-empty string
    if (typeof dateString === 'string' && dateString.length > 0) {
        const date = new Date(dateString);
        // Check if the resulting Date object is valid
        if (!isNaN(date.getTime())) {
            return date.toLocaleString();
        } else {
            console.warn('formatDate: Failed to parse date string:', dateString);
            return 'Invalid date format'; // More specific fallback
        }
    } else {
        console.warn('formatDate: Received invalid input (not a non-empty string):', dateString);
        return 'Date unavailable'; // Fallback for non-string or empty string
    }
};

function ProfilePage() {
    const { username } = useParams();
    const { user: loggedInUser, isLoading: isAuthLoading, isAuthenticated, ownedArtworkIds = new Set(), logout } = useAuth();
    const navigate = useNavigate();

    // Profile State
    const [profileUser, setProfileUser] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [profileLoadError, setProfileLoadError] = useState(null); // For specific profile load failure msg
    const [isFollowing, setIsFollowing] = useState(false);
    const [isLoadingFollowAction, setIsLoadingFollowAction] = useState(false); // Add loading state for follow action

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
    const fetchCollectedArtworks = useCallback(async (page) => {
        if (!profileUser?.user_id) return;
        
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
            // Handle 403 errors gracefully - this happens when viewing collections of users we don't follow
            if (err.response?.status === 403) {
                console.log(`User doesn't have permission to view ${profileUser.username}'s collection. Need to follow first.`);
                // Don't show an error toast for this expected scenario
            } else {
                // Interceptor will show toast error for other errors. Component logs it.
                console.error(`ProfilePage: Failed to fetch collected artworks:`, err);
            }
            setCollectedArtworks([]);
            setCollectedArtworksPagination({ 
                totalPages: 1, currentPage: 1, perPage: 12, totalItems: 0, hasNext: false, hasPrev: false 
            }); // Reset pagination
        } finally {
            setIsLoadingCollectedArtworks(false);
        }
    }, [profileUser]);

    // --- Fetch Collected Artworks Effect ---
    useEffect(() => {
        // Don't fetch if profile hasn't loaded or failed specifically
        // Only fetch if viewing own profile (regardless of role) or if viewing artist profile (to show their collection)
        if (!profileUser?.user_id || profileLoadError || (!isOwnProfile && profileUser.role === 'patron')) {
            setIsLoadingCollectedArtworks(false);
            setCollectedArtworks([]);
            return;
        }

        fetchCollectedArtworks(collectedArtworksPage);
    }, [profileUser?.user_id, profileUser?.role, isOwnProfile, collectedArtworksPage, profileLoadError, fetchCollectedArtworks]);

    // --- Follow/Unfollow Handler ---
    const handleFollowAction = async () => {
        if (!profileUser?.user_id) return;
        
        setIsLoadingFollowAction(true);
        
        try {
            if (isFollowing) {
                // Unfollow - Use the correct "/follow" endpoint instead of "/followers"
                await apiService.delete(`/users/${profileUser.user_id}/follow`);
                setIsFollowing(false);
                toast.success(`Unfollowed ${profileUser.username}`);
            } else {
                // Follow - Use the correct "/follow" endpoint instead of "/followers"
                await apiService.post(`/users/${profileUser.user_id}/follow`);
                setIsFollowing(true);
                
                // Update followers count immediately (without waiting for a page refresh)
                if (profileUser.followers_count !== undefined) {
                    setProfileUser(prev => ({
                        ...prev,
                        followers_count: prev.followers_count + 1
                    }));
                }
                
                toast.success(`Following ${profileUser.username}`);
            }
            
            // Refresh the collected artworks since follow status affects visibility
            if (collectedArtworksPage === 1) {
                fetchCollectedArtworks(1);
            } else {
                setCollectedArtworksPage(1);
            }
        } catch (err) {
            console.error("Follow/unfollow error:", err);
            const action = isFollowing ? 'unfollow' : 'follow';
            toast.error(`Unable to ${action} ${profileUser.username}. Please try again.`);
        } finally {
            setIsLoadingFollowAction(false);
        }
    };

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

    // Helper function to get chip color based on status
    const getStatusChipColor = (status) => {
        const lowerStatus = status?.toLowerCase();
        if (lowerStatus === 'accepted') {
            // Override for Accepted - Force Teal Green
            return { color: 'success', style: { backgroundColor: '#10B981', color: '#FFFFFF' } };
        }
        if (lowerStatus === 'rejected') {
            // Override for Rejected - Force Red
            return { color: 'error', style: { backgroundColor: '#EF4444', color: '#FFFFFF' } };
        }
        if (lowerStatus === 'canceled') return { color: 'default', style: {} };
        if (lowerStatus === 'pending') return { color: 'primary', style: {} };
        return { color: 'default', style: {} };
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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
                                onClick={handleFollowAction} 
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
                                    <Box sx={{ mb: 2 }}>
                                        {/* Use the pre-defined styled components with capitalized labels */}
                                        <PendingButton 
                                            size="small"
                                            onClick={() => setReceivedTradesFilter('pending')}
                                            isActive={receivedTradesFilter === 'pending'}
                                        >
                                            PENDING
                                        </PendingButton>
                                        <AcceptedButton 
                                            size="small"
                                            onClick={() => setReceivedTradesFilter('accepted')}
                                            isActive={receivedTradesFilter === 'accepted'}
                                        >
                                            ACCEPTED
                                        </AcceptedButton>
                                        <RejectedButton 
                                            size="small"
                                            onClick={() => setReceivedTradesFilter('rejected')}
                                            isActive={receivedTradesFilter === 'rejected'}
                                        >
                                            REJECTED
                                        </RejectedButton>
                                    </Box>
                                    
                                    {/* Apply glass effect to the container of each TradeCard */}
                                    {receivedTrades
                                        .filter(trade =>
                                            receivedTradesFilter === 'all' ||
                                            (trade.status && trade.status.toLowerCase() === receivedTradesFilter)
                                        )
                                        .map((trade) => {
                                            // Log the raw created_at value
                                            console.log('Incoming Trade created_at:', trade.created_at);
                                            
                                            return (
                                                <Box
                                                    key={trade.trade_id}
                                                    sx={{
                                                        mb: 3,
                                                        p: 2,
                                                        border: '1px solid',
                                                        borderColor:
                                                            trade.status?.toLowerCase() === 'accepted' ? 'success.main' : // Use success
                                                            trade.status?.toLowerCase() === 'rejected' ? 'error.main' :   // Use error
                                                            trade.status?.toLowerCase() === 'canceled' ? 'text.disabled' :
                                                            trade.status?.toLowerCase() === 'pending' ? 'primary.main' : // Use primary
                                                            'rgba(255, 255, 255, 0.2)', // Lighter border for glass
                                                        borderRadius: 2, // Slightly more rounded
                                                        backgroundColor: 'rgba(255, 255, 255, 0.05)', // Transparent background
                                                        backdropFilter: 'blur(8px)', // Glass effect
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', // Adjusted shadow
                                                    }}
                                                >
                                                    <Grid container spacing={2}>
                                                        {/* Trade information */}
                                                        <Grid item xs={12}>
                                                            <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'text.primary', mb: 0.5 }}> {/* Add margin bottom */}
                                                                {/* Display username directly */}
                                                                {trade.initiator?.username || 'Unknown User'} 
                                                            </Typography>
                                                            {/* Status Chip below username */}
                                                            {trade.status && (
                                                                <Chip
                                                                    label={trade.status}
                                                                    color={getStatusChipColor(trade.status).color} // Use updated function
                                                                    size="small"
                                                                    sx={{ mb: 1, ...getStatusChipColor(trade.status).style }} // Add margin bottom
                                                                />
                                                            )}
                                                            {/* Date - Use helper function */}
                                                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                                                {formatDate(trade.created_at)}
                                                            </Typography>
                                                            
                                                            {/* Trade actions - Position directly below the date */}
                                                            {trade.status?.toLowerCase() === 'pending' && (
                                                                <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
                                                                    <Stack direction="row" spacing={1}>
                                                                        <Tooltip title="Accept Trade">
                                                                            <IconButton
                                                                                color="success"
                                                                                onClick={() => handleAcceptTrade(trade.trade_id)}
                                                                                size="small"
                                                                                aria-label="Accept Trade"
                                                                            >
                                                                                <CheckCircleOutlineIcon />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                        <Tooltip title="Reject Trade">
                                                                            <IconButton
                                                                                color="error"
                                                                                onClick={() => handleRejectTrade(trade.trade_id)}
                                                                                size="small"
                                                                                aria-label="Reject Trade"
                                                                            >
                                                                                <CancelIcon />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </Stack>
                                                                </Box>
                                                            )}
                                                            
                                                            {trade.message && (
                                                                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', p: 1, backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: 1, color: 'text.primary' }}>
                                                                    "{trade.message}"
                                                                </Typography>
                                                            )}
                                                        </Grid>

                                                        {/* Artworks involved - Use theme text colors */}
                                                        <Grid item xs={12} container spacing={2}>
                                                            {/* Their offer - Move label below card, make caps */}
                                                            <Grid item xs={12} sm={6} sx={{ textAlign: 'center' }}> {/* Remove position: relative */}
                                                                {trade.offered_artwork ? (
                                                                    <ArtworkCard 
                                                                        artwork={trade.offered_artwork} 
                                                                        isBlurred={false} 
                                                                    />
                                                                ) : (
                                                                    <Typography sx={{ color: 'text.primary', height: '450px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Artwork details unavailable</Typography> // Placeholder with height
                                                                )}
                                                                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', mt: 0.5, textTransform: 'uppercase' }}>They offer</Typography> {/* Label below, italicized, CAPS */}
                                                            </Grid>
                                                            {/* Your artwork - Move label below card, make caps */}
                                                            <Grid item xs={12} sm={6} sx={{ textAlign: 'center' }}> {/* Center align content */}
                                                                {trade.requested_artwork ? (
                                                                    <ArtworkCard 
                                                                        artwork={trade.requested_artwork} 
                                                                        isBlurred={false} 
                                                                    />
                                                                ) : (
                                                                    <Typography sx={{ color: 'text.primary', height: '450px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Artwork details unavailable</Typography> // Placeholder with height
                                                                )}
                                                                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', mt: 0.5, textTransform: 'uppercase' }}>They want</Typography> {/* Label below, italicized, CAPS */}
                                                            </Grid>
                                                        </Grid>
                                                        
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
                                    <Box sx={{ mb: 2 }}>
                                        {/* Use the pre-defined styled components with capitalized labels */}
                                        <PendingButton 
                                            size="small"
                                            onClick={() => setSentTradesFilter('pending')}
                                            isActive={sentTradesFilter === 'pending'}
                                        >
                                            PENDING
                                        </PendingButton>
                                        <AcceptedButton 
                                            size="small"
                                            onClick={() => setSentTradesFilter('accepted')}
                                            isActive={sentTradesFilter === 'accepted'}
                                        >
                                            ACCEPTED
                                        </AcceptedButton>
                                        <RejectedButton 
                                            size="small"
                                            onClick={() => setSentTradesFilter('rejected')}
                                            isActive={sentTradesFilter === 'rejected'}
                                        >
                                            REJECTED
                                        </RejectedButton>
                                    </Box>
                                    
                                    {/* Apply glass effect to the container of each sent trade */}
                                    {sentTrades
                                        .filter(trade => 
                                            sentTradesFilter === 'all' || 
                                            (trade.status && trade.status.toLowerCase() === sentTradesFilter)
                                        )
                                        .map((trade) => {
                                            // Log the raw created_at value
                                            console.log('Outgoing Trade created_at:', trade.created_at);
                                            
                                            return (
                                            <Box 
                                                key={trade.trade_id} 
                                                sx={{ 
                                                    mb: 3, 
                                                    p: 2, 
                                                    border: '1px solid', 
                                                    borderColor: 
                                                        trade.status?.toLowerCase() === 'accepted' ? 'success.main' : // Use success
                                                        trade.status?.toLowerCase() === 'rejected' ? 'error.main' :   // Use error
                                                        trade.status?.toLowerCase() === 'canceled' ? 'text.disabled' :
                                                        trade.status?.toLowerCase() === 'pending' ? 'primary.main' : // Use primary
                                                        'rgba(255, 255, 255, 0.2)', // Lighter border for glass
                                                    borderRadius: 2, // Slightly more rounded
                                                    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Transparent background
                                                    backdropFilter: 'blur(8px)', // Glass effect
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)', // Adjusted shadow
                                                }}
                                            >
                                                <Grid container spacing={2}>
                                                    {/* Trade information - Access nested username */}
                                                    <Grid item xs={12}>
                                                        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'text.primary', mb: 0.5 }}> {/* Add margin bottom */}
                                                            {/* Display username directly */}
                                                            {trade.recipient?.username || 'Unknown User'} 
                                                        </Typography>
                                                        {/* Status Chip below username */}
                                                        {trade.status && (
                                                            <Chip
                                                                label={trade.status}
                                                                color={getStatusChipColor(trade.status).color} // Use updated function
                                                                size="small"
                                                                sx={{ mb: 1, ...getStatusChipColor(trade.status).style }} // Add margin bottom
                                                            />
                                                        )}
                                                        {/* Date - Use helper function */}
                                                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                                            {formatDate(trade.created_at)}
                                                        </Typography>
                                                        
                                                        {/* Trade action - Position directly below the date */}
                                                        {trade.status?.toLowerCase() === 'pending' && (
                                                            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
                                                                <Tooltip title="Cancel Trade">
                                                                    <IconButton
                                                                        color="error"
                                                                        onClick={() => handleCancelTrade(trade.trade_id)}
                                                                        size="small"
                                                                        aria-label="Cancel Trade"
                                                                    >
                                                                        <CancelIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Box>
                                                        )}
                                                        
                                                        {trade.message && (
                                                            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', p: 1, backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: 1, color: 'text.primary' }}>
                                                                "{trade.message}"
                                                            </Typography>
                                                        )}
                                                    </Grid>

                                                    {/* Artworks involved - Use theme text colors */}
                                                    <Grid item xs={12} container spacing={2}>
                                                        {/* Your offer - Move label below card, make caps */}
                                                        <Grid item xs={12} sm={6} sx={{ textAlign: 'center' }}> {/* Remove position: relative */}
                                                            {trade.offered_artwork ? (
                                                                <ArtworkCard 
                                                                    artwork={trade.offered_artwork} 
                                                                    isBlurred={false} 
                                                                />
                                                            ) : (
                                                                <Typography sx={{ color: 'text.primary', height: '450px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Artwork details unavailable</Typography> // Placeholder with height
                                                            )}
                                                            <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', mt: 0.5, textTransform: 'uppercase' }}>You offer</Typography> {/* Label below, italicized, CAPS */}
                                                        </Grid>
                                                        {/* Their artwork - Move label below card, make caps */}
                                                        <Grid item xs={12} sm={6} sx={{ textAlign: 'center' }}> {/* Center align content */}
                                                            {trade.requested_artwork ? (
                                                                <ArtworkCard 
                                                                    artwork={trade.requested_artwork} 
                                                                    isBlurred={false} 
                                                                />
                                                            ) : (
                                                                <Typography sx={{ color: 'text.primary', height: '450px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Artwork details unavailable</Typography> // Placeholder with height
                                                            )}
                                                            <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', mt: 0.5, textTransform: 'uppercase' }}>You want</Typography> {/* Label below, italicized, CAPS */}
                                                        </Grid>
                                                        
                                                    </Grid>
                                                </Grid>
                                            </Box>
                                            );
                                        })}
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
        </Container>
    );
}

export default ProfilePage;