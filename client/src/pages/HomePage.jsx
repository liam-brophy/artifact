// src/pages/HomePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Slider from 'react-slick'; // Import react-slick

// Import slick carousel CSS
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// Import MUI components (can be gradually replaced if moving fully away from MUI)
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import ArtworkCard from '../components/ArtworkCard';
import UserPacks from '../components/UserPacks';

// Import the CSS file
import './HomePage.css';

function HomePage() {
  const { user } = useAuth();
  const sliderRef = useRef(null);

  // State for fetching artworks
  const [artworks, setArtworks] = useState([]);
  const [isLoadingArtworks, setIsLoadingArtworks] = useState(true);
  const [errorArtworks, setErrorArtworks] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slidesToShow, setSlidesToShow] = useState(4);

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
    
    // Update slidesToShow based on window width
    const updateSlidesToShow = () => {
      if (window.innerWidth >= 1200) {
        setSlidesToShow(4);
      } else if (window.innerWidth >= 900) {
        setSlidesToShow(3);
      } else if (window.innerWidth >= 600) {
        setSlidesToShow(2);
      } else {
        setSlidesToShow(1);
      }
    };
    
    // Initial calculation
    updateSlidesToShow();
    
    // Listen for resize events
    window.addEventListener('resize', updateSlidesToShow);
    return () => window.removeEventListener('resize', updateSlidesToShow);
  }, []);

  const welcomeMessage = user
    ? `Welcome back, ${user.username || user.email}!`
    : 'Welcome to Artifact!';

  // Handle slide change to update card positions
  const handleBeforeChange = (oldIndex, newIndex) => {
    setCurrentSlide(newIndex);
  };

  // Enhanced style function that uses CSS variables instead of direct transforms
  const getCardStyle = (index) => {
    const relativeIndex = index - currentSlide;
    
    // More subtle rotation to avoid overflow issues
    const rotationFactor = Math.abs(relativeIndex) <= 1 ? 0 : 
                           (index % 2 === 0 ? 1 : -1) * Math.min(Math.abs(relativeIndex), 2);
                           
    return {
      // Set custom properties for CSS
      '--index': index,
      '--relative-index': relativeIndex,
      '--rotation-angle': `${rotationFactor * 2}deg`, // Store rotation as CSS variable
      animationDelay: `${index * 0.08}s`,
      zIndex: 10 - Math.abs(relativeIndex),
      // Remove direct transform property
    };
  };

  // Carousel settings with fixed number of items per screen size
  const carouselSettings = {
    dots: true,
    infinite: artworks.length > slidesToShow,
    speed: 500,
    slidesToShow: slidesToShow,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    pauseOnHover: true,
    centerMode: false,
    arrows: true, // Enable arrows for easier navigation
    beforeChange: handleBeforeChange,
    responsive: [
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 1,
          infinite: artworks.length > 3,
        }
      },
      {
        breakpoint: 900,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
          infinite: artworks.length > 2,
        }
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
          centerMode: true,
          centerPadding: '30px',
        }
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
          centerMode: true,
          centerPadding: '20px',
          dots: false,
        }
      }
    ]
  };

  return (
    <div className="home-page-container">
      {/* --- Hero Section --- */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">{welcomeMessage}</h1>
          <p className="hero-subtitle">
            Collect and support artists<br></br> on a platform designed for discovery.
          </p>
          {!user && (
            <div className="hero-cta">
              <Button component={RouterLink} to="/register" variant="contained" color="primary" size="large" sx={{ mr: 1, mb: 1 }}> 
                Join as Artist or Patron 
              </Button>
              <Button component={RouterLink} to="/gallery" variant="outlined" size="large" sx={{ mr: 1, mb: 1 }} className="hero-button-outlined"> 
                Explore Artworks 
              </Button>
            </div>
          )}
        </div>
      </section>
      {/* --- End Hero Section --- */}

      {/* Content Container for the rest of the page */}
      <div className="content-container">
        {/* === User Packs Section === */}
        {user && (
          <section className="packs-section">
            <UserPacks />
          </section>
        )}
        {/* === End User Packs Section === */}

        {/* === Artwork Carousel Section === */}
        <section className="artworks-carousel-section">
          <h2 className="artworks-carousel-title">Featured Artworks</h2>

          {isLoadingArtworks ? (
            <div className="loading-container">
              <CircularProgress />
            </div>
          ) : errorArtworks ? (
            <div className="error-container">
              <Alert severity="error" sx={{ width: '100%', justifyContent: 'center' }}>
                {typeof errorArtworks === 'object' ? errorArtworks.message || JSON.stringify(errorArtworks) : errorArtworks}
              </Alert>
            </div>
          ) : artworks.length > 0 ? (
            <div className="carousel-container">
              <Slider {...carouselSettings} ref={sliderRef}>
                {artworks.map((artwork, index) => (
                  <div key={artwork.artwork_id} className="carousel-slide" style={getCardStyle(index)}>
                    <ArtworkCard artwork={artwork} />
                  </div>
                ))}
              </Slider>
            </div>
          ) : (
            <div className="no-artworks-container">
              <p>No artworks found yet.</p>
            </div>
          )}
        </section>
        {/* === End Artwork Carousel Section === */}
      </div>
    </div>
  );
}

export default HomePage;