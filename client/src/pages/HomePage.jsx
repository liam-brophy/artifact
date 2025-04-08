// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react'; // Import hooks
import { Link as RouterLink } from 'react-router-dom';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid'; // Needed for the artwork display layout
import CircularProgress from '@mui/material/CircularProgress'; // For loading state
import Alert from '@mui/material/Alert'; // For error state

import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService'; // Import your API service
import ArtworkCard from '../components/ArtworkCard'; // Import the reusable card

function HomePage() {
  const { user } = useAuth(); // Get user info from context

  // --- State for fetching artworks ---
  const [artworks, setArtworks] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Start loading
  const [error, setError] = useState(null);

  // --- Fetch artworks when component mounts ---
  useEffect(() => {
    const fetchRecentArtworks = async () => {
      setIsLoading(true); // Set loading true at the start of fetch
      setError(null); // Clear previous errors
      try {
        console.log("HomePage: Fetching recent artworks...");
        const response = await apiService.get('/artworks'); // Assuming default limit is okay or handled by backend
    
        // --- FIX STATE UPDATE ---
        // Access the 'artworks' array WITHIN response.data
        setArtworks(response.data.artworks || []);
        // -----------------------
    
        // Log the correct data being set
        console.log("HomePage: Artworks fetched successfully", response.data); // Log the whole response still useful
        console.log("HomePage: Setting artworks state with:", response.data.artworks || []); // Log what's being set
    
    } catch (err) {
       // ... error handling ...
       console.error("HomePage: Failed to fetch artworks:", err);
       setError( /* ... */ );
       setArtworks([]); // Ensure state is an empty array on error
    } finally {
        setIsLoading(false);
    }
    };

    fetchRecentArtworks();
  }, []); // Empty dependency array means this runs only once when the component mounts


  const welcomeMessage = user
    ? `Welcome back, ${user.username || user.email}!`
    : 'Welcome to Artifact!';


    console.log("HomePage Rendering:");
console.log("  isLoading:", isLoading);
console.log("  error:", error);
console.log("  artworks array length:", artworks.length);
// Log the first artwork object if the array is not empty
if (artworks.length > 0) {
    console.log("  First artwork object:", artworks[0]);
    // Check specifically for keys needed by ArtworkCard
    console.log("    -> artwork_id:", artworks[0]?.artwork_id);
    console.log("    -> title:", artworks[0]?.title);
    console.log("    -> thumbnail_url:", artworks[0]?.thumbnail_url);
    console.log("    -> artist object:", artworks[0]?.artist);
    console.log("      -> artist.user_id:", artworks[0]?.artist?.user_id);
    console.log("      -> artist.username:", artworks[0]?.artist?.username);
}

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>

      {/* --- Top Section (Welcome & Role Actions) - Remains the Same --- */}
      <Typography variant="h3" component="h1" gutterBottom align="center" sx={{ mb: 2, fontWeight: 'medium' }}>
        {welcomeMessage}
      </Typography>
      <Typography variant="h6" component="p" color="text.secondary" align="center" sx={{ mb: 4 }}>
        Discover, collect, and support digital artists.
      </Typography>
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        {/* Role specific buttons remain here */}
        {user && user.role === 'artist' && (
            <>
              <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>Artist Dashboard</Typography>
              <Button component={RouterLink} to="/upload" variant="contained" color="primary" size="large" sx={{ mr: 2 }}> Upload New Artwork </Button>
              <Button component={RouterLink} to={`/users/${user.username}`} variant="outlined" size="large"> My Profile & Artworks </Button>
            </>
          )}
          {user && user.role === 'patron' && (
              <>
                <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>Explore & Collect</Typography>
                {/* Placeholder for Browse Gallery Button */}
                <Button component={RouterLink} to="/gallery" variant="contained" color="primary" size="large" sx={{ mr: 2 }} > Browse Gallery </Button>
                <Button component={RouterLink} to={`/users/${user.username}`} variant="outlined" size="large" > My Profile & Collections </Button>
                 {/* Add Pack Opening Button Here Later */}
              </>
          )}
          {!user && (
              <>
                <Button component={RouterLink} to="/register" variant="contained" color="primary" size="large" sx={{ mr: 2 }}> Join as Artist or Patron </Button>
                 {/* Placeholder for Browse Gallery Button */}
                <Button component={RouterLink} to="/gallery" variant="outlined" size="large" > Explore Artworks </Button>
              </>
          )}
      </Box>
      {/* --- End Top Section --- */}


      {/* === Artwork Display Section === */}
      {/* Replaces the previous Paper/Placeholder section */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom align="center" sx={{ mb: 4 }}>
          Recent Artworks
        </Typography>

        {/* Conditional Rendering based on fetch state */}
        {isLoading ? (
          // Display loading indicator centered
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          // Display error message if fetch failed
          <Alert severity="error" sx={{ my: 3 }}>
            {error}
          </Alert>
        ) : artworks.length > 0 ? (
          // Display grid of artworks if fetch successful and artworks exist
          <Grid container spacing={3}>
            {artworks.map((artwork) => (
              <Grid item key={artwork.artwork_id} xs={12} sm={6} md={4} lg={3}>
                {/* Use the reusable ArtworkCard component */}
                <ArtworkCard artwork={artwork} />
              </Grid>
            ))}
          </Grid>
        ) : (
          // Display message if fetch successful but no artworks returned
          <Typography sx={{ mt: 3, textAlign: 'center', fontStyle: 'italic' }}>
            No artworks found yet. Be the first to upload!
          </Typography>
        )}
      </Box>
      {/* === End Artwork Display Section === */}

    </Container>
  );
}

export default HomePage;