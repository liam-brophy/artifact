import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import ColorPickerField from './ColorPickerField';

const ColorPickerDialog = ({ open, onClose }) => {
  const { user, updateUser } = useAuth();
  const { isDarkMode } = useTheme();
  const [selectedColor, setSelectedColor] = useState(user?.favorite_color || '#F50801');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // When the user object changes, update the selected color
  useEffect(() => {
    if (user?.favorite_color) {
      setSelectedColor(user.favorite_color);
    }
  }, [user]);

  const handleColorChange = (e) => {
    setSelectedColor(e.target.value);
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

  return (
    <Dialog open={open} onClose={() => !isSubmitting && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Choose Your Accent Color</DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Select your favorite color to personalize your experience.
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <ColorPickerField
            name="favorite_color"
            label="Select Color"
            value={selectedColor}
            onChange={handleColorChange}
          />
        </Box>
        
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