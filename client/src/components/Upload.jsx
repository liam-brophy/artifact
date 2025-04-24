import React, { useState, useCallback } from 'react';
import { Formik, Form } from 'formik';
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
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import apiService from '../services/apiService';
import { ARTWORK_RARITIES, RARITY_VALUES, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_MB } from '../constants/artwork';
import ArtStudio from './ArtStudio';

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
    description: Yup.string()
        .trim()
        .max(2000, 'Description cannot be longer than 2000 characters'),
    series: Yup.string()
        .trim()
        .max(100, 'Series name cannot be longer than 100 characters'),
    // File validation is handled outside Yup schema in this setup
});

const steps = ['Upload Image', 'Enter Details', 'Select Border'];

function Upload() {
    // State for file, processing steps, and non-validation errors
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewSource, setPreviewSource] = useState('');
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [isSubmittingMeta, setIsSubmittingMeta] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [fileValidationError, setFileValidationError] = useState('');
    
    // State for managing the upload flow steps
    const [activeStep, setActiveStep] = useState(0);
    const [uploadedArtwork, setUploadedArtwork] = useState(null);
    const [selectedBorder, setSelectedBorder] = useState(null);
    const [formValues, setFormValues] = useState(null);

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

    // Handle step navigation
    const handleNext = () => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    const handleReset = () => {
        setActiveStep(0);
        setSelectedFile(null);
        setPreviewSource('');
        setUploadedArtwork(null);
        setSelectedBorder(null);
        setFormValues(null);
        setSuccessMessage('');
        setSubmitError(null);
        setFileValidationError('');
        const fileInput = document.getElementById('artwork-file-input');
        if (fileInput) fileInput.value = null;
    };

    // Handle image upload (Step 1)
    const handleUploadImage = async () => {
        if (!selectedFile) {
            setFileValidationError("Please select an image file.");
            return;
        }

        try {
            setIsUploadingFile(true);
            setSubmitError(null);

            // Upload the image file
            const imageFormData = new FormData();
            imageFormData.append('image', selectedFile);

            const uploadResponse = await apiService.post('/upload-image', imageFormData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            // console.log('Upload response:', uploadResponse.data);
            
            // Store the image URLs for later use
            const imageData = {
                image_url: uploadResponse.data.imageUrl,
                thumbnail_url: uploadResponse.data.thumbnailUrl || uploadResponse.data.imageUrl
            };
            
            // Move to the next step
            setPreviewSource(uploadResponse.data.imageUrl);
            setFormValues({ ...formValues, ...imageData });
            handleNext();
        } catch (err) {
            console.error("Image upload error:", err);
            setSubmitError(`File Upload Failed: ${err.response?.data?.message || err.message || 'Unknown error'}`);
        } finally {
            setIsUploadingFile(false);
        }
    };

    // Handle metadata submission (Step 2)
    const handleFormikSubmit = async (values, { setSubmitting }) => {
        setSubmitError(null);
        setSuccessMessage('');

        try {
            setIsSubmittingMeta(true);
            setSubmitting(true);

            // Combine form values with image data
            const updatedValues = {
                ...values,
                ...formValues // This contains the image_url and thumbnail_url
            };
            setFormValues(updatedValues);

            // Create temporary artwork object for ArtStudio preview
            const tempArtwork = {
                title: values.title.trim(),
                artist_name: values.artist.trim(),
                image_url: formValues.image_url,
                thumbnail_url: formValues.thumbnail_url,
                year: values.year ? parseInt(values.year, 10) : null,
                medium: values.medium.trim(),
                rarity: values.rarity,
                description: values.description?.trim() || '',
                series: values.series?.trim() || '',
                border_decal_id: null // Initially no border
            };

            setUploadedArtwork(tempArtwork);
            handleNext(); // Move to border selection step
        } catch (err) {
            console.error("Form submission error:", err);
            setSubmitError(`Form Submission Failed: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSubmittingMeta(false);
            setSubmitting(false);
        }
    };

    // Handle border selection and final artwork submission (Step 3)
    const handleBorderSave = async (borderId) => {
        try {
            setSubmitError(null);
            setSuccessMessage('');
            setSelectedBorder(borderId);

            // Prepare the final artwork data with all details including border
            const artworkMetadata = {
                title: formValues.title.trim(),
                artist_name: formValues.artist.trim(),
                image_url: formValues.image_url,
                thumbnail_url: formValues.thumbnail_url,
                year: formValues.year ? parseInt(formValues.year, 10) : null,
                medium: formValues.medium.trim(),
                rarity: formValues.rarity,
                description: formValues.description?.trim() || '',
                series: formValues.series?.trim() || '',
                border_decal_id: borderId
            };

            // Submit the final artwork to the server
            const response = await apiService.post('/artworks', artworkMetadata);
            
            // Update UI with success
            setSuccessMessage(`Artwork "${response.data.title}" created successfully!`);
            
            // After a short delay, reset the form for a new upload
            setTimeout(() => {
                handleReset();
            }, 3000);

            return true;
        } catch (err) {
            console.error("Final submission error:", err);
            setSubmitError(`Artwork Creation Failed: ${err.response?.data?.message || err.message || 'Unknown error'}`);
            return false;
        }
    };

    // Render the appropriate step content
    const getStepContent = (step) => {
        switch (step) {
            case 0: // Image Upload Step
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: { xs: 1, sm: 2 }, border: '1px solid', borderColor: 'grey.300', borderRadius: 1, maxWidth: '600px', mx: 'auto' }}>
                        <Typography variant="h6" gutterBottom>
                            Upload Your Artwork Image
                        </Typography>
                        
                        <Box sx={{ border: '1px dashed grey', p: 2, textAlign: 'center', borderRadius: 1 }}>
                            <label htmlFor="artwork-file-input">
                                <Input
                                    accept={ALLOWED_MIME_TYPES.join(',')} id="artwork-file-input" type="file"
                                    onChange={handleFileChange} sx={{ display: 'none' }} disabled={isUploadingFile}
                                />
                                <Button variant="outlined" component="span" startIcon={<CloudUploadIcon />} disabled={isUploadingFile}>
                                    {selectedFile ? `Selected: ${selectedFile.name}` : 'Choose Artwork Image *'}
                                </Button>
                            </label>
                            {fileValidationError && <Typography color="error" variant="caption" display="block" mt={1}>{fileValidationError}</Typography>}
                            
                            {previewSource && (
                                <Box mt={2} sx={{ maxWidth: '100%', maxHeight: '300px', overflow: 'hidden' }}>
                                    <img 
                                        src={previewSource} 
                                        alt="Preview" 
                                        style={{ width: '100%', height: 'auto', objectFit: 'contain' }} 
                                    />
                                </Box>
                            )}
                        </Box>
                        
                        {submitError && <Alert severity="error" sx={{ mt: 1 }}>{submitError}</Alert>}
                        
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleUploadImage}
                                disabled={!selectedFile || isUploadingFile}
                                endIcon={<ArrowForwardIcon />}
                            >
                                {isUploadingFile ? 'Uploading...' : 'Continue to Details'}
                            </Button>
                        </Box>
                    </Box>
                );
                
            case 1: // Metadata Form Step
                return (
                    <Formik
                        initialValues={{
                            title: '',
                            artist: '',
                            year: '',
                            medium: '',
                            rarity: '',
                            description: '',
                            series: '',
                        }}
                        validationSchema={UploadSchema}
                        onSubmit={handleFormikSubmit}
                        validateOnMount={false}
                        validateOnChange={true}
                        validateOnBlur={true}
                    >
                        {({ errors, touched, values, handleChange, handleBlur, isSubmitting, isValid }) => (
                            <Form noValidate>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: { xs: 1, sm: 2 }, border: '1px solid', borderColor: 'grey.300', borderRadius: 1, maxWidth: '600px', mx: 'auto' }}>
                                    <Typography variant="h6" gutterBottom>
                                        Enter Artwork Details
                                    </Typography>
                                    
                                    <TextField
                                        label="Artwork Title" variant="outlined" required fullWidth
                                        name="title"
                                        value={values.title}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        error={touched.title && Boolean(errors.title)}
                                        helperText={touched.title ? errors.title : ' '}
                                        disabled={isSubmitting}
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

                                    <TextField
                                        label="Series (Optional)" variant="outlined" fullWidth
                                        name="series"
                                        value={values.series}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        error={touched.series && Boolean(errors.series)}
                                        helperText={touched.series ? errors.series : ' '}
                                        disabled={isSubmitting}
                                    />
                                    
                                    <TextField
                                        label="Description (Optional)" variant="outlined" fullWidth
                                        name="description"
                                        value={values.description}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        error={touched.description && Boolean(errors.description)}
                                        helperText={touched.description ? errors.description : ' '}
                                        disabled={isSubmitting}
                                        multiline
                                        rows={4}
                                    />

                                    <FormControl fullWidth required error={touched.rarity && Boolean(errors.rarity)} disabled={isSubmitting}>
                                        <InputLabel id="rarity-select-label">Rarity</InputLabel>
                                        <Select
                                            labelId="rarity-select-label"
                                            id="rarity"
                                            name="rarity"
                                            value={values.rarity}
                                            label="Rarity"
                                            onChange={handleChange}
                                            onBlur={handleBlur}
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
                                        <FormHelperText>{touched.rarity ? errors.rarity : ' '}</FormHelperText>
                                    </FormControl>

                                    {submitError && <Alert severity="error" sx={{ mt: 1 }}>{submitError}</Alert>}

                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                                        <Button
                                            variant="outlined"
                                            onClick={handleBack}
                                            startIcon={<ArrowBackIcon />}
                                            disabled={isSubmitting}
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            color="primary"
                                            endIcon={<ArrowForwardIcon />}
                                            disabled={isSubmitting || !isValid}
                                        >
                                            {isSubmitting ? 'Processing...' : 'Continue to Border Selection'}
                                            {isSubmitting && <CircularProgress size={24} sx={{ ml: 1 }} />}
                                        </Button>
                                    </Box>
                                </Box>
                            </Form>
                        )}
                    </Formik>
                );
                
            case 2: // Border Selection Step
                return (
                    <Box sx={{ width: '100%', height: 'calc(100vh - 200px)' }}>
                        {uploadedArtwork && (
                            <ArtStudio 
                                mode="upload"
                                artworkData={uploadedArtwork}
                                onSave={handleBorderSave}
                                onCancel={() => handleBack()}
                            />
                        )}
                        
                        {successMessage && (
                            <Alert severity="success" sx={{ mt: 2, width: '100%' }}>
                                {successMessage}
                            </Alert>
                        )}
                    </Box>
                );
                
            default:
                return 'Unknown step';
        }
    };

    return (
        <Box sx={{ width: '100%', height: '100%' }}>
            <Box sx={{ width: '100%', marginBottom: 4 }}>
                <Stepper activeStep={activeStep} alternativeLabel>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
            </Box>
            
            {getStepContent(activeStep)}
        </Box>
    );
}

export default Upload;