import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Navigate } from 'react-router-dom'; // Added useLocation
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext'; // Use useAuth for logged-in user info

// Import MUI components
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Pagination from '@mui/material/Pagination'; // Import Pagination

// Import the card component
import ArtworkCard from '../components/ArtworkCard'; // Assuming this displays created artworks
// You might need a DIFFERENT card component for displaying 'collected' items if the structure is different

function ProfilePage() {
    const { username } = useParams(); // Get username being viewed from URL
    const { user: loggedInUser, isLoading: isAuthLoading, isAuthenticated } = useAuth(); // Get logged-in user state
    const location = useLocation();

    // State for the profile user being viewed
    const [profileUser, setProfileUser] = useState(null); // Store the fetched user data for the profile
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [errorProfile, setErrorProfile] = useState(null);

    // State for artworks (created or collected)
    const [artworks, setArtworks] = useState([]);
    const [isLoadingArtworks, setIsLoadingArtworks] = useState(false); // Start false, only load if viewing own profile
    const [errorArtworks, setErrorArtworks] = useState(null);
    const [pagination, setPagination] = useState({ total_pages: 1, current_page: 1 });

    const isOwnProfile = isAuthenticated && profileUser && loggedInUser?.user_id === profileUser.user_id;

    // 1. Fetch Profile User Data (Runs first)
    useEffect(() => {
        if (!username) {
            setErrorProfile("Username parameter is missing.");
            setIsLoadingProfile(false);
            return;
        }

        const fetchProfile = async () => {
            setIsLoadingProfile(true);
            setErrorProfile(null);
            setProfileUser(null); // Reset profile on username change
            setArtworks([]); // Reset artworks
            setErrorArtworks(null);
            setIsLoadingArtworks(false);

            try {
                console.log(`Fetching profile for: ${username}`);
                const response = await apiService.get(`/users/${username}`); // Fetch USER data first
                setProfileUser(response.data); // Store the user object whose profile we're viewing
            } catch (err) {
                console.error("Failed to fetch profile:", err);
                setErrorProfile(
                    err.response?.data?.error?.message ||
                    err.response?.data?.message ||
                    (err.response?.status === 404 ? `Profile not found for user: ${username}` : null) ||
                    err.message || "Could not load profile."
                );
            } finally {
                setIsLoadingProfile(false);
            }
        };

        fetchProfile();

    }, [username]); // Depend only on username from URL

    // 2. Fetch Artworks (Created or Collected) IF it's the logged-in user's own profile
    useEffect(() => {
        // Check prerequisites: Ensure we have a valid profile, no profile error, and that it's the user's own profile
        if (!profileUser?.user_id || errorProfile || !isOwnProfile) {
            setIsLoadingArtworks(false);
            setArtworks([]);
            console.log("Artwork fetch skipped (no profileUser.user_id, profile error, or not own profile).");
            return; // Don't fetch artworks
        }

        const fetchArtworks = async (page = 1) => {
            setIsLoadingArtworks(true);
            setErrorArtworks(null);

            // Determine which endpoint to call based on the user's role
            let endpoint = '';
            if (profileUser.role === 'artist') {
                endpoint = `/users/${profileUser.user_id}/created-artworks`;
            } else if (profileUser.role === 'patron') {
                endpoint = `/users/${profileUser.user_id}/collected-artworks`;
            } else {
                console.warn("Profile user has neither 'artist' nor 'patron' role. Cannot fetch artworks.");
                setIsLoadingArtworks(false);
                return;
            }

            try {
                console.log(`Fetching artworks from: ${endpoint}?page=${page}`);
                const response = await apiService.get(endpoint, { params: { page } });

                if (profileUser.role === 'artist') {
                    setArtworks(response.data.artworks || []);
                    setPagination(response.data.pagination || { total_pages: 1, current_page: 1 });
                } else if (profileUser.role === 'patron') {
                    const collectedArtworks = response.data.collection?.map(item => ({
                        ...item.artwork,
                        artist: item.artist,
                        collection_id: item.collection_id,
                        acquired_at: item.acquired_at
                    })) || [];
                    setArtworks(collectedArtworks);
                    setPagination(response.data.pagination || { total_pages: 1, current_page: 1 });
                }
            } catch (err) {
                console.error(`Failed to fetch artworks from ${endpoint}:`, err);
                if (err.response?.status === 403) {
                    setErrorArtworks("You do not have permission to view these artworks.");
                } else {
                    setErrorArtworks(
                        err.response?.data?.error?.message ||
                        err.response?.data?.message ||
                        err.message || "Could not load artworks."
                    );
                }
                setArtworks([]);
                setPagination({ total_pages: 1, current_page: 1 });
            } finally {
                setIsLoadingArtworks(false);
            }
        };

        console.log("Running fetchArtworks effect...");
        fetchArtworks(pagination.current_page);

    }, [profileUser?.user_id, isOwnProfile, pagination.current_page]);

    const handlePageChange = (event, value) => {
        if (value !== pagination.current_page) {
            setPagination(prev => ({ ...prev, current_page: value }));
            // The useEffect for fetching artworks will trigger due to pagination.current_page change
        }
    };

    // --- Render Logic ---

    // Handle initial auth loading (affects knowing if it's own profile)
    if (isAuthLoading) {
        return <Container maxWidth="lg"><Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress /></Box></Container>;
    }

    // Handle profile loading state
    if (isLoadingProfile) {
        return <Container maxWidth="lg"><Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress /></Box></Container>;
    }

    // Handle profile fetch error (e.g., user not found)
    if (errorProfile) {
        return <Container maxWidth="lg"><Alert severity="error" sx={{ mt: 4 }}>{errorProfile}</Alert></Container>;
    }

    // Handle case where profile user wasn't found or loaded
    if (!profileUser) {
        return <Container maxWidth="lg"><Alert severity="warning" sx={{ mt: 4 }}>Profile data could not be loaded for '{username}'.</Alert></Container>;
    }

    // --- Display Profile Info ---
    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Profile Header */}
            <Box sx={{ mb: 4, p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    {profileUser.username}'s Profile
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Role: {profileUser.role}
                </Typography>
                {/* Display message if not viewing own profile (optional) */}
                {!isOwnProfile && (
                    <Alert severity="info" sx={{ mt: 2 }}>You are viewing {profileUser.username}'s public profile.</Alert>
                )}
            </Box>

            {/* Only show Artworks section if it's the user's OWN profile */}
            {isOwnProfile ? (
                <>
                    <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3 }}>
                        {profileUser.role === 'artist' ? 'Created Artworks' : 'Collected Artworks'}
                    </Typography>

                    {isLoadingArtworks && (<Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}><CircularProgress /></Box>)}
                    {errorArtworks && !isLoadingArtworks && (<Alert severity="warning" sx={{ mt: 3 }}>{errorArtworks}</Alert>)}
                    {!isLoadingArtworks && !errorArtworks && artworks.length === 0 && (
                        <Typography sx={{ mt: 3, textAlign: 'center' }}>
                            No {profileUser.role === 'artist' ? 'created' : 'collected'} artworks found.
                        </Typography>
                    )}

                    {!isLoadingArtworks && !errorArtworks && artworks.length > 0 && (
                        <>
                            <Grid container spacing={3}>
                                {artworks.map((artwork) => (
                                    <Grid item key={artwork.artwork_id || artwork.collection_id} xs={12} sm={6} md={4} lg={3}>
                                        {/* Pass the correct artwork object structure to ArtworkCard */}
                                        {/* ArtworkCard might need adjustment if collected items have different structure */}
                                        <ArtworkCard artwork={artwork} />
                                    </Grid>
                                ))}
                            </Grid>
                            {/* Add Pagination controls if more than one page */}
                            {pagination.total_pages > 1 && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                                    <Pagination
                                        count={pagination.total_pages}
                                        page={pagination.current_page}
                                        onChange={handlePageChange}
                                        color="primary"
                                    />
                                </Box>
                            )}
                        </>
                    )}
                </>
            ) : (
                // Optional: Message indicating artworks aren't shown for public view
                <Typography sx={{ mt: 3, textAlign: 'center', fontStyle: 'italic' }}>
                    Artwork details are only visible on your own profile.
                </Typography>
            )}

        </Container>
    );
}

export default ProfilePage;