import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';
// Import any UI components you might want for displaying results or errors
// import { CircularProgress, Button, Typography, List, ListItem, ListItemText, Box, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'; // MUI Example

function UserPacks() {
  const [packs, setPacks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openedPackResult, setOpenedPackResult] = useState(null); // Holds { message, artworks_received }
  const [isOpening, setIsOpening] = useState(false); // Tracks if a pack open request is in progress


  // useEffect to fetch packs (remains the same)
  useEffect(() => {
    const fetchPacks = async () => {
      setIsLoading(true);
      setError(null);
      setOpenedPackResult(null);
      try {
        const response = await apiService.get('/user-packs');
        if (response.data && Array.isArray(response.data)) {
           setPacks(response.data);
        } else {
           console.error("Unexpected response format:", response.data);
           setPacks([]);
           setError("Received unexpected data format for packs.");
        }
      } catch (err) {
        console.error("Error fetching unopened packs:", err);
        const message = err.response?.data?.error || err.message || "Failed to fetch packs.";
        setError(message);
        setPacks([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPacks();
  }, []);

  // --- IMPLEMENT pack opening function ---
  const handleOpenPack = async (packId) => {
    console.log(`Attempting to open pack with ID: ${packId}`);
    setIsOpening(true);        // Indicate opening process started
    setError(null);           // Clear previous errors
    setOpenedPackResult(null); // Clear previous results

    try {
      // Make the POST request to the backend endpoint
      const response = await apiService.post(`/user-packs/${packId}/open`);

      // Handle successful response (200 OK)
      console.log("Pack opened successfully:", response.data);
      setOpenedPackResult(response.data); // Store the { message, artworks_received }

      // Update the packs list in the state to remove the opened pack
      setPacks(prevPacks => prevPacks.filter(pack => pack.user_pack_id !== packId));

    } catch (err) {
      // Handle errors from the API call
      console.error(`Error opening pack ${packId}:`, err);
      // Extract user-friendly error message
      const message = err.response?.data?.error || err.message || "Failed to open pack.";
      setError(message); // Set error state to display message
      setOpenedPackResult(null); // Ensure no results are shown on error

    } finally {
      setIsOpening(false); // Indicate opening process finished (success or fail)
    }
  };

  // --- Render Logic (update results display) ---
  if (isLoading) {
    return <p>Loading your packs...</p>;
    // return <CircularProgress />; // MUI example
  }

  // Function to close the results display (modal or section)
  const handleCloseResults = () => {
    setOpenedPackResult(null);
  }

  return (
    <div> {/* Or use Box, Paper, etc. from MUI */}
      {error && !openedPackResult && ( // Only show main error if results aren't also showing
         // <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert> // MUI example
         <p style={{ color: 'red' }}>Error: {error} <button onClick={() => setError(null)}>X</button></p>
      )}

      {/* --- Simple Display for Opened Pack Results --- */}
      {/* Replace this with a Modal component for better UX */}
      {/* Example using basic HTML: */}
      {openedPackResult && (
         <div style={{ border: '2px solid green', padding: '1rem', margin: '1rem 0', backgroundColor: '#e8f5e9' }}>
            <h3>{openedPackResult.message || "Pack Opened!"}</h3>
            {openedPackResult.artworks_received && openedPackResult.artworks_received.length > 0 ? (
                <ul>
                    {openedPackResult.artworks_received.map(art => (
                        <li key={art.artwork_id}>
                            <img src={art.image_url} alt={art.title} width="50" style={{ marginRight: '10px', verticalAlign: 'middle' }} />
                            <strong>{art.title}</strong> by {art.artist?.username || 'Unknown Artist'}
                            {art.rarity && ` (${art.rarity})`}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No specific artworks listed in response.</p> // Should not happen with current backend logic if successful
            )}
            <button onClick={handleCloseResults}>Okay</button>
            {/* If there was also an error during the process but some results were processed? Unlikely with current setup */}
            {error && <p style={{ color: 'orange', marginTop: '10px' }}>Note: {error}</p>}
         </div>
      )}
      {/* --- End Results Display --- */}


      {!isLoading && packs.length === 0 && !error && !openedPackResult && ( // Also hide if results showing
        // <Typography variant="body1">You have no unopened packs.</Typography> // MUI example
        <p>You have no unopened packs.</p>
      )}

      {!isLoading && packs.length > 0 && (
        // Render the list of packs if available
        <ul> {/* <List> // MUI example */}
          {packs.map((pack) => (
            <li key={pack.user_pack_id}> {/* <ListItem key={pack.user_pack_id} ...> */}
              <strong>{pack.name}</strong> {/* <ListItemText primary={pack.name} ... /> */}
              {pack.description && <p>{pack.description}</p>}
              <button // <Button variant="contained" ...>
                onClick={() => handleOpenPack(pack.user_pack_id)}
                disabled={isOpening} // Disable button while one is being opened
              >
                {/* Show specific loading text if THIS pack is being opened? More complex state needed. */}
                {/* For now, any opening disables all buttons. */}
                {isOpening ? 'Opening...' : 'Open Pack'}
              </button>
            </li>
          ))}
        </ul>
        // </List> // MUI example
      )}
    </div>
  );
}

export default UserPacks;