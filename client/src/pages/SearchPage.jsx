// src/pages/SearchPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/apiService';
import ArtworkCard from '../components/ArtworkCard';
import UserCard from '../components/UserCard';

import './SearchPage.css';

function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [results, setResults] = useState({
    artworks: [],
    users: []
  });

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!query.trim()) {
        setResults({ artworks: [], users: [] });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        const response = await apiService.get(`/search?q=${encodeURIComponent(query)}`);
        setResults({
          artworks: response.data.artworks || [],
          users: response.data.users || []
        });
      } catch (err) {
        console.error("SearchPage: Failed to fetch search results:", err);
        setError(err.response?.data?.error || err.message || "Failed to load search results.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSearchResults();
  }, [query]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Helper to determine if an artwork should be blurred
  const shouldBlurArtwork = (artwork) => {
    // If user owns the artwork, don't blur
    if (artwork.owner_id === user?.user_id) return false;
    
    // If user is not following the owner and it's not their own artwork, blur it
    if (!artwork.is_following_owner && artwork.owner_id !== user?.user_id) {
      return true;
    }
    
    return false;
  };

  // Helper to determine if a user should be blurred
  const shouldBlurUser = (userData) => false; // Users should never be blurred

  // Count total results
  const totalResults = results.artworks.length + results.users.length;

  return (
    <Container className={`search-page-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Search Results for "{query}"
        </Typography>
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ my: 2 }}>
            {error}
          </Alert>
        ) : totalResults === 0 ? (
          <Typography variant="body1" sx={{ my: 4 }}>
            No results found for "{query}". Try a different search term.
          </Typography>
        ) : (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="search result tabs">
                <Tab label={`All (${totalResults})`} id="tab-0" />
                <Tab label={`Artworks (${results.artworks.length})`} id="tab-1" />
                <Tab label={`Users (${results.users.length})`} id="tab-2" />
              </Tabs>
            </Box>

            {/* All Results Tab */}
            {tabValue === 0 && (
              <Box>
                {results.users.length > 0 && (
                  <Box className="search-section">
                    <Typography variant="h5" component="h2" gutterBottom>
                      Users
                    </Typography>
                    <Grid container spacing={3}>
                      {results.users.map((userData) => (
                        <Grid item key={userData.user_id} xs={12} sm={6} md={4}>
                          <UserCard 
                            user={userData} 
                            currentUser={user} 
                            isBlurred={shouldBlurUser(userData)} 
                          />
                        </Grid>
                      ))}
                    </Grid>
                    <Divider sx={{ my: 4 }} />
                  </Box>
                )}

                {results.artworks.length > 0 && (
                  <Box className="search-section">
                    <Typography variant="h5" component="h2" gutterBottom>
                      Artworks
                    </Typography>
                    <Grid container spacing={3}>
                      {results.artworks.map((artwork) => (
                        <Grid item key={artwork.artwork_id} xs={12} sm={6} md={4} lg={3}>
                          <ArtworkCard 
                            artwork={artwork}
                            isBlurred={shouldBlurArtwork(artwork)}
                            blurContext="collection"
                            isOwnArtwork={artwork.owner_id === user?.user_id}
                            ownerId={artwork.owner_id}
                            ownerUsername={artwork.owner_username}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}
              </Box>
            )}

            {/* Artworks Tab */}
            {tabValue === 1 && (
              <Grid container spacing={3}>
                {results.artworks.length > 0 ? (
                  results.artworks.map((artwork) => (
                    <Grid item key={artwork.artwork_id} xs={12} sm={6} md={4} lg={3}>
                      <ArtworkCard 
                        artwork={artwork}
                        isBlurred={shouldBlurArtwork(artwork)}
                        blurContext="collection"
                        isOwnArtwork={artwork.owner_id === user?.user_id}
                        ownerId={artwork.owner_id}
                        ownerUsername={artwork.owner_username}
                      />
                    </Grid>
                  ))
                ) : (
                  <Grid item xs={12}>
                    <Typography variant="body1">No artwork results found.</Typography>
                  </Grid>
                )}
              </Grid>
            )}

            {/* Users Tab */}
            {tabValue === 2 && (
              <Grid container spacing={3}>
                {results.users.length > 0 ? (
                  results.users.map((userData) => (
                    <Grid item key={userData.user_id} xs={12} sm={6} md={4}>
                      <UserCard 
                        user={userData} 
                        currentUser={user} 
                        isBlurred={shouldBlurUser(userData)} 
                      />
                    </Grid>
                  ))
                ) : (
                  <Grid item xs={12}>
                    <Typography variant="body1">No user results found.</Typography>
                  </Grid>
                )}
              </Grid>
            )}
          </>
        )}
      </Box>
    </Container>
  );
}

export default SearchPage;