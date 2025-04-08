// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Slider from 'react-slick'; // Import react-slick

// Import slick carousel CSS
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// Import MUI components (can be gradually replaced if moving fully away from MUI)
import Container from '@mui/material/Container'; // Still used for overall structure maybe
import Typography from '@mui/material/Typography'; // Useful for consistent text styles
import Box from '@mui/material/Box';
import Button from '@mui/material/Button'; // Keep for now
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import ArtworkCard from '../components/ArtworkCard';
import UserPacks from '../components/UserPacks'; // Import UserPacks

// Import the CSS file
import './HomePage.css';

function HomePage() {
  const { user } = useAuth();

  // State for fetching artworks
  const [artworks, setArtworks] = useState([]);
  const [isLoadingArtworks, setIsLoadingArtworks] = useState(true);
  const [errorArtworks, setErrorArtworks] = useState(null);

  // Fetch artworks when component mounts
  useEffect(() => {
    const fetchRecentArtworks = async () => {
      setIsLoadingArtworks(true);
      setErrorArtworks(null);
      try {
        const response = await apiService.get('/artworks');
        setArtworks(response.data.artworks || []);
      } catch (err) {
        console.error("HomePage: Failed to fetch artworks:", err);
        setErrorArtworks(err.response?.data?.error || err.message || "Failed to load artworks.");
        setArtworks([]);
      } finally {
        setIsLoadingArtworks(false);
      }
    };
    fetchRecentArtworks();
  }, []);

  const welcomeMessage = user
    ? `Welcome back, ${user.username || user.email}!`
    : 'Welcome to Artifact!';

  // Carousel settings
  const carouselSettings = {
    dots: true,
    infinite: artworks.length > 3, // Only loop if enough items
    speed: 500,
    slidesToShow: 4, // Show 4 items on larger screens
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    pauseOnHover: true,
    responsive: [
      {
        breakpoint: 1200, // lg
        settings: {
          slidesToShow: 3,
        }
      },
      {
        breakpoint: 900, // md
        settings: {
          slidesToShow: 2,
        }
      },
      {
        breakpoint: 600, // sm
        settings: {
          slidesToShow: 1,
        }
      }
    ]
  };

  return (
    // Use className for overall container styling
    <div className="home-page-container">

      {/* --- Top Section (Welcome & Role Actions) --- */}
      <section className="welcome-section">
        <h1 className="welcome-title">{welcomeMessage}</h1>
        <p className="welcome-subtitle">Discover, collect, and support digital artists.</p>
        <div className="role-actions">
          {/* Role specific buttons - Keep using MUI Button for now, or style regular buttons */}
          {user && user.role === 'artist' && (
            <>
              {/* Using Typography for heading style consistency */}
              <Typography variant="h5" component="h3" gutterBottom sx={{ mb: 2 }}>Artist Dashboard</Typography>
              <Button component={RouterLink} to="/upload" variant="contained" color="primary" size="large" sx={{ mr: 1, ml: 1 }}> Upload New Artwork </Button>
              <Button component={RouterLink} to={`/users/${user.username}`} variant="outlined" size="large" sx={{ mr: 1, ml: 1 }}> My Profile & Artworks </Button>
            </>
          )}
          {user && user.role === 'patron' && (
              <>
                <Typography variant="h5" component="h3" gutterBottom sx={{ mb: 2 }}>Explore & Collect</Typography>
                <Button component={RouterLink} to="/gallery" variant="contained" color="primary" size="large" sx={{ mr: 1, ml: 1 }} > Browse Gallery </Button>
                <Button component={RouterLink} to={`/users/${user.username}`} variant="outlined" size="large" sx={{ mr: 1, ml: 1 }}> My Profile & Collections </Button>
              </>
          )}
          {!user && (
              <>
                <Button component={RouterLink} to="/register" variant="contained" color="primary" size="large" sx={{ mr: 1, ml: 1 }}> Join as Artist or Patron </Button>
                <Button component={RouterLink} to="/gallery" variant="outlined" size="large" sx={{ mr: 1, ml: 1 }}> Explore Artworks </Button>
              </>
          )}
        </div>
      </section>
      {/* --- End Top Section --- */}

      {/* === User Packs Section === */}
      {/* Only show this section if the user is logged in */}
      {user && (
        <section className="packs-section">
          <h2 className="packs-section-title">Your Unopened Packs</h2>
          <UserPacks /> {/* Render the dedicated component here */}
        </section>
      )}
      {/* === End User Packs Section === */}


      {/* === Artwork Carousel Section === */}
      <section className="artworks-carousel-section">
        <h2 className="artworks-carousel-title">Featured Artworks</h2>

        {/* Conditional Rendering based on fetch state */}
        {isLoadingArtworks ? (
          <div className="loading-container">
            <CircularProgress />
          </div>
        ) : errorArtworks ? (
          <div className="error-container">
            {/* Using Alert for consistency, but could be a simple p tag */}
            <Alert severity="error" sx={{ width: '100%', justifyContent: 'center' }}>
              {errorArtworks}
            </Alert>
          </div>
        ) : artworks.length > 0 ? (
          // Use the react-slick Slider component
          <Slider {...carouselSettings}>
            {artworks.map((artwork) => (
              // Add a div wrapper for potential slide padding/styling
              <div key={artwork.artwork_id} className="carousel-slide">
                <ArtworkCard artwork={artwork} />
              </div>
            ))}
          </Slider>
        ) : (
          <div className="no-artworks-container">
            <p>No artworks found yet.</p>
          </div>
        )}
      </section>
      {/* === End Artwork Carousel Section === */}

    </div> // End home-page-container
  );
}

export default HomePage;