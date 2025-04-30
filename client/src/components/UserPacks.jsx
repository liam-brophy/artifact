import React, { useState, useEffect, useRef } from 'react';
import apiService from '../services/apiService';
import ArtworkCard from './ArtworkCard';
import './UserPacks.css';

function UserPacks() {
  const [packs, setPacks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openedPackResult, setOpenedPackResult] = useState(null); // Holds { message, artworks_received }
  const [isOpening, setIsOpening] = useState(false); // Tracks if a pack open request is in progress
  const [nextPackInfo, setNextPackInfo] = useState(null); // Tracks next daily pack availability
  const [packTypeBeingOpened, setPackTypeBeingOpened] = useState(null); // Track which pack type is being opened
  const [timeRemaining, setTimeRemaining] = useState(null); // Tracks countdown for next daily pack
  const [dailyPackAvailable, setDailyPackAvailable] = useState(false); // Track if a daily pack is in the user's inventory
  const [showTimer, setShowTimer] = useState(false); // Control timer visibility based on logic
  
  // New state variables for animation
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [revealingCard, setRevealingCard] = useState(false);
  const [revealedCards, setRevealedCards] = useState([]);
  const [allRevealed, setAllRevealed] = useState(false);
  const [autoRevealActive, setAutoRevealActive] = useState(true); // Track if auto-reveal is active

  // useEffect to fetch packs and next pack availability
  useEffect(() => {
    const fetchPacks = async () => {
      setIsLoading(true);
      setError(null);
      setOpenedPackResult(null);
      try {
        const response = await apiService.get('/user-packs');
        if (response.data && Array.isArray(response.data)) {
           // Check if any fetched pack is a daily pack
           const hasDaily = response.data.some(pack => pack.name?.toLowerCase().includes('daily'));
           setDailyPackAvailable(hasDaily);
           // Update the main packs state
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
  
  // Determine if the timer should be shown
  useEffect(() => {
    const shouldShow = nextPackInfo?.next_available_at && 
                       new Date(nextPackInfo.next_available_at) > new Date() && 
                       !dailyPackAvailable; // Only show timer if no daily pack is currently held
    setShowTimer(shouldShow);
  }, [nextPackInfo, dailyPackAvailable]);

  // useEffect for the real-time timer countdown
  useEffect(() => {
    let timer;
    if (showTimer && nextPackInfo?.next_available_at) {
      timer = setInterval(() => { // Assign to timer variable
        // console.log("Timer tick"); // Debug log
        const nextTime = new Date(nextPackInfo.next_available_at);
        const now = new Date();
        const diffMs = nextTime - now;
        
        if (diffMs <= 0) {
          // Time is up, clear interval and refresh pack info
          clearInterval(timer);
          setShowTimer(false); // Hide timer
          // Fetch both packs and availability, as a pack might now be available
          // Fetch packs first to update dailyPackAvailable state
          apiService.get('/user-packs')
            .then(packResponse => {
              if (packResponse.data && Array.isArray(packResponse.data)) {
                const hasDaily = packResponse.data.some(pack => pack.name?.toLowerCase().includes('daily'));
                setDailyPackAvailable(hasDaily);
                setPacks(packResponse.data);
              }
              // Then fetch next availability
              return apiService.get('/user-packs/next-availability');
            })
            .then(response => {
              setNextPackInfo(response.data);
            })
            .catch(err => {
              console.error("Error refreshing pack info after timer:", err);
            });
        } else {
          // Update remaining time
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
          
          setTimeRemaining({ hours, minutes, seconds });
        }
      }, 1000);
      
      // Cleanup function
      return () => {
        if (timer) {
          clearInterval(timer);
        }
      };
    } 
  }, [showTimer, nextPackInfo]); // Dependencies

  // Reset animation states when opening a new pack
  useEffect(() => {
    if (openedPackResult) {
      setCurrentCardIndex(0);
      setRevealingCard(false);
      setRevealedCards([]);
      setAllRevealed(false);
    }
  }, [openedPackResult]);

  // Auto reveal effect - with slower timing
  useEffect(() => {
    if (!openedPackResult || !autoRevealActive || allRevealed) return;
    
    // If we have cards to reveal and auto-reveal is active
    if (openedPackResult.artworks_received && 
        currentCardIndex < openedPackResult.artworks_received.length && 
        !revealingCard) {
      
      // Start revealing the next card with a longer delay between cards
      const revealTimer = setTimeout(() => {
        handleRevealNextCard();
      }, 1500); // Extended delay between cards (1.5 seconds)
      
      return () => clearTimeout(revealTimer);
    }
  }, [openedPackResult, currentCardIndex, revealingCard, autoRevealActive, allRevealed]);

  // Handle revealing the next card - with revised animation flow to use waiting area
  const handleRevealNextCard = () => {
    if (!openedPackResult?.artworks_received) return;
    
    const artworks = openedPackResult.artworks_received;
    if (currentCardIndex >= artworks.length) return;
    
    setRevealingCard(true);
    
    // After the reveal animation completes, add the card to revealed cards waiting area
    setTimeout(() => {
      setRevealedCards(prev => [...prev, artworks[currentCardIndex]]);
      setRevealingCard(false);
      setCurrentCardIndex(prev => prev + 1);
      
      // Check if all cards are now revealed
      if (currentCardIndex === artworks.length - 1) {
        setAllRevealed(true);
      }
    }, 3000); // Match this with the animation duration in CSS
  };

  // Reveal all cards at once
  const handleRevealAll = () => {
    if (!openedPackResult?.artworks_received) return;
    
    setRevealedCards(openedPackResult.artworks_received);
    setCurrentCardIndex(openedPackResult.artworks_received.length);
    setAllRevealed(true);
  };

  // Skip animation and show all cards immediately
  const handleSkipAnimation = () => {
    setAutoRevealActive(false);
    handleRevealAll();
  };

  // Create confetti effect for legendary cards
  const createConfetti = (rarity) => {
    if (rarity?.toLowerCase() !== 'legendary') return;
    
    // Create 50 confetti pieces
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti-container';
    document.body.appendChild(confettiContainer);
    
    const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f'];
    
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.width = `${Math.random() * 10 + 5}px`;
      confetti.style.height = `${Math.random() * 10 + 5}px`;
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animation = `confetti-fall ${Math.random() * 3 + 2}s linear forwards`;
      confettiContainer.appendChild(confetti);
    }
    
    // Remove confetti after animation
    setTimeout(() => {
      if (confettiContainer && confettiContainer.parentNode) {
        confettiContainer.parentNode.removeChild(confettiContainer);
      }
    }, 5000);
  };

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
      const remainingPacks = packs.filter(pack => pack.user_pack_id !== packId);
      setPacks(remainingPacks);
      
      // Check if the opened pack was the last daily pack
      const stillHasDaily = remainingPacks.some(pack => pack.name?.toLowerCase().includes('daily'));
      setDailyPackAvailable(stillHasDaily);

      // Always refresh next pack availability info after opening any pack
      try {
        const nextPackResponse = await apiService.get('/user-packs/next-availability');
        setNextPackInfo(nextPackResponse.data);
      } catch (err) {
          console.error("Error refreshing next pack info:", err);
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
    if (name.includes('artist')) return 'pack-card artist';
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

  // Component render for a card being revealed with extra styling to ensure proper scaling
  const renderRevealingCard = (artwork) => {
    // Check if the current card should trigger a confetti effect
    const isLegendary = artwork.rarity?.toLowerCase() === 'legendary';
    
    if (isLegendary) {
      createConfetti(artwork.rarity);
    }
    
    return (
      <div className={`revealing-card ${revealingCard ? 'animate' : ''}`}>
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <ArtworkCard artwork={artwork} />
          {/* Add rarity animation effect */}
          <div className={`rarity-animation ${getRarityClass(artwork.rarity)}`} />
        </div>
      </div>
    );
  };

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
      {nextPackInfo && ( // Show this section if we have any nextPackInfo
        <div className="daily-pack-info">
          <h3>Daily Pack</h3>
          {dailyPackAvailable ? ( // Check if a daily pack is actually in the inventory
            <p>You have an unopened daily pack! Open it below.</p>
          ) : showTimer ? ( // Only show timer if conditions are met (future date, no current pack)
            <p>Next daily pack: <span className="countdown">{formatCountdown()}</span></p>
          ) : !nextPackInfo.next_available_at && !dailyPackAvailable ? ( // Handle case where next_available_at is null AND no pack exists (e.g., first login before first grant)
            <p>Your first daily pack should arrive soon!</p> // Adjusted message
          ) : null /* Optionally add a message if pack is available now but not yet fetched, though fetchPacks should handle this */}
        </div>
      )}

      {/* Pack Opening Results Modal */}
      {openedPackResult && (
        <div className="pack-results-overlay">
          <div className="pack-results-content">
            {openedPackResult.artworks_received && openedPackResult.artworks_received.length > 0 ? (
              <div className="dynamic-card-container">
                {/* Card Reveal Animation Container - Only visible during reveal */}
                {!allRevealed && (
                  <>
                    {/* Stack of unrevealed cards */}
                    {currentCardIndex < openedPackResult.artworks_received.length && (
                      <div className="card-stack">
                        {[...Array(Math.min(3, openedPackResult.artworks_received.length - currentCardIndex))].map((_, i) => (
                          <div 
                            key={i} 
                            className="stack-card" 
                            style={{ '--index': i }}
                          ></div>
                        ))}
                      </div>
                    )}
                    
                    {/* Currently revealing card */}
                    {revealingCard && currentCardIndex < openedPackResult.artworks_received.length && (
                      renderRevealingCard(openedPackResult.artworks_received[currentCardIndex])
                    )}
                    
                    {/* Progress indicator */}
                    <div className="reveal-progress">
                      <div 
                        className="reveal-progress-bar" 
                        style={{ 
                          width: `${(currentCardIndex / openedPackResult.artworks_received.length) * 100}%` 
                        }}
                      ></div>
                    </div>
                    
                    {/* Skip button */}
                    <button 
                      className="skip-button"
                      onClick={handleSkipAnimation}
                    >
                      Skip Animation
                    </button>
                  </>
                )}
                
                {/* Unified grid for already revealed cards - grows as cards are revealed */}
                <div className={`revealed-cards-container ${allRevealed ? 'all-revealed' : ''}`}>
                  {revealedCards.map((artwork, index) => (
                    <div 
                      key={artwork.artwork_id} 
                      className="revealed-card"
                      style={{ '--index': index }}
                    >
                      <ArtworkCard artwork={artwork} />
                    </div>
                  ))}
                </div>
                
                {/* Action button - only shown when all cards are revealed */}
                {allRevealed && (
                  <div className="modal-actions">
                    <button 
                      className="close-button" 
                      onClick={handleCloseResults}
                    >
                      Add to Collection
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="no-artworks-message">No artworks were found in this pack.</p>
            )}
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
          {/* Removed claim button - daily packs should appear automatically */}
        </div>
      )}

      {/* Pack list - Now with stacked packs */}
      {!isLoading && groupedPacks.length > 0 && (
        <div>
          <ul className="packs-list">
            {groupedPacks.map((packGroup) => (
              <li key={packGroup.name} className="pack-list-item">
                {/* Count badge as independent element */}
                {packGroup.count > 1 && (
                  <div className="pack-count-badge" data-count={packGroup.count > 10 ? "10+" : packGroup.count}>
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