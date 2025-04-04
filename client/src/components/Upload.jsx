import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Input from '@mui/material/Input'; // For the hidden file input
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

// Assuming useAuth provides the token and potentially user role/info
import { useAuth } from '../hooks/useAuth';

// Define allowed image types for frontend validation (optional but good UX)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE_MB = 10; // Example: 10 MB limit

function Upload() {
    // --- Authentication Hook ---
    // Assuming useAuth provides the token. It might also provide user info
    // which could be used to check if the user *is* an artist on the frontend,
    // though the backend @artist_required decorator is the ultimate authority.
    const { token } = useAuth();

    // --- Form State ---
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState(''); // Consider pre-filling if artist info available from useAuth
    const [year, setYear] = useState('');
    const [medium, setMedium] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewSource, setPreviewSource] = useState('');

    // --- Process State ---
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [isSubmittingMeta, setIsSubmittingMeta] = useState(false);
    const [error, setError] = useState(null); // Stores error object { type: string, message: string, details?: any }
    const [successMessage, setSuccessMessage] = useState('');

    // --- File Handling ---
    const handleFileChange = useCallback((event) => {
        setError(null); // Clear previous errors on new file selection
        setSuccessMessage('');
        const file = event.target.files?.[0];

        if (!file) {
            setSelectedFile(null);
            setPreviewSource('');
            return;
        }

        // Frontend Validation (Optional but improves UX)
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            setError({ type: 'validation', message: `Invalid file type. Please select a PNG, JPG, GIF, or WEBP image.` });
            setSelectedFile(null);
            setPreviewSource('');
            event.target.value = null; // Clear the input field visually
            return;
        }

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setError({ type: 'validation', message: `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.` });
            setSelectedFile(null);
            setPreviewSource('');
            event.target.value = null; // Clear the input field visually
            return;
        }

        // If valid, set state and preview
        setSelectedFile(file);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            setPreviewSource(reader.result);
        };
    }, []); // No dependencies needed if only using event

    // --- Form Reset ---
    const clearForm = useCallback(() => {
        setTitle('');
        setArtist('');
        setYear('');
        setMedium('');
        setSelectedFile(null);
        setPreviewSource('');
        // Also clear the file input visually if possible (might need a ref)
        const fileInput = document.getElementById('artwork-file-input');
        if (fileInput) fileInput.value = null;
    }, []);

    // --- Form Submission ---
    const handleSubmit = useCallback(async (event) => {
        event.preventDefault();
        setError(null); // Clear previous errors on new submission attempt
        setSuccessMessage('');

        // --- Pre-submission Checks ---
        // 1. Authentication Check (CRITICAL FIX)
        if (!token) {
            setError({ type: 'auth', message: "Authentication error: You must be logged in to upload." });
            console.error("Upload attempt failed: No auth token found.");
            return; // Stop execution
        }

        // 2. Frontend Form Validation
        let validationErrors = {};
        if (!selectedFile) validationErrors.file = "Please select an image file.";
        if (!title.trim()) validationErrors.title = "Please enter a title.";
        // Consider if 'artist' should be pre-filled or validated against user info
        if (!artist.trim()) validationErrors.artist = "Please enter the artist name.";
        if (!year.trim() || !/^\d{1,4}$/.test(year.trim())) validationErrors.year = "Please enter a valid year (up to 4 digits).";
        if (!medium.trim()) validationErrors.medium = "Please enter the medium.";

        if (Object.keys(validationErrors).length > 0) {
            setError({
                type: 'validation',
                message: "Please correct the highlighted fields.",
                details: validationErrors
            });
            return;
        }

        // --- Step 1: Upload Image File ---
        setIsUploadingFile(true);
        const imageFormData = new FormData();
        imageFormData.append('image', selectedFile); // Key 'image' must match Flask backend

        let imageUrl = '';
        let thumbnailUrl = '';

        try {
            const uploadResponse = await fetch('/api/upload-image', {
                method: 'POST',
                headers: {
                    // Token is confirmed to exist here
                    'Authorization': `Bearer ${token}`,
                    // 'Content-Type' is set automatically by browser for FormData
                },
                body: imageFormData,
            });

            const uploadData = await uploadResponse.json(); // Attempt to parse JSON regardless of status

            if (!uploadResponse.ok) {
                // Handle specific HTTP errors from backend
                let errorMessage = `File upload failed (Status: ${uploadResponse.status})`;
                if (uploadResponse.status === 401) {
                    errorMessage = "Authentication failed. Please log in again.";
                } else if (uploadResponse.status === 403) {
                    errorMessage = "Permission denied. You may not have the required 'artist' role.";
                } else if (uploadData.error?.message) {
                    // Use backend error message if available
                    errorMessage = uploadData.error.message;
                }
                 // Throw an error to be caught below
                throw new Error(errorMessage);
            }

            // Check if expected URLs are present in successful response
            if (!uploadData.imageUrl) {
                throw new Error("File uploaded, but server did not return the expected image URL.");
            }

            imageUrl = uploadData.imageUrl;
            thumbnailUrl = uploadData.thumbnailUrl || uploadData.imageUrl; // Use original if no thumbnail

        } catch (err) {
            console.error("File upload error:", err);
            setError({ type: 'file_upload', message: `File Upload Failed: ${err.message}` });
            setIsUploadingFile(false); // Ensure loading state is reset
            return; // Stop processing if file upload fails
        } finally {
             // Ensure loading state is always reset even if URL check fails above
             // This line might run slightly after the setError above in the catch block
            setIsUploadingFile(false);
        }


        // --- Step 2: Submit Artwork Metadata ---
        setIsSubmittingMeta(true);
        const artworkMetadata = {
            title: title.trim(),
            artist: artist.trim(), // Consider sending artist_id if available/required by backend
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl,
            year: parseInt(year.trim(), 10), // Send as number if backend expects int
            medium: medium.trim(),
            // Add any other fields expected by your POST /api/artworks endpoint
            // description: description,
            // is_available: true, // Default or from form state
            // edition_size: 1, // Default or from form state
        };

        try {
            const metaResponse = await fetch('/api/artworks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, // Need auth here too
                },
                body: JSON.stringify(artworkMetadata),
            });

            const metaResult = await metaResponse.json(); // Attempt to parse JSON

            if (!metaResponse.ok) {
                 // Handle specific HTTP errors
                let errorMessage = `Metadata submission failed (Status: ${metaResponse.status})`;
                if (metaResponse.status === 400 && metaResult.error?.details) {
                    // Specific validation errors from backend
                    setError({ type: 'validation', message: metaResult.error.message || "Validation failed", details: metaResult.error.details });
                    // Do not throw, let the function end after setting error
                    return;
                } else if (metaResponse.status === 401) {
                    errorMessage = "Authentication failed. Please log in again.";
                } else if (metaResponse.status === 403) {
                    errorMessage = "Permission denied for creating artwork.";
                } else if (metaResult.error?.message) {
                    errorMessage = metaResult.error.message;
                }
                 // Throw generic error if not handled above
                throw new Error(errorMessage);
            }

            // Success case for metadata submission
            setSuccessMessage(`Artwork "${metaResult.title || artworkMetadata.title}" created successfully!`);
            clearForm(); // Reset form on success

        } catch (err) {
            console.error("Metadata submission error:", err);
             // Avoid overwriting specific validation errors set above
            if (error?.type !== 'validation') {
                setError(prevError => ({
                    // Preserve previous file upload error message if it exists? Debatable UX.
                    // type: prevError?.type === 'file_upload' ? prevError.type : 'metadata_submit',
                    // message: `${prevError?.message ? prevError.message + ' | ' : ''}Metadata Submission Failed: ${err.message}`,
                    type: 'metadata_submit',
                    message: `Metadata Submission Failed: ${err.message}`,
                }));
            }
        } finally {
            setIsSubmittingMeta(false); // Reset metadata submitting state
        }

    }, [token, selectedFile, title, artist, year, medium, clearForm, error]); // Include all dependencies used in the function


    // Helper to get specific field error for display
    const getFieldError = (fieldName) => {
        return error?.type === 'validation' && error.details?.[fieldName];
    };

    const isProcessing = isUploadingFile || isSubmittingMeta;

    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                p: { xs: 1, sm: 2 }, // Responsive padding
                border: '1px solid',
                borderColor: 'grey.300',
                borderRadius: 1,
                maxWidth: '600px', // Limit width for better layout
                mx: 'auto', // Center the form
            }}
            noValidate // Disable native browser validation, rely on React state
        >
             <Typography variant="h5" component="h2" sx={{ textAlign: 'center', mb: 1 }}>
                Upload New Artwork
            </Typography>

            {/* File Input Section */}
            <Box sx={{ border: '1px dashed grey', p: 2, textAlign: 'center', borderRadius: 1 }}>
                <label htmlFor="artwork-file-input">
                    <Input
                        accept={ALLOWED_MIME_TYPES.join(',')} // Set accepted types
                        id="artwork-file-input"
                        type="file"
                        onChange={handleFileChange}
                        sx={{ display: 'none' }}
                        disabled={isProcessing}
                    />
                    <Button
                        variant="outlined"
                        component="span" // Makes the button trigger the hidden input
                        startIcon={<CloudUploadIcon />}
                        disabled={isProcessing}
                    >
                        {selectedFile ? `Selected: ${selectedFile.name}` : 'Choose Artwork Image'}
                    </Button>
                </label>
                {/* Display File Validation Error Specifically */}
                 {getFieldError('file') && (
                    <Typography color="error" variant="caption" display="block" mt={1}>
                        {getFieldError('file')}
                    </Typography>
                )}
                {/* Display Preview */}
                {previewSource && (
                    <Box mt={2}>
                        <Typography variant="caption" display="block">Preview:</Typography>
                        <img
                            src={previewSource}
                            alt="Preview"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '150px', // Set max height for consistent preview size
                                height: 'auto',
                                objectFit: 'contain',
                                marginTop: '8px',
                                border: '1px solid #eee' // Optional border for preview
                            }} />
                    </Box>
                )}
            </Box>

            {/* Text Inputs */}
            <TextField
                label="Artwork Title"
                variant="outlined"
                required // HTML5 required (though validation is primarily state-driven)
                fullWidth
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isProcessing}
                error={!!getFieldError('title')}
                helperText={getFieldError('title') || ' '} // Add space to prevent layout shifts
            />

            <TextField
                label="Artist Name"
                variant="outlined"
                required
                fullWidth
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                disabled={isProcessing}
                error={!!getFieldError('artist')}
                helperText={getFieldError('artist') || ' '}
                // Consider making this read-only if artist is known from auth
            />

            <TextField
                label="Year"
                variant="outlined"
                required
                fullWidth
                type="number" // Use number type but validate format in JS
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={isProcessing}
                error={!!getFieldError('year')}
                helperText={getFieldError('year') || ' '}
                inputProps={{ maxLength: 4 }} // Limit input length visually
            />

            <TextField
                label="Medium"
                variant="outlined"
                required
                fullWidth
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                disabled={isProcessing}
                error={!!getFieldError('medium')}
                helperText={getFieldError('medium') || ' '}
            />

             {/* General Error Alert (for non-field specific errors) */}
             {error && error.type !== 'validation' && (
                <Alert severity="error" sx={{ mt: 1 }}>
                    {error.message || "An unexpected error occurred."}
                </Alert>
            )}
            {/* Overall Validation Error Message */}
             {error && error.type === 'validation' && !error.details?.file && ( // Show general msg if error isn't just file
                 <Alert severity="warning" sx={{ mt: 1 }}>
                    {error.message || "Please check the fields for errors."}
                </Alert>
             )}


            {/* Success Message */}
            {successMessage && (
                <Alert severity="success" sx={{ mt: 1 }}>
                    {successMessage}
                </Alert>
            )}

            {/* Submit Button & Loading Indicator */}
            <Box sx={{ position: 'relative', mt: 2, textAlign: 'center' }}>
                <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={isProcessing || !selectedFile} // Disable if no file selected or processing
                    size="large"
                    sx={{ minWidth: '180px' }} // Give button some width
                >
                    {isUploadingFile ? 'Uploading...' : isSubmittingMeta ? 'Saving...' : 'Upload Artwork'}
                </Button>
                {isProcessing && (
                    <CircularProgress
                        size={24}
                        sx={{
                            color: 'primary.main', // Match button color or use theme color
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            marginTop: '-12px', // Center horizontally
                            marginLeft: '-12px', // Center vertically
                        }}
                    />
                )}
            </Box>


        </Box>
    );
}

export default Upload;