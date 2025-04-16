import React, { useState } from 'react';
import './ArtworkCard.css'; // Import the CSS
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast'; // Import toast for feedback
import { useAuth } from '../context/AuthContext';
import TradeOfferDialog from './TradeOfferDialog';

// MUI Components
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// Icons
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

// Placeholder image if artwork image is missing or fails to load
const PLACEHOLDER_IMAGE_URL = 'https://via.placeholder.com/300x200.png?text=Artwork';

// Helper to format artist details (optional)
const formatArtistDetails = (artist) => {
  if (!artist) return '';
  const details = [];
  if (artist.nationality) details.push(artist.nationality);
  if (artist.birthYear) details.push(`b. ${artist.birthYear}`);
  // Add death year if available:
  // if (artist.deathYear) details[details.length - 1] += ` - ${artist.deathYear}`;
  return details.join(', ');
};

// Helper to format edition (optional)
const formatEdition = (artwork) => {
    if (!artwork?.edition_number || !artwork?.edition_total) return '';
    // Use artist_name if available, otherwise use username initials
    const artistName = artwork.artist_name || artwork.artist?.username || '';
    const initials = artistName.split(' ').map(n => n[0]).join('') || '??';
    return `${initials}: ${artwork.edition_number}/${artwork.edition_total}`;
};

