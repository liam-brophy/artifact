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
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { ARTWORK_RARITIES, RARITY_VALUES } from '../constants/artwork';

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
        year: editFormData.year ? parseInt(editFormData.year, 10) : null,
        // Ensure these fields are included
        artwork_id: artwork.artwork_id,
        artist_id: artwork.artist_id
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
      setEditError(err.response?.data?.message || err.message || 'Failed to update artwork');
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

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleGoBack} sx={{ mb: 2 }}>
          Back
        </Button>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h5" color="error">{error}</Typography>
        </Paper>
      </Container>
    );
  }

  if (!artwork) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleGoBack} sx={{ mb: 2 }}>
          Back
        </Button>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h5">Artwork not found</Typography>
        </Paper>
      </Container>
    );
  }

  // Determine the artist name to display
  const artistName = artwork.artist_name || artwork.artist?.username || 'Unknown Artist';

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={handleGoBack} sx={{ mb: 2 }}>
        Back
      </Button>
      
      <Grid container spacing={4}>
        {/* Image Column - Takes up more space now */}
        <Grid item xs={12} md={8} lg={9}>
          <Paper
            elevation={3}
            sx={{
              p: 0,
              overflow: 'hidden',
              height: 'calc(90vh - 100px)', // Much taller, almost full viewport height
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#000' // Black background to make artwork pop
            }}
          >
            {/* Full artwork display */}
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: '100%', // Use full height of container
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Box
                component="img"
                src={artwork.image_url}
                alt={artwork.title || 'Artwork'}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain', // Maintain aspect ratio without cropping
                  display: 'block'
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/800x600.png?text=Artwork+Image+Not+Available';
                }}
              />
            </Box>
          </Paper>
        </Grid>
        
        {/* Details Column - Takes less space now */}
        <Grid item xs={12} md={4} lg={3}>
          <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
            {/* Artwork title */}
            <Typography variant="h4" component="h1" gutterBottom>
              {artwork.title || 'Untitled'}
            </Typography>
            
            {/* Artist name with clickable link */}
            <Typography 
              variant="h6" 
              component="h2" 
              onClick={handleArtistClick}
              sx={{ 
                mb: 2, 
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' } 
              }}
            >
              by {artistName}
            </Typography>
            
            {/* Rarity badge */}
            {artwork.rarity && (
              <Chip 
                label={artwork.rarity.charAt(0).toUpperCase() + artwork.rarity.slice(1)}
                color={
                  artwork.rarity === 'common' ? 'default' :
                  artwork.rarity === 'uncommon' ? 'success' :
                  artwork.rarity === 'rare' ? 'primary' :
                  artwork.rarity === 'epic' ? 'secondary' :
                  artwork.rarity === 'legendary' ? 'warning' : 'default'
                }
                sx={{ mb: 2 }}
              />
            )}
            
            {/* Creator Actions */}
            {isCreator && !isEditing && (
              <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 2 }}>
                <Button 
                  startIcon={<EditIcon />} 
                  variant="outlined" 
                  size="small" 
                  onClick={handleStartEditing}
                >
                  Edit
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
              </Box>
            )}
            
            <Divider sx={{ my: 2 }} />
            
            {/* Series */}
            {artwork.series && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Series
                </Typography>
                <Typography variant="body1">
                  {artwork.series}
                </Typography>
              </Box>
            )}
            
            {/* Medium & Year */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Details
              </Typography>
              <Typography variant="body1">
                {[
                  artwork.medium,
                  artwork.year && `${artwork.year}`
                ].filter(Boolean).join(', ')}
              </Typography>
            </Box>
            
            {/* Description */}
            {artwork.description && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Description
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {artwork.description}
                </Typography>
              </Box>
            )}
            
            <Divider sx={{ my: 2 }} />
            
            {/* Metadata */}
            <Box sx={{ mt: 'auto' }}>
              <Typography variant="caption" component="p" color="text.secondary">
                Artifact ID: {artwork.artwork_id}
              </Typography>
              <Typography variant="caption" component="p" color="text.secondary">
                Created: {new Date(artwork.created_at).toLocaleDateString()}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Edit Form Dialog */}
      {isEditing && (
        <Paper elevation={3} sx={{ mt: 4, p: 3 }}>
          <Typography variant="h5" component="h2" gutterBottom>
            Edit Artwork
          </Typography>
          
          {editError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {editError}
            </Alert>
          )}
          
          {editSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Artwork updated successfully!
            </Alert>
          )}
          
          <form onSubmit={handleSubmitEdit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="title"
                  label="Title"
                  value={editFormData.title}
                  onChange={handleEditFormChange}
                  fullWidth
                  required
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="artist_name"
                  label="Artist Name"
                  value={editFormData.artist_name}
                  onChange={handleEditFormChange}
                  fullWidth
                  required
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="medium"
                  label="Medium"
                  value={editFormData.medium}
                  onChange={handleEditFormChange}
                  fullWidth
                  required
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="year"
                  label="Year"
                  type="number"
                  value={editFormData.year}
                  onChange={handleEditFormChange}
                  fullWidth
                  margin="normal"
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="series"
                  label="Series (Optional)"
                  value={editFormData.series}
                  onChange={handleEditFormChange}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="rarity-select-label">Rarity</InputLabel>
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
              </Grid>
              <Grid item xs={12}>
                <TextField
                  name="description"
                  label="Description (Optional)"
                  value={editFormData.description}
                  onChange={handleEditFormChange}
                  fullWidth
                  multiline
                  rows={4}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
                  <Button type="button" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="contained" color="primary">
                    Save Changes
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Paper>
      )}
      
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
    </Container>
  );
}

export default ArtworkDetailsPage;