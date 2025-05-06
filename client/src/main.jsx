import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client'; // Updated import for React 18
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import './styles/AuthForm.css';
import { AuthProvider } from './context/AuthContext';

// Wrap App component to dispatch event when React is ready
const AppWithReadySignal = () => {
  useEffect(() => {
    // Dispatch event to let the app shell know React is ready
    window.dispatchEvent(new Event('react-app-ready'));
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')); // Use createRoot for React 18
root.render(
  <React.StrictMode>
    <AppWithReadySignal />
  </React.StrictMode>
);
