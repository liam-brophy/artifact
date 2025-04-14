import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import apiService from '../services/apiService';
import './ArtStudio.css'; // We'll create this CSS file next

const AVAILABLE_BORDERS = [
  { id: 'Artifact_Decal-01', name: 'Decal 1' },
  { id: 'Artifact_Decal-02', name: 'Decal 2' },
  { id: 'Artifact_Decal-03', name: 'Decal 3' },
  { id: 'Artifact_Decal-04', name: 'Decal 4' },
  { id: null, name: 'No Border' } // Option to remove border
];

function ArtStudio() {
  const { artworkId } = useParams();
  const navigate = useNavigate();
  
  const [artwork, setArtwork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBorder, setSelectedBorder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Fetch artwork data when component mounts
  useEffect(() => {
    const fetchArtwork = async () => {
      try {
        setLoading(true);
        const response = await apiService.get(`/artworks/${artworkId}`);
        setArtwork(response.data);
        // If artwork already has a border, select it
        setSelectedBorder(response.data.border_decal_id);
      } catch (err) {
        console.error('Failed to fetch artwork:', err);
        setError('Failed to load artwork. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    if (artworkId) {
      fetchArtwork();
    }
  }, [artworkId]);
  
  // Handle border selection
  const handleBorderSelect = (borderId) => {
    setSelectedBorder(borderId);
    setSaveSuccess(false);
  };
  
  // Handle save action
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);
      
      const response = await apiService.put(`/artworks/${artworkId}`, {
        border_decal_id: selectedBorder
      });
      
      // Update local state with the response
      setArtwork(response.data);
      setSaveSuccess(true);
      
      // Navigate back to artwork detail after short delay
      setTimeout(() => {
        navigate(`/artworks/${artworkId}`);
      }, 1500);
      
    } catch (err) {
      console.error('Failed to save border:', err);
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Return to artwork detail without saving
  const handleCancel = () => {
    navigate(`/artworks/${artworkId}`);
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate(-1)} 
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 2, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Customize Your Artwork
      </Typography>
      
      {/* Main content area */}
      <Grid container spacing={3}>
        {/* Preview area */}
        <Grid item xs={12} md={8}>
          <Box 
            sx={{ 
              border: '1px solid #ddd', 
              borderRadius: 1, 
              p: 2, 
              mb: 2, 
              bgcolor: '#f9f9f9',
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 400
            }}
          >
            <div className="artwork-preview-container">
              {/* Base image layer */}
              <img 
                src={artwork?.image_url} 
                alt={artwork?.title} 
                className="artwork-image"
              />
              
              {/* SVG border overlay */}
              {selectedBorder && (
                <img 
                  src={`/svg/borders/${selectedBorder}.svg`} 
                  alt="Border" 
                  className="artwork-border"
                />
              )}
            </div>
          </Box>
          
          {/* Action buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button 
              variant="outlined" 
              startIcon={<ArrowBackIcon />} 
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<SaveIcon />} 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
          
          {saveError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {saveError}
            </Alert>
          )}
          
          {saveSuccess && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Changes saved successfully!
            </Alert>
          )}
        </Grid>
        
        {/* Border selection sidebar */}
        <Grid item xs={12} md={4}>
          <Typography variant="h6" gutterBottom>
            Select Border Style
          </Typography>
          
          <Box sx={{ mt: 2 }}>
            {AVAILABLE_BORDERS.map((border) => (
              <Card 
                key={border.id || 'no-border'} 
                sx={{ 
                  mb: 2, 
                  cursor: 'pointer',
                  border: selectedBorder === border.id ? '2px solid #2196f3' : '1px solid #ddd',
                  '&:hover': {
                    boxShadow: 3
                  }
                }}
                onClick={() => handleBorderSelect(border.id)}
              >
                <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                  <Typography variant="body2">
                    {border.name}
                  </Typography>
                </CardContent>
                {border.id && (
                  <CardMedia
                    component="img"
                    height="100"
                    image={`/svg/borders/${border.id}.svg`}
                    alt={border.name}
                    sx={{ objectFit: 'contain', p: 1 }}
                  />
                )}
                {!border.id && (
                  <Box sx={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No border
                    </Typography>
                  </Box>
                )}
              </Card>
            ))}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export default ArtStudio;