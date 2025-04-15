import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Container, Grid, Paper, Chip, Button, 
  CircularProgress, Divider, Dialog, DialogActions, DialogContent, 
  DialogContentText, DialogTitle, TextField, MenuItem, FormControl,
  InputLabel, Select, IconButton, Alert, Stack
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import BrushIcon from '@mui/icons-material/Brush';
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { ARTWORK_RARITIES, RARITY_VALUES } from '../constants/artwork';
import TradeOfferDialog from '../components/TradeOfferDialog';
import './ArtworkDetailsPage.css';

function ArtworkDetailsPage() {
  const { artworkId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [artwork, setArtwork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    artist_name: '',
    description: '',
    series: '',
    year: '',
    medium: '',
    rarity: ''
  });
  const [editError, setEditError] = useState(null);
  const [editSuccess, setEditSuccess] = useState(false);
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Trade offer dialog state
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);

  useEffect(() => {
    const fetchArtworkDetails = async () => {
      setLoading(true);
      try {
        const response = await apiService.get(`/artworks/${artworkId}`);
        setArtwork(response.data);
      } catch (err) {
        console.error('Error fetching artwork details:', err);
        setError(err.response?.data?.error?.message || 'Failed to load artwork details');
      } finally {
        setLoading(false);
      }
    };

    if (artworkId) {
      fetchArtworkDetails();
    }
  }, [artworkId]);

  // Check if current user is the creator of the artwork
  const isCreator = user?.user_id === artwork?.artist_id;
  
  // Initialize edit form when opening edit mode
  const handleStartEditing = () => {
    setEditFormData({
      title: artwork.title || '',
      artist_name: artwork.artist_name || '',
      description: artwork.description || '',
      series: artwork.series || '',
      year: artwork.year?.toString() || '', // Convert number to string for form
      medium: artwork.medium || '',
      rarity: artwork.rarity || ''
    });
    setIsEditing(true);
    setEditError(null);
    setEditSuccess(false);
  };

  // Handle form input changes
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Submit edit form
  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(false);
    
    try {
      // Clean up form data - convert year to number or null
      const formattedData = {
        ...editFormData,
        year: editFormData.year ? parseInt(editFormData.year, 10) : null
      };
      
      const response = await apiService.put(`/artworks/${artworkId}`, formattedData);
      
      if (response.data) {
        // Update local artwork state with the updated data
        setArtwork(response.data);
        setEditSuccess(true);
        
        // Close edit mode after a brief delay to show success message
        setTimeout(() => {
          setIsEditing(false);
        }, 1500);
      } else {
        throw new Error('No data received from server');
      }
    } catch (err) {
      console.error('Error updating artwork:', err);
      setEditError(err.response?.data?.error?.message || err.message || 'Failed to update artwork');
    }
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
  };

  // Open delete confirmation dialog
  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true);
    setDeleteError(null);
  };

  // Close delete confirmation dialog
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteError(null);
  };

  // Delete the artwork
  const handleDeleteArtwork = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    
    try {
      await apiService.delete(`/artworks/${artworkId}`);
      
      // Close dialog and redirect back to a safe page (e.g., home or profile)
      setDeleteDialogOpen(false);
      navigate('/');
    } catch (err) {
      console.error('Error deleting artwork:', err);
      setDeleteError(err.response?.data?.error?.message || 'Failed to delete artwork');
      setDeleteLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate(-1); // Navigate back to the previous page
  };

  const handleArtistClick = () => {
    if (artwork?.artist?.username) {
      navigate(`/users/${artwork.artist.username}`);
    }
  };

  const handleOpenTradeDialog = () => {
    setTradeDialogOpen(true);
  };

  const handleCloseTradeDialog = () => {
    setTradeDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="artwork-details-container">
        <div className="loading-container">
          <CircularProgress />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="artwork-details-container">
        <button className="back-button" onClick={handleGoBack}>
          <ArrowBackIcon /> Back
        </button>
        <div className="error-container">
          <Typography variant="h5" color="error">{error}</Typography>
        </div>
      </div>
    );
  }

  if (!artwork) {
    return (
      <div className="artwork-details-container">
        <button className="back-button" onClick={handleGoBack}>
          <ArrowBackIcon /> Back
        </button>
        <div className="error-container">
          <Typography variant="h5">Artwork not found</Typography>
        </div>
      </div>
    );
  }

  // Determine the artist name to display
  const artistName = artwork.artist_name || artwork.artist?.username || 'Unknown Artist';

  // Helper function to get rarity class name
  const getRarityClassName = (rarity) => {
    return `artwork-rarity artwork-rarity-${rarity || 'common'}`;
  };

  return (
    <div className="artwork-details-container">
      <Button 
        startIcon={<ArrowBackIcon />} 
        onClick={handleGoBack}
        className="back-button"
      >
        Back
      </Button>
      
      <div className="artwork-content-container">
        {/* Artwork Image Container */}
        <div className="artwork-image-container">
          <img
            src={artwork.image_url}
            alt={artwork.title || 'Artwork'}
            className="artwork-image"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://via.placeholder.com/800x600.png?text=Artwork+Image+Not+Available';
            }}
          />
          {/* Display SVG border if one is selected */}
          {artwork.border_decal_id && (
            <object
              data={`${import.meta.env.BASE_URL}svg/borders/${artwork.border_decal_id}.svg`}
              type="image/svg+xml"
              className="artwork-border"
              aria-label="Border"
            >
              {/* Fallback to img if object fails */}
              <img
                src={`${import.meta.env.BASE_URL}svg/borders/${artwork.border_decal_id}.svg`}
                alt="Border"
                className="artwork-border"
              />
            </object>
          )}
        </div>
        
        {/* Details/Edit Panel */}
        <div className="artwork-details-panel">
          {isEditing ? (
            // Edit Form
            <>
              <h2 className="artwork-title">Edit Artwork</h2>
              
              {editError && (
                <div className="artwork-alert artwork-alert-error">
                  {editError}
                </div>
              )}
              
              {editSuccess && (
                <div className="artwork-alert artwork-alert-success">
                  Artwork updated successfully!
                </div>
              )}
              
              <form className="artwork-edit-form" onSubmit={handleSubmitEdit}>
                <TextField
                  name="title"
                  label="Title"
                  value={editFormData.title}
                  onChange={handleEditFormChange}
                  fullWidth
                  required
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  className="form-field compact-form-field"
                />
                
                <TextField
                  name="artist_name"
                  label="Artist Name"
                  value={editFormData.artist_name}
                  onChange={handleEditFormChange}
                  fullWidth
                  required
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  className="form-field compact-form-field"
                />
                
                <div className="form-row">
                  <TextField
                    name="medium"
                    label="Medium"
                    value={editFormData.medium}
                    onChange={handleEditFormChange}
                    fullWidth
                    required
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    className="form-field compact-form-field"
                  />
                  
                  <TextField
                    name="year"
                    label="Year"
                    type="number"
                    value={editFormData.year}
                    onChange={handleEditFormChange}
                    size="small"
                    InputProps={{ inputProps: { min: 0 } }}
                    InputLabelProps={{ shrink: true }}
                    className="form-field-small compact-form-field"
                  />
                </div>
                
                <div className="form-row">
                  <FormControl size="small" className="form-field compact-form-field">
                    <InputLabel id="rarity-select-label" shrink>Rarity</InputLabel>
                    <Select
                      labelId="rarity-select-label"
                      id="rarity"
                      name="rarity"
                      value={editFormData.rarity}
                      label="Rarity"
                      onChange={handleEditFormChange}
                      required
                    >
                      {ARTWORK_RARITIES.map((rarityOpt) => (
                        <MenuItem key={rarityOpt.value} value={rarityOpt.value}>
                          {rarityOpt.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <TextField
                    name="series"
                    label="Series"
                    value={editFormData.series}
                    onChange={handleEditFormChange}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    className="form-field compact-form-field"
                  />
                </div>
                
                <TextField
                  name="description"
                  label="Description"
                  value={editFormData.description}
                  onChange={handleEditFormChange}
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  className="form-field compact-form-field"
                />
                
                <div className="form-actions">
                  <Button 
                    type="button" 
                    onClick={handleCancelEdit} 
                    size="small" 
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    variant="contained" 
                    color="primary" 
                    size="small"
                  >
                    Save
                  </Button>
                </div>
              </form>
            </>
          ) : (
            // Normal display mode
            <>
              <h1 className="artwork-title">
                {artwork.title || 'Untitled'}
              </h1>
              
              <h2 
                className="artwork-artist" 
                onClick={handleArtistClick}
              >
                by {artistName}
              </h2>
              
              {artwork.rarity && (
                <div className={getRarityClassName(artwork.rarity)}>
                  {artwork.rarity.charAt(0).toUpperCase() + artwork.rarity.slice(1)}
                </div>
              )}
              
              {/* Creator Actions */}
              {isCreator && (
                <div className="artwork-creator-actions">
                  <Button 
                    startIcon={<EditIcon />} 
                    variant="outlined" 
                    size="small" 
                    onClick={handleStartEditing}
                  >
                    Edit
                  </Button>
                  <Button 
                    startIcon={<BrushIcon />} 
                    variant="outlined" 
                    color="secondary" 
                    size="small" 
                    onClick={() => navigate(`/studio/${artwork.artwork_id}`)}
                  >
                    Customize
                  </Button>
                  <Button 
                    startIcon={<DeleteIcon />} 
                    variant="outlined" 
                    color="error" 
                    size="small" 
                    onClick={handleOpenDeleteDialog}
                  >
                    Delete
                  </Button>
                </div>
              )}
              
              <hr className="artwork-divider" />
              
              {/* Series */}
              {artwork.series && (
                <div className="artwork-section">
                  <h3 className="artwork-section-title">
                    Series
                  </h3>
                  <div className="artwork-section-content">
                    {artwork.series}
                  </div>
                </div>
              )}
              
              {/* Medium & Year */}
              <div className="artwork-section">
                <h3 className="artwork-section-title">
                  Details
                </h3>
                <div className="artwork-section-content">
                  {[
                    artwork.medium,
                    artwork.year && `${artwork.year}`
                  ].filter(Boolean).join(', ')}
                </div>
              </div>
              
              {/* Description */}
              {artwork.description && (
                <div className="artwork-section">
                  <h3 className="artwork-section-title">
                    Description
                  </h3>
                  <div className="artwork-section-content">
                    {artwork.description}
                  </div>
                </div>
              )}
              
              <hr className="artwork-divider" />
              
              {/* Metadata */}
              <div className="artwork-metadata">
                <p>Artifact ID: {artwork.artwork_id}</p>
                <p>Created: {new Date(artwork.created_at).toLocaleDateString()}</p>
              </div>

              {/* Trade Button - only show if:
                  1. User is logged in
                  2. Artwork has a collection owner (it's in someone's collection)
                  3. Current user is not the collection owner
                  4. Current user is a patron (as only patrons can trade) */}
              {user && 
               artwork.collection_owner_id && 
               artwork.collection_owner_id !== user.user_id &&
               user.role === 'patron' && (
                <Button 
                  startIcon={<SwapHorizIcon />} 
                  variant="contained" 
                  color="primary" 
                  size="small" 
                  onClick={handleOpenTradeDialog}
                  sx={{ mt: 2 }}
                >
                  Propose Trade
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={!deleteLoading ? handleCloseDeleteDialog : undefined}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete "{artwork?.title || 'this artwork'}"? This action cannot be undone.
          </DialogContentText>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeleteDialog} 
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteArtwork} 
            color="error" 
            disabled={deleteLoading} 
            autoFocus
          >
            {deleteLoading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Trade Offer Dialog */}
      <TradeOfferDialog
        open={tradeDialogOpen}
        onClose={handleCloseTradeDialog}
        requestedArtwork={artwork}
        recipientId={artwork?.collection_owner_id}
      />
    </div>
  );
}

export default ArtworkDetailsPage;