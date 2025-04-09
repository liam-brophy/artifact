import axios from 'axios';
import toast from 'react-hot-toast'; // <-- Import toast
import Cookies from 'js-cookie'; // Make sure you have run: npm install js-cookie

// 1. Create Axios instance
const apiService = axios.create({
    baseURL: '/api', // Your API base URL prefix
    withCredentials: true, // Essential for sending cookies
    // timeout: 10000, // Optional timeout
});

// 2. Request Interceptor (for CSRF)
apiService.interceptors.request.use(
    (config) => {
        const methodsRequiringCsrf = ['post', 'put', 'delete', 'patch'];
        if (methodsRequiringCsrf.includes(config.method.toLowerCase())) {
            // Ensure cookie/header names match your Flask-JWT-Extended config
            const csrfToken = Cookies.get('csrf_access_token');
            if (csrfToken) {
                config.headers['X-CSRF-Token'] = csrfToken;
            } else {
                // Optional: Warn if CSRF needed but cookie not found
                console.warn('CSRF cookie not found for state-changing request.');
            }
        }
        return config;
    },
    (error) => {
        // Usually network errors before request is sent
        toast.error('Error configuring request: ' + error.message);
        return Promise.reject(error);
    }
);

// 3. Response Interceptor (for Toast error handling)
apiService.interceptors.response.use(
    (response) => {
        // Pass successful responses (2xx) straight through
        return response;
    },
    (error) => {
        // Handle errors (outside 2xx range)
        let errorMessage = 'An error occurred.'; // Default message

        if (error.response) {
            // Server responded with an error status code
            const { status, data } = error.response;
            // Extract message from backend response (adjust keys as needed)
            errorMessage =
                data?.error?.message || data?.message || data?.error || data?.msg ||
                `Request failed with status ${status}`;

            // Specific handling (optional refinement)
            if (status === 401) {
                errorMessage = 'Authentication required. Please log in.';
                // Consider redirect or logout action here if appropriate
            } else if (status === 403) {
                errorMessage = 'Permission denied.';
            } else if (status === 404) {
                errorMessage = 'Resource not found.';
            } else if (status === 422 && data?.msg?.toLowerCase().includes('csrf')) {
                errorMessage = 'Security token expired or missing. Please refresh and try again.';
            }
            // Add more specific status code messages if desired

        } else if (error.request) {
            // Network error (no response received)
            errorMessage = 'Network Error: Unable to connect to the server.';
        } else {
            // Request setup error
            errorMessage = 'Request setup error: ' + error.message;
        }

        // Show toast notification for the error
        toast.error(errorMessage, {
            id: `api-error-${Date.now()}`, // Prevent rapid duplicate toasts
            duration: 5000, // Keep errors visible longer
        });

        // Reject the promise so component-level .catch() can still run for UI updates
        return Promise.reject(error);
    }
);

// 4. Export the instance
export default apiService;