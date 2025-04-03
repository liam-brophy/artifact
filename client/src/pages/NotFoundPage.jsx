import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
    const navigate = useNavigate();

    const handleRedirect = () => {
        navigate('/');
    };

    return (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h1>404 - Page Not Found</h1>
            <p>Sorry, the page you are looking for does not exist.</p>
            <button onClick={handleRedirect} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                Go to HomePage
            </button>
        </div>
    );
};

export default NotFoundPage;
