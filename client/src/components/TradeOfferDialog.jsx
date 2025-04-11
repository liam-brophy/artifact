import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import toast from 'react-hot-toast';

// MUI Components
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import Pagination from '@mui/material/Pagination';

// Icons
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

/**
 * Dialog component for creating trade offers
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {Function} props.onClose - Function to call when closing the dialog
 * @param {Object} props.requestedArtwork - The artwork being requested in the trade
 * @param {number} props.recipientId - The ID of the recipient user (owner of requestedArtwork)
 */
function TradeOfferDialog({ open, onClose, requestedArtwork, recipientId }) {
    const { user } = useAuth();
    
    // State for user's collection to offer in trade
    const [userCollection, setUserCollection] = useState([]);
    const [isLoadingCollection, setIsLoadingCollection] = useState(false);
    const [selectedArtwork, setSelectedArtwork] = useState(null);
    const [tradeMessage, setTradeMessage] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({
        totalPages: 1,
        currentPage: 1,
        totalItems: 0
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Fetch user's collection when dialog opens
    useEffect(() => {
        if (!open || !user?.user_id) return;
        
        const fetchUserCollection = async () => {
            setIsLoadingCollection(true);
            setError(null);
            
            try {
                const response = await apiService.get(`/users/${user.user_id}/collected-artworks`, {
                    params: { page }
                });
                
                const artworks = response.data.collectedArtworks?.map(item => item.artwork).filter(art => art != null) || [];
                setUserCollection(artworks);
                
                if (response.data.pagination) {
                    setPagination(response.data.pagination);
                }
            } catch (err) {
                console.error("Failed to fetch user's collection:", err);
                setError("Failed to load your collection. Please try again.");
            } finally {
                setIsLoadingCollection(false);
            }
        };
        
        fetchUserCollection();
    }, [open, user?.user_id, page]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setSelectedArtwork(null);
            setTradeMessage('');
            setPage(1);
            setError(null);
        }
    }, [open]);

    // Handle selecting an artwork to offer
    const handleSelectArtwork = (artwork) => {
        setSelectedArtwork(artwork === selectedArtwork ? null : artwork);
    };

    // Handle page change
    const handlePageChange = (event, value) => {
        setPage(value);
    };

    // Handle trade message change
    const handleMessageChange = (e) => {
        setTradeMessage(e.target.value);
    };

    // Handle submitting the trade offer
    const handleSubmitTrade = async () => {
        if (!selectedArtwork || !requestedArtwork || !recipientId) {
            setError("Please select an artwork to offer.");
            return;
        }
        
        setIsSubmitting(true);
        setError(null);
        
        try {
            const tradeData = {
                recipient_id: recipientId,
                offered_artwork_id: selectedArtwork.artwork_id,
                requested_artwork_id: requestedArtwork.artwork_id,
                message: tradeMessage.trim() || undefined // Only include if not empty
            };
            
            await apiService.post('/trades', tradeData);
            
            toast.success("Trade offer sent successfully!");
            onClose(true); // Close with refresh flag
        } catch (err) {
            console.error("Failed to create trade:", err);
            setError(err.response?.data?.error || "Failed to create trade offer. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter out the requested artwork if it's in the user's collection
    const filteredCollection = userCollection.filter(
        artwork => artwork.artwork_id !== requestedArtwork?.artwork_id
    );

    return (
        <Dialog 
            open={open} 
            onClose={() => !isSubmitting && onClose()} 
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                <Box display="flex" alignItems="center">
                    <SwapHorizIcon sx={{ mr: 1 }} />
                    Create Trade Offer
                </Box>
            </DialogTitle>
            
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
                
                <DialogContentText sx={{ mb: 3 }}>
                    Select an artwork from your collection to offer in exchange for <strong>{requestedArtwork?.title}</strong>.
                </DialogContentText>
                
                <Grid container spacing={3}>
                    {/* Requested Artwork */}
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6" gutterBottom align="center">
                            You Want
                        </Typography>
                        
                        <Card 
                            sx={{ 
                                maxWidth: 345, 
                                margin: '0 auto',
                                border: '2px solid',
                                borderColor: 'secondary.main'
                            }}
                        >
                            <CardMedia
                                component="img"
                                height="200"
                                image={requestedArtwork?.image_url}
                                alt={requestedArtwork?.title}
                                sx={{ objectFit: 'contain' }}
                            />
                            <CardContent>
                                <Typography gutterBottom variant="h6" component="div">
                                    {requestedArtwork?.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Rarity: {requestedArtwork?.rarity}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Artist: {requestedArtwork?.artist_name || requestedArtwork?.user?.username}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    {/* Your Offer */}
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6" gutterBottom align="center">
                            {selectedArtwork ? 'Your Offer' : 'Select Your Offer'}
                        </Typography>
                        
                        {selectedArtwork && (
                            <Card 
                                sx={{ 
                                    maxWidth: 345, 
                                    margin: '0 auto',
                                    border: '2px solid',
                                    borderColor: 'primary.main'
                                }}
                            >
                                <CardMedia
                                    component="img"
                                    height="200"
                                    image={selectedArtwork?.image_url}
                                    alt={selectedArtwork?.title}
                                    sx={{ objectFit: 'contain' }}
                                />
                                <CardContent>
                                    <Typography gutterBottom variant="h6" component="div">
                                        {selectedArtwork?.title}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Rarity: {selectedArtwork?.rarity}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Artist: {selectedArtwork?.artist_name || selectedArtwork?.user?.username}
                                    </Typography>
                                </CardContent>
                            </Card>
                        )}
                    </Grid>
                </Grid>
                
                {/* Your Collection */}
                <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
                    Your Collection
                </Typography>
                
                {isLoadingCollection ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                ) : filteredCollection.length === 0 ? (
                    <Alert severity="info">
                        You don't have any artworks to trade or your collection is empty.
                    </Alert>
                ) : (
                    <>
                        <Grid container spacing={2}>
                            {filteredCollection.map(artwork => (
                                <Grid item xs={6} sm={4} md={3} key={artwork.artwork_id}>
                                    <Card 
                                        sx={{ 
                                            cursor: 'pointer',
                                            border: selectedArtwork?.artwork_id === artwork.artwork_id 
                                                ? '2px solid' 
                                                : '1px solid',
                                            borderColor: selectedArtwork?.artwork_id === artwork.artwork_id 
                                                ? 'primary.main' 
                                                : 'grey.300',
                                            '&:hover': {
                                                boxShadow: 3
                                            }
                                        }}
                                        onClick={() => handleSelectArtwork(artwork)}
                                    >
                                        <CardMedia
                                            component="img"
                                            height="120"
                                            image={artwork.image_url}
                                            alt={artwork.title}
                                            sx={{ objectFit: 'contain' }}
                                        />
                                        <CardContent>
                                            <Typography variant="body2" noWrap>
                                                {artwork.title}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {artwork.rarity}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                        
                        {pagination.totalPages > 1 && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                                <Pagination 
                                    count={pagination.totalPages}
                                    page={page}
                                    onChange={handlePageChange}
                                    color="primary"
                                />
                            </Box>
                        )}
                    </>
                )}
                
                {/* Trade Message */}
                <TextField
                    margin="normal"
                    fullWidth
                    id="tradeMessage"
                    label="Message (optional)"
                    placeholder="Add a message to the recipient..."
                    multiline
                    rows={2}
                    value={tradeMessage}
                    onChange={handleMessageChange}
                    disabled={isSubmitting}
                />
            </DialogContent>
            
            <DialogActions>
                <Button 
                    onClick={() => onClose()} 
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button 
                    onClick={handleSubmitTrade} 
                    variant="contained" 
                    color="primary"
                    startIcon={isSubmitting ? <CircularProgress size={20} /> : <SwapHorizIcon />}
                    disabled={!selectedArtwork || isSubmitting}
                >
                    {isSubmitting ? 'Sending Offer...' : 'Send Trade Offer'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default TradeOfferDialog;