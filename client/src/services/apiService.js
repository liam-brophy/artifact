import apiService from '../services/apiService';
import Cookies from 'js-cookie'; // Or your preferred cookie library

// 1. Create an Axios instance
const apiService = axios.create({
    // 2. Set the base URL for your API endpoints
    baseURL: '/api', // Adjust if your Flask API is served from a different path/port during development
    // 3. Crucial: Tell Axios to send cookies with requests
    withCredentials: true,
});

// 4. Add a request interceptor for CSRF
apiService.interceptors.request.use(
    (config) => {
        const methodsRequiringCsrf = ['post', 'put', 'patch', 'delete'];
        // Check if the method requires CSRF protection
        if (methodsRequiringCsrf.includes(config.method.toLowerCase())) {
            // Get the CSRF token from the cookie set by Flask-JWT-Extended
            // Default cookie name is 'csrf_access_token', adjust if you changed it in Flask config
            const csrfToken = Cookies.get('csrf_access_token');

            if (csrfToken) {
                // Set the CSRF token header
                // Default header name is 'X-CSRF-Token', adjust if you changed it in Flask config
                config.headers['X-CSRF-Token'] = csrfToken;
            } else {
                // Optional: Log a warning if the cookie is missing for a protected method
                console.warn('CSRF token cookie not found for a state-changing request.');
                // You might want to prevent the request here or let the backend handle the missing token error
            }
        }
        return config; // Continue with the request configuration
    },
    (error) => {
        // Handle request errors (e.g., network issues before sending)
        return Promise.reject(error);
    }
);

// 5. Optional: Add a response interceptor for global error handling
apiService.interceptors.response.use(
    (response) => {
        // Any status code that lie within the range of 2xx cause this function to trigger
        return response;
    },
    (error) => {
        // Any status codes that falls outside the range of 2xx cause this function to trigger
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error("API Error Response:", error.response.data);
            console.error("Status Code:", error.response.status);
            console.error("Headers:", error.response.headers);

            if (error.response.status === 401) {
                 // Specific handling for Unauthorized errors
                 console.error("Unauthorized access - potential session expiry.");
                 // Example: Trigger a logout or redirect to login page
                 // You might need access to your AuthContext's logout function here,
                 // which can be tricky. Often, this involves setting some app state
                 // or using a custom event emitter. For now, just logging is fine.
                 // window.location.href = '/login'; // Simple redirect, but loses state
            } else if (error.response.status === 422 && error.response.data?.msg === 'Missing CSRF token') {
                console.error("CSRF Token validation failed on the server.");
                // Potentially notify the user or attempt a refresh?
            }
        } else if (error.request) {
            // The request was made but no response was received
            console.error("API No Response:", error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('API Request Setup Error:', error.message);
        }
        return Promise.reject(error); // Important: Reject the promise so calling code can handle the error too
    }
);


// 6. Export the configured instance
export default apiService;