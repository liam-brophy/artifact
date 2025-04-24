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
  const [isClaimingPack, setIsClaimingPack] = useState(false); // Tracks if a claim daily pack request is in progress
  const [showDailyPackTimer, setShowDailyPackTimer] = useState(false); // Controls visibility of daily pack timer
  const [timeRemaining, setTimeRemaining] = useState(null); // Tracks countdown for next daily pack

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
        
        // Only show the timer if user has claimed a pack before (has next_available_at)
        if (response.data && response.data.next_available_at) {
          setShowDailyPackTimer(true);
        }
      } catch (err) {
        console.error("Error fetching next pack info:", err);
        // Don't set main error - this is secondary information
      }
    };

    fetchPacks();
    fetchNextPackInfo();
  }, []);
  
  // useEffect for the real-time timer countdown
  useEffect(() => {
    // Only set up the timer if we're showing the daily pack timer and have next pack time
    if (showDailyPackTimer && nextPackInfo?.next_available_at) {
      const timer = setInterval(() => {
        const nextTime = new Date(nextPackInfo.next_available_at);
        const now = new Date();
        const diffMs = nextTime - now;
        
        if (diffMs <= 0) {
          // Time is up, clear interval and refresh pack info
          clearInterval(timer);
          apiService.get('/user-packs/next-availability')
            .then(response => {
              setNextPackInfo(response.data);
            })
            .catch(err => {
              console.error("Error refreshing next pack info:", err);
            });
        } else {
          // Update remaining time
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
          
          setTimeRemaining({ hours, minutes, seconds });
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [showDailyPackTimer, nextPackInfo]);

  const handleOpenPack = async (packId, packName) => {
    // console.log(`Attempting to open pack with ID: ${packId}`);
    setIsOpening(true);
    setError(null);
    setOpenedPackResult(null);
    setPackTypeBeingOpened(packName); // Store the pack name being opened

    try {
      // Make the POST request to the backend endpoint
      const response = await apiService.post(`/user-packs/${packId}/open`);

      // Handle successful response (200 OK)
      // console.log("Pack opened successfully:", response.data);
      setOpenedPackResult({
        ...response.data,
        packType: packName // Add the pack type to the result
      });

      // Update the packs list in the state to remove the opened pack
      setPacks(prevPacks => prevPacks.filter(pack => pack.user_pack_id !== packId));
      
      // If we opened a daily pack, refresh the next pack availability info
      if (packName.toLowerCase().includes('daily')) {
        try {
          const nextPackResponse = await apiService.get('/user-packs/next-availability');
          setNextPackInfo(nextPackResponse.data);
          
          // Make sure the timer is showing
          setShowDailyPackTimer(true);
        } catch (err) {
          console.error("Error refreshing next pack info:", err);
        }
      }

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

  // Handle claiming a daily pack
  const handleClaimDailyPack = async () => {
    setIsClaimingPack(true);
    setError(null);
    
    try {
      const response = await apiService.post('/user-packs/claim-daily');
      // console.log("Daily pack claimed:", response.data);
      
      // If successful, add the new pack to the packs list
      if (response.data.user_pack_id) {
        // Fetch the pack details to get the name and description
        const packsResponse = await apiService.get('/user-packs');
        if (packsResponse.data && Array.isArray(packsResponse.data)) {
          setPacks(packsResponse.data);
        }
        
        // Also refresh next pack availability info
        const nextPackResponse = await apiService.get('/user-packs/next-availability');
        setNextPackInfo(nextPackResponse.data);
        
        // Show the daily pack timer after claiming a pack
        setShowDailyPackTimer(true);
      }
    } catch (err) {
      console.error("Error claiming daily pack:", err);
      const message = err.response?.data?.error || err.message || "Failed to claim daily pack.";
      setError(message);
    } finally {
      setIsClaimingPack(false);
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

  // Function to format the countdown timer
  const formatCountdown = () => {
    if (!timeRemaining) return 'Calculating...';
    
    const { hours, minutes, seconds } = timeRemaining;
    
    if (hours > 24) {
      return `${Math.floor(hours / 24)} days ${hours % 24}h ${minutes}m`;
    } else {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
  };

  // Function to close the results display (modal or section)
  const handleCloseResults = () => {
    setOpenedPackResult(null);
    
    // Refresh the packs list after adding to collection
    const fetchPacks = async () => {
      try {
        const response = await apiService.get('/user-packs');
        if (response.data && Array.isArray(response.data)) {
          setPacks(response.data);
        }
      } catch (err) {
        console.error("Error refreshing packs:", err);
      }
    };
    
    fetchPacks();
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
      {showDailyPackTimer && nextPackInfo && (
        <div className="daily-pack-info">
          <h3>Daily Pack</h3>
          {nextPackInfo.has_unopened_daily_packs ? (
            <p>You have an unopened daily pack! Open it below.</p>
          ) : nextPackInfo.next_available_at ? (
            <p>Next daily pack: <span className="countdown">{formatCountdown()}</span></p>
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
                    <div className="artwork-image-container">
                      <img 
                        src={art.image_url} 
                        alt={art.title} 
                        className="artwork-image" 
                        onError={(e) => {
                          console.error("Failed to load artwork image:", art.image_url);
                          e.target.src = "https://via.placeholder.com/200x200?text=Image+Not+Available";
                        }}
                      />
                    </div>
                    <div className="artwork-info">
                      <h4 className="artwork-title">{art.title || "Untitled Artwork"}</h4>
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
              <p className="no-artworks-message">No artworks were found in this pack.</p>
            )}
            
            <div className="modal-actions">
              <button className="close-button" onClick={handleCloseResults}>
                Add to Collection
              </button>
            </div>
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
          
          {/* Add a button to claim daily pack if available */}
          {nextPackInfo && nextPackInfo.can_claim_daily_pack && (
            <button 
              className="claim-daily-pack-btn"
              onClick={handleClaimDailyPack}
              disabled={isClaimingPack}
            >
              {isClaimingPack ? 'Claiming...' : 'Claim Daily Pack'}
            </button>
          )}
        </div>
      )}

      {/* Pack list - Now with stacked packs */}
      {!isLoading && groupedPacks.length > 0 && (
        <div>
          {/* Daily pack claim button for users with other packs */}
          {nextPackInfo && nextPackInfo.can_claim_daily_pack && (
            <div className="daily-pack-claim-container">
              <button 
                className="claim-daily-pack-btn"
                onClick={handleClaimDailyPack}
                disabled={isClaimingPack}
              >
                {isClaimingPack ? 'Claiming...' : 'Claim Daily Pack'}
              </button>
            </div>
          )}
          
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
        </div>
      )}
    </div>
  );
}

export default UserPacks;