import React, { useState, useCallback } from 'react';
import { Formik, Form /* Removed Field, ErrorMessage as direct imports - using MUI components */ } from 'formik';
import * as Yup from 'yup';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Input from '@mui/material/Input';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';

import apiService from '../services/apiService';
import { ARTWORK_RARITIES, RARITY_VALUES, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_MB } from '../constants/artwork';

// --- Yup Validation Schema ---
const UploadSchema = Yup.object().shape({
    title: Yup.string()
        .trim()
        .max(200, 'Title cannot be longer than 200 characters')
        .required('Title is required'),
    // Keeping 'artist' as the field name for Formik state/validation
    artist: Yup.string()
        .trim()
        .max(100, 'Artist name cannot be longer than 100 characters')
        .required('Artist name is required'),
    year: Yup.number()
        .typeError('Year must be a valid number')
        .integer('Year must be a whole number')
        .min(0, 'Year cannot be negative')
        .max(new Date().getFullYear() + 1, `Year seems too far in the future`) // Allow current year + 1
        .nullable() // Allows empty string or non-number initially, typeError handles invalid numbers
        .transform((value, originalValue) => // Transform empty string to null for validation
            String(originalValue).trim() === "" ? null : value
        ),
    medium: Yup.string()
        .trim()
        .max(100, 'Medium cannot be longer than 100 characters')
        .required('Medium is required'),
    rarity: Yup.string()
        .oneOf(RARITY_VALUES, 'Invalid rarity selected')
        .required('Rarity selection is required'),
    // File validation is handled outside Yup schema in this setup
});

