// src/pages/HomePage.jsx
import React from 'react';
import { Link as RouterLink } from 'react-router-dom'; // Use alias for clarity
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid'; // Optional: For layouting future sections
import Paper from '@mui/material/Paper'; // Optional: For distinct sections

import { useAuth } from '../context/AuthContext'; // Assuming this provides user { username, email, role }

function HomePage() {
  const { user } = useAuth(); // Get user info from context

  const welcomeMessage = user
    ? `Welcome back, ${user.username || user.email}!`
    : 'Welcome to the Artifact!';

  return (
    // Container centers content and provides max-width
    <Container maxWidth="lg" sx={{ py: 4 }}> {/* Add vertical padding */}

      {/* Main Welcome Heading */}
      <Typography
        variant="h3"
        component="h1" // Semantic heading 1
        gutterBottom
        align="center"
        sx={{ mb: 2, fontWeight: 'medium' }}
      >
        {welcomeMessage}
      </Typography>

      {/* Subtitle or introductory text */}
      <Typography
        variant="h6"
        component="p"
        color="text.secondary"
        align="center"
        sx={{ mb: 4 }}
      >
        Discover unique artworks or share your creations with the world.
      </Typography>

      {/* --- Role-Specific Action/Info Area --- */}
      {/* This section provides clear calls to action or info based on role */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        {user && user.role === 'artist' && (
           <>
             <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>Artist Dashboard</Typography>
             <Button
                component={RouterLink}
                to="/upload" // Link to the upload page
                variant="contained"
                color="primary"
                size="large"
                sx={{ mr: 2 }}
             >
               Upload New Artwork
             </Button>
             <Button
                component={RouterLink}
                to="/my-artworks" // Link to a future 'My Artworks' page
                variant="outlined"
                size="large"
             >
               Manage My Artworks
             </Button>
          </>
        )}

        {user && user.role === 'patron' && (
            <>
                <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>Explore & Collect</Typography>
                <Button
                    component={RouterLink}
                    to="/gallery" // Link to a future gallery/browse page
                    variant="contained"
                    color="primary"
                    size="large"
                    sx={{ mr: 2 }}
                >
                    Browse Gallery
                </Button>
                <Button
                    component={RouterLink}
                    to="/my-collections" // Link to a future 'My Collections' page
                    variant="outlined"
                    size="large"
                >
                    View My Collections
                </Button>
            </>
        )}

        {!user && (
            // Call to action for guests
            <>
                <Button
                    component={RouterLink}
                    to="/register" // Link to registration
                    variant="contained"
                    color="primary"
                    size="large"
                    sx={{ mr: 2 }}
                >
                    Join as Artist or Patron
                </Button>
                <Button
                    component={RouterLink}
                    to="/gallery" // Link to browse even as guest
                    variant="outlined"
                    size="large"
                >
                    Explore Artworks
                </Button>
           </>
        )}
      </Box>
      {/* --- End Role-Specific Area --- */}


      {/* === Placeholder for Future Content (e.g., Featured Artworks, Collections) === */}
      {/* Using Paper for a slightly elevated section, Grid for potential layout */}
      <Paper elevation={2} sx={{ p: 3, mt: 4, backgroundColor: 'grey.100' }}>
        <Typography variant="h5" component="h2" gutterBottom>
            Featured Content
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
            Highlights from our talented artists and curated collections will appear here soon.
        </Typography>
        {/* Example Grid layout placeholder */}
        <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4}>
                <Box sx={{ border: '1px dashed grey', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'grey.600' }}>
                    (Featured Artwork/Collection Slot 1)
                </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
                 <Box sx={{ border: '1px dashed grey', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'grey.600' }}>
                    (Featured Artwork/Collection Slot 2)
                </Box>
            </Grid>
             <Grid item xs={12} sm={6} md={4}>
                 <Box sx={{ border: '1px dashed grey', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'grey.600' }}>
                    (Featured Artwork/Collection Slot 3)
                </Box>
            </Grid>
        </Grid>
      </Paper>
      {/* === End Placeholder === */}

    </Container>
  );
}

export default HomePage;