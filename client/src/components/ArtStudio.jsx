import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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

/**
 * ArtStudio component for customizing artwork borders
 * Can be used in two modes:
 * 1. "customize" mode: For existing artwork (accessed via /artworks/:artworkId/customize)
 * 2. "upload" mode: As part of the upload flow, with artwork data passed as props
 */
function ArtStudio({ mode = 'customize', artworkData = null, onSave = null, onCancel = null }) {
  const { artworkId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [artwork, setArtwork] = useState(artworkData);
  const [loading, setLoading] = useState(!artworkData);
  const [error, setError] = useState(null);
  // Initialize with either artworkData border or null (for "No Border")
  const [selectedBorder, setSelectedBorder] = useState(artworkData?.border_decal_id || null);
  // Track the currently selected border separately from the artwork object
  const [currentBorderId, setCurrentBorderId] = useState(artworkData?.border_decal_id || null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Fetch artwork data when component mounts (only in customize mode)
  useEffect(() => {
    // Only fetch artwork data if we're in customize mode and don't have data already
    if (mode === 'customize' && artworkId && !artwork) {
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
      
      fetchArtwork();
    }
  }, [artworkId, artwork, mode]);

  // Update local state if artworkData changes (for upload mode)
  useEffect(() => {
    if (artworkData && mode === 'upload') {
      setArtwork(artworkData);
      if (artworkData.border_decal_id !== undefined && artworkData.border_decal_id !== selectedBorder) {
        setSelectedBorder(artworkData.border_decal_id);
      }
    }
  }, [artworkData, mode, selectedBorder]);
  
  // Handle border selection
  const handleBorderSelect = (borderId) => {
    console.log('Border selected:', borderId);
    
    // Update both state variables to maintain UI consistency
    setSelectedBorder(borderId);
    setCurrentBorderId(borderId);
    setSaveSuccess(false);
    
    // Directly update the artwork state with the new border for immediate visual feedback
    if (artwork) {
      setArtwork({
        ...artwork,
        border_decal_id: borderId
      });
    }
  };
  
  // Handle save action
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);
      
      if (mode === 'upload') {
        // In upload mode, we call the onSave callback with the selected border
        if (typeof onSave === 'function') {
          await onSave(selectedBorder);
          setSaveSuccess(true);
        }
      } else {
        // In customize mode, we update the existing artwork via API
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
      }
    } catch (err) {
      console.error('Failed to save border:', err);
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Return to artwork detail without saving or call onCancel
  const handleCancel = () => {
    if (mode === 'upload' && typeof onCancel === 'function') {
      onCancel();
    } else {
      navigate(`/artworks/${artworkId}`);
    }
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
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header area */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1">
          {mode === 'customize' ? 'Customize Your Artwork' : 'Select Border Style'}
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
            {saving ? 'Saving...' : mode === 'customize' ? 'Save Changes' : 'Apply Border'}
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
            
            {/* Show border based on currentBorderId instead */}
            {currentBorderId && (
              <img 
                src={`${import.meta.env.BASE_URL}svg/borders/${currentBorderId}.svg`} 
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
              {mode === 'customize' ? 'Changes saved successfully!' : 'Border applied successfully!'}
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
                  border: currentBorderId === border.id ? '2px solid #2196f3' : '1px solid #ddd',
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
                    image={`${import.meta.env.BASE_URL}svg/borders/${border.id}.svg`}
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