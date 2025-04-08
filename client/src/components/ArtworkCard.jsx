import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { Link } from 'react-router-dom'; // Import Link for navigation

// Placeholder image if artwork image is missing or fails to load
const PLACEHOLDER_IMAGE_URL = 'https://via.placeholder.com/300x200.png?text=Artwork';

function ArtworkCard({ artwork }) {
    // Basic check if artwork data is provided
    if (!artwork) {
        return null; // Or render a placeholder card/error
    }

    // Destructure needed properties (ensure these keys match your backend response/model)
    const {
        artwork_id,
        title,
        image_url,
        thumbnail_url, // Use thumbnail if available for list views, fallback to image_url
        artist, // Assuming backend sends nested artist object { user_id, username }
        year,
        medium
    } = artwork;

    // Determine the best image URL to use (prefer thumbnail for cards)
    const displayImageUrl = thumbnail_url || image_url || PLACEHOLDER_IMAGE_URL;

    // Handle potential image loading errors
    const handleImageError = (event) => {
        event.target.onerror = null; // Prevent infinite loop if placeholder also fails
        event.target.src = PLACEHOLDER_IMAGE_URL;
        console.warn(`Failed to load image: ${displayImageUrl}`);
    };

    return (
        // Link the entire card to the artwork detail page (adjust path later)
        // Remove the Link wrapper if you only want specific elements clickable
        <Link to={`/artworks/${artwork_id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
            <Card sx={{
                height: '100%', // Ensure card takes full height of grid item
                display: 'flex',
                flexDirection: 'column',
                transition: 'box-shadow 0.3s ease-in-out, transform 0.2s ease-in-out', // Add transition
                '&:hover': {
                    boxShadow: 6, // Enhance shadow on hover (theme-aware shadow)
                    transform: 'translateY(-4px)', // Slight lift effect
                }
            }}>
                <CardMedia
                    component="img"
                    // Control aspect ratio or height for consistency
                    sx={{
                        aspectRatio: '4/3', // Example aspect ratio
                        objectFit: 'contain', // Or 'cover' depending on desired effect
                        backgroundColor: '#f0f0f0' // Background while loading or if image fails
                    }}
                    image={displayImageUrl}
                    alt={title || 'Artwork'}
                    onError={handleImageError} // Handle image load errors
                />
                <CardContent sx={{ flexGrow: 1 }}> {/* Allow content to grow */}
                    <Typography gutterBottom variant="h6" component="div" noWrap title={title}>
                        {/* Display title, use noWrap and title attribute for long titles */}
                        {title || 'Untitled'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {/* Link to artist profile if artist data is available */}
                        {artist ? (
                            <Link
                                to={`/users/${artist.username}`} // Adjust path if needed
                                onClick={(e) => e.stopPropagation()} // Prevent card link navigation when clicking artist link
                                style={{ color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                            >
                                {artist.username || 'Unknown Artist'}
                            </Link>
                        ) : (
                            'Unknown Artist'
                        )}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                         <Typography variant="caption" color="text.secondary">
                            {medium || 'Unknown Medium'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {year || ''}
                        </Typography>
                    </Box>
                </CardContent>
                {/* Optional: CardActions for buttons like 'Add to Cart', 'Like', etc. */}
                {/* <CardActions>
                    <Button size="small">View Details</Button>
                </CardActions> */}
            </Card>
        </Link>
    );
}

export default ArtworkCard;