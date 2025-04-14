import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

// Predefined color options with names
const colorOptions = [
  { name: 'Red', value: '#F50801', light: true },
  { name: 'Blue', value: '#0066FF', light: true },
  { name: 'Green', value: '#1DB954', light: true },
  { name: 'Purple', value: '#9747FF', light: true },
  { name: 'Orange', value: '#FF9500', light: true },
  { name: 'Teal', value: '#3BDBB2', dark: true },
  { name: 'Pink', value: '#FF2D76', light: true },
  { name: 'Yellow', value: '#FFCC00', light: true }
];

const ColorPickerDialog = ({ open, onClose }) => {
  const { user, updateUser } = useAuth();
  const { isDarkMode } = useTheme();
  const [selectedColor, setSelectedColor] = useState(user?.favorite_color || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // When the user object changes, update the selected color
  useEffect(() => {
    if (user?.favorite_color) {
      setSelectedColor(user.favorite_color);
    }
  }, [user]);

  const handleColorSelect = (color) => {
    setSelectedColor(color);
  };

  const handleSave = async () => {
    if (!user || !selectedColor) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await apiService.patch(`/users/${user.user_id}/preferences`, {
        favorite_color: selectedColor
      });
      
      // Update the user in context
      updateUser({ favorite_color: selectedColor });
      
      // Close dialog
      onClose();
    } catch (err) {
      console.error('Failed to update color preference:', err);
      setError('Failed to save your color preference. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Only show appropriate colors for the current theme
  const filteredColors = colorOptions.filter(color => 
    isDarkMode ? (color.dark !== false) : (color.light !== false)
  );

  return (
    <Dialog open={open} onClose={() => !isSubmitting && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Choose Your Accent Color</DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Select your favorite color to personalize your experience.
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {filteredColors.map((color) => (
            <Grid item xs={3} sm={3} key={color.value}>
              <Box
                onClick={() => handleColorSelect(color.value)}
                sx={{
                  cursor: 'pointer',
                  width: '100%',
                  height: 70,
                  backgroundColor: color.value,
                  borderRadius: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  border: selectedColor === color.value ? '3px solid white' : 'none',
                  boxShadow: selectedColor === color.value 
                    ? '0 0 0 3px rgba(0, 0, 0, 0.3)' 
                    : '0 2px 4px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
                  }
                }}
              >
                <Typography variant="body2" sx={{ 
                  color: 'white', 
                  fontWeight: 'bold',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                }}>
                  {color.name}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
        
        {error && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={!selectedColor || isSubmitting}
          variant="contained" 
          color="primary"
        >
          {isSubmitting ? <CircularProgress size={24} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ColorPickerDialog;