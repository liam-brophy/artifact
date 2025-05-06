import React from 'react';
import '../styles/LoadingScreen.css'; // We'll create this CSS file next

const LoadingScreen = ({ message = "Loading..." }) => {
  return (
    <div className="loading-screen">
      <div className="loading-container">
        <img 
          src="/assets/Artifact_Logo_White.png" 
          alt="Artifact Logo" 
          className="loading-logo"
        />
        <div className="loading-spinner"></div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;