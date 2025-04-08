import axios from 'axios';
// Ensure you have installed js-cookie: npm install js-cookie OR yarn add js-cookie
import Cookies from 'js-cookie';

// 1. Create a configured Axios instance
const apiService = axios.create({
    // Set the base URL for all API requests.
    // This should match the prefix you use for your Flask API routes.
    // Example: If your Flask routes are '/api/auth/login', '/api/users/me', etc.
    baseURL: '/api',

    // Set default headers if needed (Content-Type is usually handled automatically for JSON)
    // headers: {
    //   'Content-Type': 'application/json',
    // },

    // IMPORTANT: Send credentials (cookies) with cross-origin requests
    // This is essential for HttpOnly cookies to be sent by the browser.
    withCredentials: true,

    // Optional: Set a default timeout for requests (in milliseconds)
    // timeout: 10000, // e.g., 10 seconds
});

// 2. Add a Request Interceptor
// This function runs BEFORE each request is sent.
apiService.interceptors.request.use(
    (config) => {
        // --- CSRF Token Handling ---
        // We need to add the CSRF token header for state-changing methods
        // (POST, PUT, DELETE, PATCH) as configured in Flask-JWT-Extended.

        const methodsRequiringCsrf = ['post', 'put', 'delete', 'patch'];

        // Check if the request method requires a CSRF token
        if (methodsRequiringCsrf.includes(config.method.toLowerCase())) {
            // Read the CSRF token value from the cookie.
            // Flask-JWT-Extended sets this cookie (it's NOT HttpOnly).
            // Default cookie name is 'csrf_access_token'. Change if you customized it in Flask.
            const csrfToken = Cookies.get('csrf_access_token');

            if (csrfToken) {
                // Add the CSRF token to the request headers.
                // Default header name is 'X-CSRF-Token'. Change if you customized it in Flask.
                config.headers['X-CSRF-Token'] = csrfToken;
                // console.log("CSRF Token Added:", csrfToken); // Uncomment for debugging
            } else {
                // Optional: Log a warning if the CSRF cookie is missing for a protected request
                console.warn('CSRF token cookie (csrf_access_token) not found for request method:', config.method.toUpperCase());
                // Depending on your backend setup, the request might fail without this header.
            }
        }

        // You could add other logic here if needed, e.g., adding an Authorization header
        // for a DIFFERENT auth scheme, but for JWT cookies, this is usually not needed.

        // Must return the config object for the request to proceed
        return config;
    },
    (error) => {
        // Handle request configuration errors (rare)
        console.error('Axios request interceptor error:', error);
        return Promise.reject(error);
    }
);

// 3. Add a Response Interceptor (Optional but Recommended)
// This function runs AFTER a response is received.
apiService.interceptors.response.use(
    (response) => {
        // --- Successful Responses (Status 2xx) ---
        // You can process successful responses globally here if needed.
        // Often, you just pass them through.
        // console.log("Axios response interceptor success:", response); // Uncomment for debugging
        return response;
    },
    (error) => {
        // --- Error Responses (Status outside 2xx) ---
        console.error('Axios response interceptor error:', error);

        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            const { status, data } = error.response;
            console.error(`API Error: Status ${status}`, data);

            // --- Specific Error Handling ---
            if (status === 401) {
                // Unauthorized: JWT might be expired, invalid, or missing.
                // The user might need to log in again.
                console.warn('Received 401 Unauthorized. Potential session expiry.');
                // You might want to trigger a logout action or redirect to login here.
                // Example (simple redirect, loses state):
                // if (!window.location.pathname.includes('/login')) { // Avoid redirect loop
                //    window.location.href = '/login?sessionExpired=true';
                // }
                // A better approach involves using your AuthContext's logout function,
                // which might require passing the context or using an event bus.
            } else if (status === 422 && data?.msg === 'Missing CSRF token') {
                // This specific error comes from Flask-JWT-Extended if CSRF is enforced
                // but the header was missing or invalid.
                console.error('CSRF Token validation failed. Check if cookie exists and header is sent correctly.');
                // Could potentially try to refresh the page or prompt the user.
            } else if (status === 403) {
                 // Forbidden: User is authenticated but doesn't have permission for the action.
                 console.warn('Received 403 Forbidden. User lacks permissions.');
            }
            // Add handling for other common errors like 404 (Not Found), 500 (Server Error) if needed

        } else if (error.request) {
            // The request was made but no response was received (e.g., network error, backend down)
            console.error('API Error: No response received.', error.request);
            // You could show a generic "Network Error" message to the user.
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('API Error: Request setup failed.', error.message);
        }

        // IMPORTANT: Reject the promise so the error can be caught and handled
        // by the specific component/function that made the API call.
        return Promise.reject(error);
    }
);

// 4. Export the configured instance as the default export
export default apiService;