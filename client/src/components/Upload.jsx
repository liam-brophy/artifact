import React, { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Input from '@mui/material/Input';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

// --- Placeholder: Replace with your actual auth hook/token retrieval ---
import { useAuth } from '../hooks/useAuth';

function Upload() {
    const { token } = useAuth();

    // Form State
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [year, setYear] = useState('');
    const [medium, setMedium] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewSource, setPreviewSource] = useState('');

    // Process State
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [isSubmittingMeta, setIsSubmittingMeta] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = () => {
                setPreviewSource(reader.result);
            };
            setError(null);
            setSuccessMessage('');
        } else {
            setSelectedFile(null);
            setPreviewSource('');
        }
    };

    const clearForm = () => {
        setTitle('');
        setArtist('');
        setYear('');
        setMedium('');
        setSelectedFile(null);
        setPreviewSource('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError(null);
        setSuccessMessage('');

        if (!selectedFile) {
            setError({ message: "Please select an image file to upload." });
            return;
        }
        if (!title.trim()) {
            setError({ message: "Please enter a title for the artwork." });
            return;
        }
        if (!artist.trim()) {
            setError({ message: "Please enter the artist name for the artwork." });
            return;
        }
        if (!year.trim()) {
            setError({ message: "Please enter the year of the artwork." });
            return;
        }
        if (!medium.trim()) {
            setError({ message: "Please enter the medium of the artwork." });
            return;
        }

        // Step 1: Upload the image file
        setIsUploadingFile(true);
        const formData = new FormData();
        formData.append('image', selectedFile);

        let imageUrl = '';
        let thumbnailUrl = '';

        try {
            const uploadResponse = await fetch('/api/upload-image', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            const uploadData = await uploadResponse.json();

            if (!uploadResponse.ok) {
                throw new Error(uploadData.error?.message || `File upload failed with status ${uploadResponse.status}`);
            }

            imageUrl = uploadData.imageUrl;
            thumbnailUrl = uploadData.thumbnailUrl || imageUrl;
            setIsUploadingFile(false);

        } catch (err) {
            console.error("File upload error:", err);
            setError({ type: 'file_upload', message: `File Upload Failed: ${err.message}` });
            setIsUploadingFile(false);
            return;
        }

        // Step 2: Submit artwork metadata (including image info, title, artist, year, medium)
        setIsSubmittingMeta(true);

        const artworkData = {
            title: title.trim(),
            artist: artist.trim(),
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl,
            year: year.trim(),
            medium: medium.trim(),
        };

        try {
            const metaResponse = await fetch('/api/artworks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(artworkData),
            });

            const metaResult = await metaResponse.json();

            if (!metaResponse.ok) {
                if (metaResponse.status === 400 && metaResult.error?.details) {
                    setError({ type: 'validation', message: metaResult.error.message, details: metaResult.error.details });
                } else {
                    throw new Error(metaResult.error?.message || `Metadata submission failed with status ${metaResponse.status}`);
                }
            } else {
                setSuccessMessage(`Artwork "${metaResult.title}" created successfully! (ID: ${metaResult.artwork_id})`);
                clearForm();
            }

        } catch (err) {
            console.error("Metadata submission error:", err);
            setError(prevError => ({
                ...prevError,
                type: prevError?.type === 'file_upload' ? prevError.type : 'metadata_submit',
                message: `${prevError?.message ? prevError.message + ' | ' : ''}Metadata Submission Failed: ${err.message}`,
                details: err.details || prevError?.details
            }));
        } finally {
            setIsSubmittingMeta(false);
        }
    };

    // Helper to display validation errors (if needed for more granular feedback)
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
                p: 2,
                border: '1px solid',
                borderColor: 'grey.300',
                borderRadius: 1,
            }}
            noValidate
        >
            {/* File Input */}
            <Box sx={{ border: '1px dashed grey', p: 2, textAlign: 'center' }}>
                <label htmlFor="artwork-file-input">
                    <Input
                        accept="image/*"
                        id="artwork-file-input"
                        type="file"
                        onChange={handleFileChange}
                        sx={{ display: 'none' }}
                        disabled={isProcessing}
                    />
                    <Button
                        variant="outlined"
                        component="span"
                        startIcon={<CloudUploadIcon />}
                        disabled={isProcessing}
                    >
                        {selectedFile ? `Selected: ${selectedFile.name}` : 'Choose Artwork Image'}
                    </Button>
                </label>
                {previewSource && (
                    <Box mt={2}>
                        <Typography variant="caption">Preview:</Typography>
                        <img src={previewSource} alt="Preview" style={{ maxWidth: '100%', height: '150px', objectFit: 'contain', marginTop: '8px' }} />
                    </Box>
                )}
            </Box>

            {/* Title */}
            <TextField
                label="Artwork Title"
                variant="outlined"
                required
                fullWidth
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isProcessing}
                error={!!getFieldError('title')}
                helperText={getFieldError('title')}
            />

            {/* Artist Name */}
            <TextField
                label="Artist Name"
                variant="outlined"
                required
                fullWidth
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                disabled={isProcessing}
                error={!!getFieldError('artist')}
                helperText={getFieldError('artist')}
            />

            {/* Year */}
            <TextField
                label="Year"
                variant="outlined"
                required
                fullWidth
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={isProcessing}
                error={!!getFieldError('year')}
                helperText={getFieldError('year')}
            />

            {/* Medium */}
            <TextField
                label="Medium"
                variant="outlined"
                required
                fullWidth
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                disabled={isProcessing}
                error={!!getFieldError('medium')}
                helperText={getFieldError('medium')}
            />

            {/* Submit Button & Loading Indicator */}
            <Box sx={{ position: 'relative', mt: 2, textAlign: 'center' }}>
                <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={isProcessing || !selectedFile}
                    size="large"
                >
                    {isUploadingFile ? 'Uploading Image...' : isSubmittingMeta ? 'Saving Artwork...' : 'Upload Artwork'}
                </Button>
                {isProcessing && (
                    <CircularProgress
                        size={24}
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            marginTop: '-12px',
                            marginLeft: '-12px',
                        }}
                    />
                )}
            </Box>

            {/* Error Message */}
            {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    <Typography variant="body2">{error.message || "An unexpected error occurred."}</Typography>
                    {error.type === 'validation' && error.details && (
                        <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                            {Object.entries(error.details).map(([key, value]) => (
                                <li key={key}><Typography variant="caption">{`${key}: ${value}`}</Typography></li>
                            ))}
                        </ul>
                    )}
                </Alert>
            )}

            {/* Success Message */}
            {successMessage && (
                <Alert severity="success" sx={{ mt: 2 }}>
                    {successMessage}
                </Alert>
            )}
        </Box>
    );
}

export default Upload;