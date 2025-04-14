import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import apiService from '../services/apiService';
import './ArtStudio.css';

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
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header area */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1">
          Customize Your Artwork
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
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
      </Box>
      
      {/* Main content area with sidebar on right */}
      <Box sx={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden',
        flexDirection: { xs: 'column', md: 'row' } // Column on mobile, row on desktop
      }}>
        {/* Large artwork preview area */}
        <Box sx={{ 
          flex: 1, 
          bgcolor: '#000', 
          position: 'relative',
          overflow: 'hidden',
          height: { xs: '70vh', md: 'auto' } // Fixed height on mobile, auto on desktop 
        }}>
          <div className="artwork-preview-container">
            <img 
              src={artwork?.image_url} 
              alt={artwork?.title} 
              className="artwork-image"
            />
            
            {selectedBorder && (
              <img 
                src={`/svg/borders/${selectedBorder}.svg`} 
                alt="Border" 
                className="artwork-border"
              />
            )}
          </div>
        </Box>
        
        {/* Sidebar for border selection - on right for desktop, below for mobile */}
        <Box sx={{ 
          width: { xs: '100%', md: '250px' }, 
          bgcolor: '#f9f9f9', 
          p: 2, 
          boxShadow: { xs: '0 -4px 10px rgba(0,0,0,0.1)', md: '-4px 0 10px rgba(0,0,0,0.1)' },
          overflowY: 'auto',
          display: 'flex',
          flexDirection: { xs: 'row', md: 'column' }, // Row layout on mobile
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          gap: 2
        }}>
          <Typography variant="h6" gutterBottom sx={{ width: '100%' }}>
            Select Border Style
          </Typography>
          
          {saveError && (
            <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
              {saveError}
            </Alert>
          )}
          
          {saveSuccess && (
            <Alert severity="success" sx={{ mb: 2, width: '100%' }}>
              Changes saved successfully!
            </Alert>
          )}
          
          <Box sx={{ 
            mt: 2,
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            flexWrap: { xs: 'wrap', md: 'nowrap' },
            gap: 2,
            width: '100%'
          }}>
            {AVAILABLE_BORDERS.map((border) => (
              <Card 
                key={border.id || 'no-border'} 
                sx={{ 
                  mb: { xs: 0, md: 2 }, 
                  cursor: 'pointer',
                  border: selectedBorder === border.id ? '2px solid #2196f3' : '1px solid #ddd',
                  '&:hover': {
                    boxShadow: 3
                  },
                  flexBasis: { xs: 'calc(50% - 8px)', sm: 'calc(33% - 11px)', md: '100%' }
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
        </Box>
      </Box>
    </Box>
  );
}

export default ArtStudio;