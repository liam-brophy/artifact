import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import FormHelperText from '@mui/material/FormHelperText';

/**
 * A free-form color picker field component for use with Formik
 * 
 * @param {Object} props - The component properties
 * @param {string} props.name - The field name (used by Formik)
 * @param {string} props.label - The label to display
 * @param {Function} props.onChange - Callback when color changes
 * @param {Function} props.onBlur - Callback when field loses focus
 * @param {string} props.value - The current color value
 * @param {string} props.error - Error message to display
 * @param {boolean} props.touched - Whether the field has been touched
 * @param {boolean} props.disabled - Whether the field is disabled
 */
const ColorPickerField = ({ 
  name, 
  label, 
  onChange, 
  onBlur, 
  value, 
  error, 
  touched, 
  disabled 
}) => {
  const [color, setColor] = useState(value || '#F50801');

  // Update internal state when external value changes
  useEffect(() => {
    if (value) {
      setColor(value);
    }
  }, [value]);

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    setColor(newColor);
    
    // Create a simulated event object for Formik
    const simulatedEvent = {
      target: {
        name,
        value: newColor
      }
    };
    
    // Call the onChange handler passed from Formik
    if (onChange) {
      onChange(simulatedEvent);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <label className="form-label" htmlFor={name} style={{ display: 'block', textAlign: 'center', marginBottom: '8px' }}>
        {label}
      </label>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '5px' }}>
        <input
          type="color"
          id={name}
          name={name}
          value={color}
          onChange={handleColorChange}
          onBlur={onBlur}
          disabled={disabled}
          style={{ 
            width: '100%', 
            height: '40px', 
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: 'transparent', /* Make background transparent */
            appearance: 'none', /* Remove default appearance */
            overflow: 'hidden' /* Hide any overflow */
          }}
        />
      </div>
      
      {touched && error && (
        <div className="error-message validation-error" style={{ textAlign: 'center' }}>{error}</div>
      )}
    </div>
  );
};

export default ColorPickerField;