function ArtworkCard({ 
    artwork, 
    isBlurred = false, 
    blurContext = 'collection', 
    isOwnArtwork = false,
    ownerId,
    ownerUsername
}) {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [tradeDialogOpen, setTradeDialogOpen] = useState(false);

    // Basic check if artwork data exists
    if (!artwork) {
        return <div className="artwork-card-container">Loading...</div>;
    }

    const artistDetailsString = formatArtistDetails(artwork.artist);
    const editionString = formatEdition(artwork);

    // Determine the best image URL to use (prefer thumbnail for cards)
    const displayImageUrl = artwork.thumbnail_url || artwork.image_url || PLACEHOLDER_IMAGE_URL;

    // Handle potential image loading errors
    const handleImageError = (event) => {
        event.target.onerror = null; // Prevent infinite loop if placeholder also fails
        event.target.src = PLACEHOLDER_IMAGE_URL;
        console.warn(`Failed to load image: ${displayImageUrl}`);
    };
    
    // Handle click on the card (navigate to artwork detail)
    const handleCardClick = () => {
        // If the card is blurred, show a toast message instead of navigating
        if (isBlurred) {
            if (blurContext === 'collection') {
                toast.error("Follow this user to view their collection", {
                    duration: 3000,
                    position: "bottom-center"
                });
            } else {
                toast.error("You have not collected this work yet", {
                    duration: 3000,
                    position: "bottom-center"
                });
            }
            return;
        }
        
        // Only navigate if the card is not blurred
        navigate(`/artworks/${artwork.artwork_id}`);
    };
    
    // Handle artist click (navigate to artist profile)
    const handleArtistClick = (e) => {
        e.stopPropagation(); // Prevent card click from triggering
        if (artwork.artist && artwork.artist.username) {
            navigate(`/users/${artwork.artist.username}`);
        }
    };

    // Placeholder description - replace with real data when available
    const placeholderDescription = "Placeholder description for the artwork. This will be replaced with real data when available.";
    
    // Use artist_name if available, otherwise fallback to username
    const displayArtistName = artwork.artist_name || artwork.artist?.username || 'Unknown Artist';

    return (
        <div 
            className={`artwork-card-container ${isBlurred ? 'artwork-card-blurred' : ''}`} 
            onClick={handleCardClick}
            data-rarity={artwork.rarity || "common"}
        >
            {/* Trade button (only shown when viewing someone else's artwork) */}
            {isAuthenticated && !isOwnArtwork && !isBlurred && ownerId && ownerUsername && (
                <Tooltip title="Propose Trade" placement="top">
                    <IconButton 
                        className="artwork-card-trade-button"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent card click
                            setTradeDialogOpen(true);
                        }}
                        size="small"
                        sx={{ 
                            position: 'absolute', 
                            top: '8px', 
                            right: '8px', 
                            zIndex: 10,
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            }
                        }}
                    >
                        <SwapHorizIcon />
                    </IconButton>
                </Tooltip>
            )}

            <div className="artwork-card-inner">
                {/* --- Front Face --- */}
                <div className="artwork-card-front">
                    <div className="artwork-card-front__image-container">
                        {displayImageUrl ? (
                            <>
                                <img
                                    src={displayImageUrl}
                                    alt={artwork.title || 'Artwork'}
                                    className="artwork-card-front__image"
                                    onError={handleImageError}
                                />
                                {/* Show SVG border if one is selected */}
                                {artwork.border_decal_id && (
                                    <object
                                        data={`${import.meta.env.BASE_URL}svg/borders/${artwork.border_decal_id}.svg`}
                                        type="image/svg+xml"
                                        className="artwork-card-front__border"
                                        aria-label="Border"
                                    >
                                        {/* Fallback to img if object fails */}
                                        <img
                                            src={`${import.meta.env.BASE_URL}svg/borders/${artwork.border_decal_id}.svg`}
                                            alt="Border"
                                            className="artwork-card-front__border"
                                        />
                                    </object>
                                )}
                            </>
                        ) : (
                            <div className="artwork-card-front__image-placeholder">No Image</div>
                        )}
                        {/* Overlay with frosted glass effect */}
                        <div className="artwork-card-front__overlay">
                            <h2 className="artwork-card-front__title">{artwork.title || 'Untitled'}</h2>
                            <p 
                                className="artwork-card-front__artist" 
                                onClick={handleArtistClick}
                            >
                                {displayArtistName}
                            </p>
                        </div>
                    </div>
                </div>

                {/* --- Back Face --- */}
                <div className="artwork-card-back">
                    {/* Add blurred background image */}
                    <div 
                        className="artwork-card-back__bg-image" 
                        style={{backgroundImage: `url(${displayImageUrl})`}}
                    ></div>
                    <div className="artwork-card-back__content">
                        <div className="artwork-card-back__artist-info">
                            <h2 className="artwork-card-back__title">
                                {artwork.title || 'Untitled'}
                            </h2>
                            <h3 
                                className="artwork-card-back__artist-name" 
                                onClick={handleArtistClick}
                            >
                                {displayArtistName}
                            </h3>
                            {artistDetailsString && (
                                <p className="artwork-card-back__artist-details">{artistDetailsString}</p>
                            )}
                            
                            {/* Display Series if available */}
                            {artwork.series && (
                                <p className="artwork-card-back__series">Series: {artwork.series}</p>
                            )}
                            
                            {/* Display Medium/Year if available */}
                            <p className="artwork-card-back__artwork-details">
                                {artwork.year && <span>{artwork.year}</span>}
                                {artwork.year && artwork.medium && <span> | </span>}
                                {artwork.medium && <span>{artwork.medium}</span>}
                            </p>
                        </div>

                        {/* Use real description when available */}
                        <div className="artwork-card-back__description">
                            {artwork.description || placeholderDescription}
                        </div>

                        <div className="artwork-card-back__meta-info">
                            {/* Use artwork_id */}
                            <span className="artwork-card-back__artifact-id">
                                Artifact #{artwork.artwork_id || 'N/A'}
                            </span>
                            {/* Use formatted edition string */}
                            <span className="artwork-card-back__edition">
                                {editionString || 'Unique'} {/* Or handle open editions etc. */}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        
            {/* Trade Offer Dialog */}
            {!isOwnArtwork && ownerId && ownerUsername && (
                <TradeOfferDialog
                    open={tradeDialogOpen}
                    onClose={() => setTradeDialogOpen(false)}
                    recipientId={ownerId}
                    recipientUsername={ownerUsername}
                />
            )}
        </div>
    );
}

export default ArtworkCard;