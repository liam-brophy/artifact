import React, { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Input from '@mui/material/Input'; // For the file input
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload'; // Optional icon

// --- Placeholder: Replace with your actual auth hook/token retrieval ---
import { useAuth } from '../hooks/useAuth';
// -----------------------------------------------------

function Upload() {
    const { token } = useAuth(); // Get JWT token for API calls

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [editionSize, setEditionSize] = useState('1'); // Store as string initially
    const [isAvailable, setIsAvailable] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewSource, setPreviewSource] = useState(''); // For image preview

    // Process State
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [isSubmittingMeta, setIsSubmittingMeta] = useState(false);
    const [error, setError] = useState(null); // Can store string or object
    const [successMessage, setSuccessMessage] = useState('');

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            // Create preview URL
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = () => {
                setPreviewSource(reader.result);
            };
            setError(null); // Clear file-related errors
            setSuccessMessage('');
        } else {
            setSelectedFile(null);
            setPreviewSource('');
        }
    };

    const clearForm = () => {
        setTitle('');
        setDescription('');
        setEditionSize('1');
        setIsAvailable(true);
        setSelectedFile(null);
        setPreviewSource('');
        // Keep error/success messages until next action? Or clear them too?
        // setError(null);
        // setSuccessMessage('');
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

        // --- Step 1: Upload the image file ---
        setIsUploadingFile(true);
        const formData = new FormData();
        formData.append('image', selectedFile); // 'image' is the field name expected by the upload endpoint

        let imageUrl = '';
        let thumbnailUrl = ''; // Assume thumbnail might also be returned

        try {
            // --- Placeholder: Replace with your actual file upload endpoint ---
            const uploadResponse = await fetch('/api/upload-image', { // <<-- YOUR FILE UPLOAD ENDPOINT
                method: 'POST',
                headers: {
                    // No 'Content-Type': 'multipart/form-data' header needed,
                    // browser sets it automatically with boundary for FormData
                    'Authorization': `Bearer ${token}`, // Send token if upload endpoint requires auth
                },
                body: formData,
            });
            // --------------------------------------------------------------

            const uploadData = await uploadResponse.json();

            if (!uploadResponse.ok) {
                throw new Error(uploadData.error?.message || `File upload failed with status ${uploadResponse.status}`);
            }

            imageUrl = uploadData.imageUrl; // Adjust based on actual response structure
            thumbnailUrl = uploadData.thumbnailUrl || imageUrl; // Use main image URL if no specific thumbnail URL

            setIsUploadingFile(false);

        } catch (err) {
            console.error("File upload error:", err);
            setError({ type: 'file_upload', message: `File Upload Failed: ${err.message}` });
            setIsUploadingFile(false);
            return; // Stop if file upload fails
        }

        // --- Step 2: Submit artwork metadata (including URLs) ---
        setIsSubmittingMeta(true);

        const artworkData = {
            title: title.trim(),
            description: description.trim() || null, // Send null if empty, backend expects optional
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl, // Send the obtained thumbnail URL
            edition_size: editionSize, // Send as string, backend converts/validates
            is_available: isAvailable,
        };

        try {
            const metaResponse = await fetch('/api/artworks', { // Your backend route
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, // Crucial for @jwt_required()
                },
                body: JSON.stringify(artworkData),
            });

            const metaResult = await metaResponse.json();

            if (!metaResponse.ok) {
                // Handle backend validation errors specifically if possible
                if (metaResponse.status === 400 && metaResult.error?.details) {
                     setError({ type: 'validation', message: metaResult.error.message, details: metaResult.error.details });
                } else {
                    throw new Error(metaResult.error?.message || `Metadata submission failed with status ${metaResponse.status}`);
                }
            } else {
                // Success!
                setSuccessMessage(`Artwork "${metaResult.title}" created successfully! (ID: ${metaResult.artwork_id})`);
                clearForm(); // Clear form on success
            }

        } catch (err) {
            console.error("Metadata submission error:", err);
             setError(prevError => ({
                // Keep file upload error if it existed, otherwise set metadata error
                ...prevError,
                type: prevError?.type === 'file_upload' ? prevError.type : 'metadata_submit',
                message: `${prevError?.message ? prevError.message + ' | ' : ''}Metadata Submission Failed: ${err.message}`,
                details: err.details || prevError?.details // Preserve validation details if available
            }));
        } finally {
            setIsSubmittingMeta(false);
        }
    };

    // Helper to display validation errors
    const getFieldError = (fieldName) => {
        return error?.type === 'validation' && error.details?.[fieldName];
    }

    const isProcessing = isUploadingFile || isSubmittingMeta;

    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2, // Spacing between elements
                p: 2, // Padding inside the box
                border: '1px solid',
                borderColor: 'grey.300',
                borderRadius: 1,
            }}
            noValidate // Disable browser validation, rely on backend/custom FE validation
        >
            {/* File Input */}
             <Box sx={{ border: '1px dashed grey', p: 2, textAlign: 'center' }}>
                 <label htmlFor="artwork-file-input">
                    <Input
                        accept="image/*" // Accept common image types
                        id="artwork-file-input"
                        type="file"
                        onChange={handleFileChange}
                        sx={{ display: 'none' }} // Hide default input, use button/area
                        disabled={isProcessing}
                    />
                    <Button
                        variant="outlined"
                        component="span" // Makes button act as label trigger
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

            {/* Description */}
            <TextField
                label="Description (Optional)"
                variant="outlined"
                fullWidth
                multiline
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isProcessing}
                inputProps={{ maxLength: 2000 }} // Match backend validation
                error={!!getFieldError('description')}
                helperText={getFieldError('description') || `${description.length}/2000 chars`}
            />

             {/* Edition Size */}
            <TextField
                label="Edition Size"
                variant="outlined"
                type="number" // Use number type for better input, but handle as string for flexibility
                required
                fullWidth
                value={editionSize}
                onChange={(e) => setEditionSize(e.target.value)} // Keep as string, validate on submit/backend
                disabled={isProcessing}
                inputProps={{ min: 1 }} // Suggest minimum, rely on backend validation
                error={!!getFieldError('edition_size')}
                helperText={getFieldError('edition_size') || "Total number of prints in this edition (e.g., 1, 10, 50)"}
            />

            {/* Availability */}
            <FormControlLabel
                control={
                    <Checkbox
                        checked={isAvailable}
                        onChange={(e) => setIsAvailable(e.target.checked)}
                        disabled={isProcessing}
                    />
                }
                label="Is this artwork available for purchase?"
                sx={{ color: getFieldError('is_available') ? 'error.main' : 'inherit' }}
             />
             {getFieldError('is_available') && (
                  <Typography color="error" variant="caption">{getFieldError('is_available')}</Typography>
             )}


            {/* Submit Button & Loading Indicator */}
            <Box sx={{ position: 'relative', mt: 2, textAlign: 'center' }}>
                <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={isProcessing || !selectedFile} // Disable if processing or no file selected
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
                    {/* Optionally display detailed validation errors */}
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