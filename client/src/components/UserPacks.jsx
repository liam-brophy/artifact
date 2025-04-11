import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import './UserPacks.css';

function UserPacks() {
  const [packs, setPacks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openedPackResult, setOpenedPackResult] = useState(null); // Holds { message, artworks_received }
  const [isOpening, setIsOpening] = useState(false); // Tracks if a pack open request is in progress
  const [nextPackInfo, setNextPackInfo] = useState(null); // Tracks next daily pack availability
  const [packTypeBeingOpened, setPackTypeBeingOpened] = useState(null); // Track which pack type is being opened

  // useEffect to fetch packs and next pack availability
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

    const fetchNextPackInfo = async () => {
      try {
        const response = await apiService.get('/user-packs/next-availability');
        setNextPackInfo(response.data);
      } catch (err) {
        console.error("Error fetching next pack info:", err);
        // Don't set main error - this is secondary information
      }
    };

    fetchPacks();
    fetchNextPackInfo();
  }, []);

  const handleOpenPack = async (packId, packName) => {
    console.log(`Attempting to open pack with ID: ${packId}`);
    setIsOpening(true);
    setError(null);
    setOpenedPackResult(null);
    setPackTypeBeingOpened(packName); // Store the pack name being opened

    try {
      // Make the POST request to the backend endpoint
      const response = await apiService.post(`/user-packs/${packId}/open`);

      // Handle successful response (200 OK)
      console.log("Pack opened successfully:", response.data);
      setOpenedPackResult({
        ...response.data,
        packType: packName // Add the pack type to the result
      });

      // Update the packs list in the state to remove the opened pack
      setPacks(prevPacks => prevPacks.filter(pack => pack.user_pack_id !== packId));

    } catch (err) {
      // Handle errors from the API call
      console.error(`Error opening pack ${packId}:`, err);
      const message = err.response?.data?.error || err.message || "Failed to open pack.";
      setError(message);
      setOpenedPackResult(null);

    } finally {
      setIsOpening(false);
      setPackTypeBeingOpened(null);
    }
  };

  // Function to format the next pack time in a user-friendly way
  const formatNextPackTime = (isoTimeString) => {
    if (!isoTimeString) return null;
    
    const nextTime = new Date(isoTimeString);
    const now = new Date();
    
    // Calculate time difference in hours
    const diffMs = nextTime - now;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHrs > 24) {
      return `Available in ${Math.floor(diffHrs / 24)} days`;
    } else if (diffHrs > 0) {
      return `Available in ${diffHrs}h ${diffMins}m`;
    } else if (diffMins > 0) {
      return `Available in ${diffMins} minutes`;
    } else {
      return 'Available now';
    }
  };

  // Function to close the results display (modal or section)
  const handleCloseResults = () => {
    setOpenedPackResult(null);
  };

  // Helper to determine pack card CSS class based on pack name
  const getPackCardClass = (packName) => {
    const name = packName.toLowerCase();
    if (name.includes('premium')) return 'pack-card premium';
    if (name.includes('daily')) return 'pack-card daily';
    return 'pack-card';
  };

  // Helper to get rarity class for styling
  const getRarityClass = (rarity) => {
    if (!rarity) return 'rarity-common';
    
    const rarityLower = rarity.toLowerCase();
    if (rarityLower.includes('legendary')) return 'rarity-legendary';
    if (rarityLower.includes('rare')) return 'rarity-rare';
    if (rarityLower.includes('uncommon')) return 'rarity-uncommon';
    return 'rarity-common';
  };
  
  // Group packs by name and count them
  const groupPacksByType = (packsList) => {
    const packGroups = {};
    
    packsList.forEach(pack => {
      if (!packGroups[pack.name]) {
        packGroups[pack.name] = {
          name: pack.name,
          description: pack.description,
          count: 1,
          packs: [pack],
          firstPackId: pack.user_pack_id
        };
      } else {
        packGroups[pack.name].count++;
        packGroups[pack.name].packs.push(pack);
      }
    });
    
    return Object.values(packGroups);
  };
  
  // Get an array of pack IDs for a specific pack type
  const getPackIdsForType = (packName) => {
    return packs
      .filter(pack => pack.name === packName)
      .map(pack => pack.user_pack_id);
  };

  // Handle opening the top pack from a stack
  const handleOpenTopPack = (packName) => {
    const packsOfType = packs.filter(pack => pack.name === packName);
    if (packsOfType.length > 0) {
      // Take the first pack ID from the array of packs with this name
      handleOpenPack(packsOfType[0].user_pack_id, packName);
    }
  };
  
  // Group the packs by type for rendering
  const groupedPacks = groupPacksByType(packs);

  return (
    <div className="packs-container">
      <h2 className="packs-title">Your Packs</h2>
      
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button className="error-close" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Daily Pack Availability Information */}
      {nextPackInfo && (
        <div className="daily-pack-info">
          <h3>Daily Pack</h3>
          {nextPackInfo.has_unopened_daily_packs ? (
            <p>You have an unopened daily pack! Open it below.</p>
          ) : nextPackInfo.next_available_at ? (
            <p>Next daily pack: <span className="countdown">{formatNextPackTime(nextPackInfo.next_available_at)}</span></p>
          ) : (
            <p>Your first daily pack will arrive tomorrow!</p>
          )}
        </div>
      )}

      {/* Pack Opening Results Modal */}
      {openedPackResult && (
        <div className="pack-results-overlay">
          <div className="pack-results-content">
            <div className="pack-results-header">
              <h2 className="pack-results-title">{openedPackResult.packType || 'Pack'} Opened!</h2>
              <p>You received the following artwork{openedPackResult.artworks_received?.length !== 1 ? 's' : ''}:</p>
            </div>
            
            {openedPackResult.artworks_received && openedPackResult.artworks_received.length > 0 ? (
              <div className="artwork-grid">
                {openedPackResult.artworks_received.map(art => (
                  <div className="artwork-item" key={art.artwork_id}>
                    <img 
                      src={art.image_url} 
                      alt={art.title} 
                      className="artwork-image" 
                    />
                    <div className="artwork-info">
                      <h4 className="artwork-title">{art.title}</h4>
                      <p className="artwork-artist">by {art.artist?.username || 'Unknown Artist'}</p>
                      {art.rarity && (
                        <span className={`rarity-badge ${getRarityClass(art.rarity)}`}>
                          {art.rarity}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No artworks were found in this pack.</p>
            )}
            
            <button className="close-button" onClick={handleCloseResults}>
              Add to Collection
            </button>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="loader-container">
          <div className="loader"></div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && packs.length === 0 && !error && !openedPackResult && (
        <div className="empty-state">
          <p>You have no unopened packs.</p>
        </div>
      )}

      {/* Pack list - Now with stacked packs */}
      {!isLoading && groupedPacks.length > 0 && (
        <ul className="packs-list">
          {groupedPacks.map((packGroup) => (
            <li key={packGroup.name} className="pack-list-item">
              {/* Count badge as independent element */}
              {packGroup.count > 1 && (
                <div className={`pack-count-badge ${getPackCardClass(packGroup.name).includes('premium') ? 'premium' : getPackCardClass(packGroup.name).includes('daily') ? 'daily' : ''}`} data-count={packGroup.count > 10 ? "10+" : packGroup.count}>
                  <span>{packGroup.count}</span>
                </div>
              )}
              
              <div className={`${getPackCardClass(packGroup.name)} ${packGroup.count > 1 ? 'pack-stack' : ''}`}>
                {/* Stack effect for multiple packs */}
                {packGroup.count > 1 && (
                  <>
                    <div className="pack-stack-shadow pack-stack-shadow-3"></div>
                    <div className="pack-stack-shadow pack-stack-shadow-2"></div>
                    <div className="pack-stack-shadow pack-stack-shadow-1"></div>
                  </>
                )}
                
                <div className="pack-card-inner">
                  <div className="pack-card-content">
                    {/* Pack overlay effect */}
                    <div className="pack-overlay"></div>
                    
                    {/* Design elements that make it feel like a pack/sleeve */}
                    <div className="pack-design"></div>
                    
                    <div className="pack-content-wrapper">
                      <h3 className="pack-title">{packGroup.name}</h3>
                      {packGroup.description && <p className="pack-description">{packGroup.description}</p>}
                      <button 
                        className="pack-button"
                        onClick={() => handleOpenTopPack(packGroup.name)}
                        disabled={isOpening}
                      >
                        {isOpening && packTypeBeingOpened === packGroup.name ? 'Opening...' : 'Open Pack'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default UserPacks;