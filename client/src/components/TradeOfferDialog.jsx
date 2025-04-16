import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';
import toast from 'react-hot-toast';

// MUI Components
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Alert from '@mui/material/Alert';

// Icons
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

const TradeOfferDialog = ({ 
  open, 
  onClose, 
  recipientId, 
  recipientUsername 
}) => {
  const navigate = useNavigate();
  
  // State for selected artworks
  const [offeredArtworkId, setOfferedArtworkId] = useState(null);
  const [requestedArtworkId, setRequestedArtworkId] = useState(null);
  
  // State for artwork selection tabs
  const [selectionTab, setSelectionTab] = useState(0); // 0 = your art, 1 = their art
  
  // State for loading artwork collections
  const [myArtworks, setMyArtworks] = useState([]);
  const [theirArtworks, setTheirArtworks] = useState([]);
  const [isLoadingMyArtworks, setIsLoadingMyArtworks] = useState(false);
  const [isLoadingTheirArtworks, setIsLoadingTheirArtworks] = useState(false);
  
  // Trade message
  const [message, setMessage] = useState('');
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch my collected artworks
  const fetchMyArtworks = async () => {
    setIsLoadingMyArtworks(true);
    try {
      const response = await apiService.get('/api/users/me/collected-artworks');
      setMyArtworks(response.data.collectedArtworks?.map(item => item.artwork) || []);
    } catch (err) {
      console.error("Failed to fetch my artworks:", err);
      toast.error("Could not load your collection");
    } finally {
      setIsLoadingMyArtworks(false);
    }
  };
  
  // Fetch their collected artworks
  const fetchTheirArtworks = async () => {
    setIsLoadingTheirArtworks(true);
    try {
      const response = await apiService.get(`/api/users/${recipientId}/collected-artworks`);
      setTheirArtworks(response.data.collectedArtworks?.map(item => item.artwork) || []);
    } catch (err) {
      console.error(`Failed to fetch ${recipientUsername}'s artworks:`, err);
      toast.error(`Could not load ${recipientUsername}'s collection`);
    } finally {
      setIsLoadingTheirArtworks(false);
    }
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setSelectionTab(newValue);
  };
  
  // Create a trade offer
  const handleCreateTrade = async () => {
    if (!offeredArtworkId) {
      toast.error("Please select an artwork to offer");
      return;
    }
    
    if (!requestedArtworkId) {
      toast.error("Please select an artwork to request");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await apiService.post('/api/trades', {
        recipient_id: recipientId,
        offered_artwork_id: offeredArtworkId,
        requested_artwork_id: requestedArtworkId,
        message: message.trim() || undefined // Only send if not empty
      });
      
      toast.success("Trade offer sent successfully!");
      onClose(); // Close the dialog
      
      // Optionally navigate to the trades tab on your profile
      navigate('/profile');
    } catch (err) {
      console.error("Failed to create trade:", err);
      toast.error(err.response?.data?.error || "Failed to create trade offer");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setOfferedArtworkId(null);
      setRequestedArtworkId(null);
      setMessage('');
      setSelectionTab(0);
      fetchMyArtworks();
      fetchTheirArtworks();
    }
  }, [open, recipientId]);
  
  return (
    <Dialog 
      open={open} 
      onClose={() => !isSubmitting && onClose()}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Propose a Trade with {recipientUsername}
      </DialogTitle>
      
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Select one of your artworks to offer and one from {recipientUsername}'s collection that you want.
        </DialogContentText>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs 
            value={selectionTab} 
            onChange={handleTabChange}
            variant="fullWidth"
          >
            <Tab label="Your Collection" />
            <Tab label={`${recipientUsername}'s Collection`} />
          </Tabs>
        </Box>
        
        {/* Your Collection Tab */}
        {selectionTab === 0 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Select an artwork to offer:
            </Typography>
            
            {isLoadingMyArtworks && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            )}
            
            {!isLoadingMyArtworks && myArtworks.length === 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                You don't have any artworks in your collection to offer.
              </Alert>
            )}
            
            <Grid container spacing={2}>
              {myArtworks.map(artwork => (
                <Grid item xs={12} sm={6} md={4} key={artwork.artwork_id}>
                  <Card 
                    sx={{ 
                      border: offeredArtworkId === artwork.artwork_id ? '2px solid #2196f3' : 'none',
                      height: '100%'
                    }}
                  >
                    <CardActionArea 
                      onClick={() => setOfferedArtworkId(artwork.artwork_id)}
                      sx={{ height: '100%' }}
                    >
                      <CardMedia
                        component="img"
                        height="140"
                        image={artwork.image_url}
                        alt={artwork.title}
                      />
                      <CardContent>
                        <Typography gutterBottom variant="h6" component="div">
                          {artwork.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {artwork.rarity}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
        
        {/* Their Collection Tab */}
        {selectionTab === 1 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Select an artwork you want:
            </Typography>
            
            {isLoadingTheirArtworks && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            )}
            
            {!isLoadingTheirArtworks && theirArtworks.length === 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {recipientUsername} doesn't have any artworks in their collection.
              </Alert>
            )}
            
            <Grid container spacing={2}>
              {theirArtworks.map(artwork => (
                <Grid item xs={12} sm={6} md={4} key={artwork.artwork_id}>
                  <Card 
                    sx={{ 
                      border: requestedArtworkId === artwork.artwork_id ? '2px solid #2196f3' : 'none',
                      height: '100%'
                    }}
                  >
                    <CardActionArea 
                      onClick={() => setRequestedArtworkId(artwork.artwork_id)}
                      sx={{ height: '100%' }}
                    >
                      <CardMedia
                        component="img"
                        height="140"
                        image={artwork.image_url}
                        alt={artwork.title}
                      />
                      <CardContent>
                        <Typography gutterBottom variant="h6" component="div">
                          {artwork.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {artwork.rarity}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
        
        {/* Trade Summary */}
        {(offeredArtworkId || requestedArtworkId) && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Trade Summary
            </Typography>
            
            <Grid container spacing={2}>
              {offeredArtworkId && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                    <Typography variant="subtitle2">
                      You're offering:
                    </Typography>
                    <Typography variant="body1">
                      {myArtworks.find(a => a.artwork_id === offeredArtworkId)?.title || 'Loading...'}
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              {requestedArtworkId && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1, bgcolor: '#fff8e1', borderRadius: 1 }}>
                    <Typography variant="subtitle2">
                      You're requesting:
                    </Typography>
                    <Typography variant="body1">
                      {theirArtworks.find(a => a.artwork_id === requestedArtworkId)?.title || 'Loading...'}
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>
        )}
        
        {/* Message Field */}
        <TextField
          margin="normal"
          fullWidth
          label="Add a message (optional)"
          multiline
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isSubmitting}
        />
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={onClose} 
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button 
          variant="contained"
          color="primary"
          onClick={handleCreateTrade}
          disabled={!offeredArtworkId || !requestedArtworkId || isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={20} /> : <SwapHorizIcon />}
        >
          {isSubmitting ? 'Sending...' : 'Propose Trade'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TradeOfferDialog;