function Upload() {
    // State for file, processing steps, and non-validation errors
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewSource, setPreviewSource] = useState('');
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [isSubmittingMeta, setIsSubmittingMeta] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [fileValidationError, setFileValidationError] = useState('');

    // --- File Handling ---
    const handleFileChange = useCallback((event) => {
        setFileValidationError('');
        setSubmitError(null);
        setSuccessMessage('');
        const file = event.target.files?.[0];
        const fileInput = event.target; // Keep reference to clear later if invalid

        if (!file) {
            setSelectedFile(null);
            setPreviewSource('');
            return;
        }
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            setFileValidationError(`Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.map(t => t.split('/')[1]).join(', ')}`);
            setSelectedFile(null); setPreviewSource(''); if (fileInput) fileInput.value = null; // Clear input
            return;
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setFileValidationError(`File is too large. Max size: ${MAX_FILE_SIZE_MB} MB.`);
            setSelectedFile(null); setPreviewSource(''); if (fileInput) fileInput.value = null; // Clear input
            return;
        }
        setSelectedFile(file);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => setPreviewSource(reader.result);
    }, []);

    // --- Form Submission (Formik onSubmit) ---
    const handleFormikSubmit = async (values, { setSubmitting, resetForm }) => {
        setSubmitError(null);
        setSuccessMessage('');
        setFileValidationError('');

        if (!selectedFile) {
            setFileValidationError("Please select an image file.");
            setSubmitting(false);
            return;
        }

        setIsUploadingFile(true);
        setSubmitting(true); // Indicate overall process starts
        const imageFormData = new FormData();
        imageFormData.append('image', selectedFile);

        let imageUrl = '';
        let thumbnailUrl = '';

        try {
            // Step 1: Upload Image
            const uploadResponse = await apiService.post('/upload-image', imageFormData);
            imageUrl = uploadResponse.data.imageUrl; // Adjust key if needed
            thumbnailUrl = uploadResponse.data.thumbnailUrl || imageUrl; // Adjust key if needed
            if (!imageUrl) throw new Error("Server response missing 'imageUrl'.");
            setIsUploadingFile(false); // Image upload part done

            // Step 2: Submit Metadata
            setIsSubmittingMeta(true);
            const artworkMetadata = {
                title: values.title.trim(),
                artist_name: values.artist.trim(), // Map Formik 'artist' to 'artist_name' for backend
                image_url: imageUrl,
                thumbnail_url: thumbnailUrl,
                // Ensure year is integer or null
                year: values.year ? parseInt(values.year, 10) : null,
                medium: values.medium.trim(),
                rarity: values.rarity, // Directly from Formik state
            };

            const metaResponse = await apiService.post('/artworks', artworkMetadata);
            setSuccessMessage(`Artwork "${metaResponse.data.title || artworkMetadata.title}" created!`);

            // Clear form completely on final success
            resetForm();
            setSelectedFile(null);
            setPreviewSource('');
            const fileInput = document.getElementById('artwork-file-input');
            if (fileInput) fileInput.value = null;

        } catch (err) {
            console.error("Upload process error:", err);
            // Determine if error was during file upload or metadata submit for better message
            const stage = isUploadingFile ? 'File Upload' : 'Metadata Submission';
            let errorMessage = `${stage} Failed: ${err.response?.data?.message || err.message || 'Unknown error'}`;
            if (err.response?.status === 400 && err.response?.data?.error?.details) {
                const details = Object.entries(err.response.data.error.details)
                    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                    .join('; ');
                errorMessage = `${stage} Validation Failed: ${err.response.data.error.message || "Check details"}: ${details}`;
            }
            setSubmitError(errorMessage);
        } finally {
            // Ensure all loading states are reset regardless of success/failure
            setIsUploadingFile(false);
            setIsSubmittingMeta(false);
            setSubmitting(false); // Tell Formik the overall submission process is finished
        }
    };

    const isProcessing = isUploadingFile || isSubmittingMeta; // Combine for overall processing state

    return (
        <Formik
            initialValues={{
                title: '',
                artist: '',
                year: '',
                medium: '',
                rarity: '', // Initialize rarity as empty string
            }}
            validationSchema={UploadSchema}
            onSubmit={handleFormikSubmit}
            validateOnMount={false} // Optional: disable initial validation
            validateOnChange={true} // Validate fields as they change
            validateOnBlur={true}  // Validate fields when they lose focus
        >
            {/* Get helpers from Formik render prop */}
            {({ errors, touched, values, handleChange, handleBlur, isSubmitting }) => (
                <Form noValidate>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: { xs: 1, sm: 2 }, border: '1px solid', borderColor: 'grey.300', borderRadius: 1, maxWidth: '600px', mx: 'auto' }}>

                        {/* File Input Section - Largely unchanged, uses its own state */}
                        <Box sx={{ border: '1px dashed grey', p: 2, textAlign: 'center', borderRadius: 1 }}>
                            <label htmlFor="artwork-file-input">
                                <Input
                                    accept={ALLOWED_MIME_TYPES.join(',')} id="artwork-file-input" type="file"
                                    onChange={handleFileChange} sx={{ display: 'none' }} disabled={isSubmitting} // Disable if Formik is submitting
                                />
                                <Button variant="outlined" component="span" startIcon={<CloudUploadIcon />} disabled={isSubmitting} >
                                    {selectedFile ? `Selected: ${selectedFile.name}` : 'Choose Artwork Image *'}
                                </Button>
                            </label>
                            {fileValidationError && <Typography color="error" variant="caption" display="block" mt={1}>{fileValidationError}</Typography>}
                            {previewSource && ( <Box mt={2}> {/* Preview */} </Box> )}
                        </Box>

                        {/* Text & Select Inputs using MUI + Formik helpers */}
                        <TextField
                            label="Artwork Title" variant="outlined" required fullWidth
                            name="title"
                            value={values.title}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.title && Boolean(errors.title)}
                            helperText={touched.title ? errors.title : ' '}
                            disabled={isSubmitting} // Use Formik's isSubmitting
                        />

                        <TextField
                            label="Artist Name" variant="outlined" required fullWidth
                            name="artist"
                            value={values.artist}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.artist && Boolean(errors.artist)}
                            helperText={touched.artist ? errors.artist : ' '}
                            disabled={isSubmitting}
                        />

                        <TextField
                            label="Year" variant="outlined" fullWidth
                            name="year"
                            type="number"
                            value={values.year}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.year && Boolean(errors.year)}
                            helperText={touched.year ? errors.year : ' '}
                            disabled={isSubmitting}
                            InputProps={{ inputProps: { min: 0, step: 1 } }}
                        />

                         <TextField
                            label="Medium" variant="outlined" required fullWidth
                            name="medium"
                            value={values.medium}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.medium && Boolean(errors.medium)}
                            helperText={touched.medium ? errors.medium : ' '}
                            disabled={isSubmitting}
                        />

                        {/* Rarity Dropdown using MUI FormControl/Select */}
                        <FormControl fullWidth required error={touched.rarity && Boolean(errors.rarity)} disabled={isSubmitting}>
                            <InputLabel id="rarity-select-label">Rarity</InputLabel>
                            <Select
                                labelId="rarity-select-label"
                                id="rarity"
                                name="rarity" // Connects to Formik
                                value={values.rarity} // Controlled by Formik
                                label="Rarity" // Required for label positioning
                                onChange={handleChange} // Formik handles the change
                                onBlur={handleBlur} // Formik handles blur
                            >
                                <MenuItem value="" disabled>
                                  <em>Select Rarity...</em>
                                </MenuItem>
                                {ARTWORK_RARITIES.map((rarityOpt) => (
                                    <MenuItem key={rarityOpt.value} value={rarityOpt.value}>
                                        {rarityOpt.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {/* Display validation error */}
                            <FormHelperText>{touched.rarity ? errors.rarity : ' '}</FormHelperText>
                        </FormControl>

                        {/* API Error Alert */}
                        {submitError && ( <Alert severity="error" sx={{ mt: 1 }}>{submitError}</Alert> )}
                        {/* Success Alert */}
                        {successMessage && ( <Alert severity="success" sx={{ mt: 1 }}>{successMessage}</Alert> )}

                        {/* Submit Button & Loading Indicator */}
                         <Box sx={{ position: 'relative', mt: 2, textAlign: 'center' }}>
                            <Button
                                type="submit" variant="contained" color="primary"
                                // Disable if Formik is submitting OR if file not selected
                                disabled={isSubmitting || !selectedFile}
                                size="large" sx={{ minWidth: '180px' }}
                            >
                                {/* Show granular status if available, else Formik's generic state */}
                                {isUploadingFile ? 'Uploading Image...' : isSubmittingMeta ? 'Saving Artwork...' : isSubmitting ? 'Processing...' : 'Upload Artwork'}
                            </Button>
                            {/* Show spinner whenever Formik isSubmitting */}
                            {isSubmitting && <CircularProgress size={24} sx={{ color: 'primary.main', position: 'absolute', top: '50%', left: '50%', marginTop: '-12px', marginLeft: '-12px', }} />}
                         </Box>
                    </Box>
                </Form>
            )}
        </Formik>
    );
}

export default Upload;