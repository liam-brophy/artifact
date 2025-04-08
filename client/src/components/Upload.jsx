import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Input from '@mui/material/Input'; // For the hidden file input
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import apiService from '../services/apiService';
// useAuth is no longer strictly needed unless you use 'user' elsewhere
// import { useAuth } from '../context/AuthContext';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE_MB = 10;

function Upload({ fields = ['image', 'title', 'artist', 'year', 'medium'] }) { // Added artist back to default fields
    // const { user } = useAuth(); // Remove if not used elsewhere

    // --- Form State ---
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState(''); // <-- Initialize as empty string
    const [year, setYear] = useState('');
    const [medium, setMedium] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewSource, setPreviewSource] = useState('');

    // --- Process State ---
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [isSubmittingMeta, setIsSubmittingMeta] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    // --- File Handling (Validation and Preview) ---
    const handleFileChange = useCallback((event) => {
        // ... (no changes here) ...
        setError(null);
        setSuccessMessage('');
        const file = event.target.files?.[0];

        if (!file) {
            setSelectedFile(null);
            setPreviewSource('');
            return;
        }
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            setError({ type: 'validation', message: `Invalid file type. Please select a PNG, JPG, GIF, or WEBP image.` });
            setSelectedFile(null); setPreviewSource(''); event.target.value = null;
            return;
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setError({ type: 'validation', message: `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.` });
            setSelectedFile(null); setPreviewSource(''); event.target.value = null;
            return;
        }
        setSelectedFile(file);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => setPreviewSource(reader.result);
    }, []);

    // --- Form Reset ---
    const clearForm = useCallback(() => {
        // ... (reset other fields) ...
        setTitle('');
        setArtist(''); // <-- Reset artist to empty string
        setYear('');
        setMedium('');
        setSelectedFile(null);
        setPreviewSource('');
        const fileInput = document.getElementById('artwork-file-input');
        if (fileInput) fileInput.value = null;
    }, []); // Removed 'user' dependency if not used

    // --- Form Submission ---
    const handleSubmit = useCallback(async (event) => {
        // ... (prevent default, clear errors) ...
        event.preventDefault();
        setError(null);
        setSuccessMessage('');

        // --- Frontend Form Validation (includes artist) ---
        let validationErrors = {};
        if (!selectedFile && fields.includes('image')) validationErrors.file = "Please select an image file.";
        if (!title.trim() && fields.includes('title')) validationErrors.title = "Please enter a title.";
        if (!artist.trim() && fields.includes('artist')) validationErrors.artist = "Please enter the artist name."; // Standard validation
        if ((!year.trim() || !/^\d{1,4}$/.test(year.trim())) && fields.includes('year')) validationErrors.year = "Please enter a valid year (up to 4 digits).";
        if (!medium.trim() && fields.includes('medium')) validationErrors.medium = "Please enter the medium.";

        if (Object.keys(validationErrors).length > 0) {
            setError({ type: 'validation', message: "Please correct the highlighted fields.", details: validationErrors });
            return;
        }

        // --- Step 1: Upload Image File ---
        setIsUploadingFile(true);
        const imageFormData = new FormData();
        imageFormData.append('image', selectedFile);

        let imageUrl = '';
        let thumbnailUrl = '';

        try {
            console.log("Attempting image upload...");
            const uploadResponse = await apiService.post('/upload-image', imageFormData);
            console.log("Image upload response:", uploadResponse.data); // Keep this log for confirmation

            // --- FIX THE KEY ACCESS ---
            // Check for the camelCase key 'imageUrl'
            if (!uploadResponse.data.imageUrl) { // <-- CHANGE image_url to imageUrl
                throw new Error("File uploaded, but server response did not contain the expected 'imageUrl' field.");
            }
            // Access the camelCase key 'imageUrl'
            imageUrl = uploadResponse.data.imageUrl; // <-- CHANGE image_url to imageUrl

            // Access the camelCase key 'thumbnailUrl' (or use imageUrl as fallback)
            thumbnailUrl = uploadResponse.data.thumbnailUrl || imageUrl; // <-- CHANGE thumbnail_url to thumbnailUrl

        } catch (err) {
            // ... (error handling for image upload - no changes here) ...
            console.error("File upload error:", err);
            setError({ type: 'file_upload', message: `File Upload Failed: ${err.response?.data?.message || err.message || 'Unknown error'}` });
            setIsUploadingFile(false);
            return;
        } finally {
            setIsUploadingFile(false);
        }

        // --- Step 2: Submit Artwork Metadata ---
        setIsSubmittingMeta(true);
        const artworkMetadata = {
            title: title.trim(),
            artist_name: artist.trim(), // <-- Use the state value entered by user
            image_url: imageUrl,         // <-- KEEP underscore here IF your Artwork MODEL uses image_url
            thumbnail_url: thumbnailUrl, // <-- KEEP underscore here IF your Artwork MODEL uses thumbnail_url
            year: year.trim() ? parseInt(year.trim(), 10) : null,
            medium: medium.trim(),
        };

        try {
            // ... (apiService call for metadata - no changes here) ...
            console.log("Submitting artwork metadata:", artworkMetadata);
            const metaResponse = await apiService.post('/artworks', artworkMetadata);
            console.log("Metadata submission response:", metaResponse.data);
            setSuccessMessage(`Artwork "${metaResponse.data.title || artworkMetadata.title}" created successfully!`);
            clearForm();
        } catch (err) {
            // ... (error handling for metadata - no changes here) ...
            console.error("Metadata submission error:", err);
            if (err.response?.status === 400 && err.response?.data?.error?.details) {
                setError({ type: 'validation', message: err.response.data.error.message || "Validation failed", details: err.response.data.error.details });
            } else {
                setError({ type: 'metadata_submit', message: `Metadata Submission Failed: ${err.response?.data?.message || err.message || 'Unknown error'}` });
            }
        } finally {
            setIsSubmittingMeta(false);
        }

    }, [selectedFile, title, artist, year, medium, clearForm, fields]); // Keep artist in dependencies


    // Helper to get specific field error for display
    const getFieldError = (fieldName) => error?.type === 'validation' && error.details?.[fieldName];

    const isProcessing = isUploadingFile || isSubmittingMeta;

    // --- Render Form ---
    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ /* Styling remains the same */
                display: 'flex', flexDirection: 'column', gap: 2, p: { xs: 1, sm: 2 },
                border: '1px solid', borderColor: 'grey.300', borderRadius: 1,
                maxWidth: '600px', mx: 'auto',
            }}
            noValidate
        >
            {/* File Input Section (remains the same) */}
            {fields.includes('image') && (
                <Box sx={{ border: '1px dashed grey', p: 2, textAlign: 'center', borderRadius: 1 }}>
                    <label htmlFor="artwork-file-input">
                        <Input
                            accept={ALLOWED_MIME_TYPES.join(',')} id="artwork-file-input" type="file"
                            onChange={handleFileChange} sx={{ display: 'none' }} disabled={isProcessing}
                        />
                        <Button variant="outlined" component="span" startIcon={<CloudUploadIcon />} disabled={isProcessing} >
                            {selectedFile ? `Selected: ${selectedFile.name}` : 'Choose Artwork Image'}
                        </Button>
                    </label>
                    {getFieldError('file') && <Typography color="error" variant="caption" display="block" mt={1}>{getFieldError('file')}</Typography>}
                    {previewSource && (
                        <Box mt={2}>
                            <Typography variant="caption" display="block">Preview:</Typography>
                            <img src={previewSource} alt="Preview" style={{ maxHeight: '150px', maxWidth: '100%', height: 'auto', objectFit: 'contain', marginTop: '8px', border: '1px solid #eee' }} />
                        </Box>
                    )}
                </Box>
            )}

            {/* Text Inputs (Render based on fields prop) */}
            {fields.includes('title') && (
                <TextField label="Artwork Title" variant="outlined" required fullWidth value={title} onChange={(e) => setTitle(e.target.value)} disabled={isProcessing} error={!!getFieldError('title')} helperText={getFieldError('title') || ' '} />
            )}
            {fields.includes('artist') && (
                <TextField
                    label="Artist Name"
                    variant="outlined"
                    required
                    fullWidth
                    value={artist} // <-- Bound to empty-initialized state
                    onChange={(e) => setArtist(e.target.value)} // <-- Standard change handler
                    disabled={isProcessing}
                    error={!!getFieldError('artist')}
                    helperText={getFieldError('artist') || ' '}
                    // Removed InputProps readOnly logic
                />
            )}
            {fields.includes('year') && (
                <TextField label="Year" variant="outlined" required fullWidth type="number" value={year} onChange={(e) => setYear(e.target.value)} disabled={isProcessing} error={!!getFieldError('year')} helperText={getFieldError('year') || ' '} inputProps={{ maxLength: 4 }} />
            )}
            {fields.includes('medium') && (
                <TextField label="Medium" variant="outlined" required fullWidth value={medium} onChange={(e) => setMedium(e.target.value)} disabled={isProcessing} error={!!getFieldError('medium')} helperText={getFieldError('medium') || ' '} />
            )}

            {/* Error/Success Alerts (remain the same) */}
            {error && error.type !== 'validation' && ( <Alert severity="error" sx={{ mt: 1 }}>{error.message || "An unexpected error occurred."}</Alert> )}
            {error && error.type === 'validation' && !error.details?.file && ( <Alert severity="warning" sx={{ mt: 1 }}>{error.message || "Please check the fields for errors."}</Alert> )}
            {successMessage && ( <Alert severity="success" sx={{ mt: 1 }}>{successMessage}</Alert> )}

            {/* Submit Button & Loading Indicator (remains the same) */}
            <Box sx={{ position: 'relative', mt: 2, textAlign: 'center' }}>
                <Button type="submit" variant="contained" color="primary" disabled={isProcessing || (fields.includes('image') && !selectedFile)} size="large" sx={{ minWidth: '180px' }} >
                    {isUploadingFile ? 'Uploading...' : isSubmittingMeta ? 'Saving...' : 'Upload Artwork'}
                </Button>
                {isProcessing && <CircularProgress size={24} sx={{ color: 'primary.main', position: 'absolute', top: '50%', left: '50%', marginTop: '-12px', marginLeft: '-12px', }} />}
            </Box>
        </Box>
    );
}

export default Upload;