import axios from 'axios';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import API_BASE_URL from '../config';

const apiService = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Flag to track if a token refresh is in progress
let isRefreshing = false;
// Store for requests that should be retried after token refresh
let refreshSubscribers = [];
// Store the CSRF token
let csrf_token = null;

// Function to process queued requests after token refresh
const processQueue = (error, token = null) => {
    refreshSubscribers.forEach(callback => {
        if (error) {
            callback(error);
        } else {
            callback(token);
        }
    });
    refreshSubscribers = [];
};

// Function to refresh the auth token
const refreshAuthToken = async () => {
    try {
      // Use GET instead of POST to avoid preflight OPTIONS request issues
      const response = await axios.get(`${API_BASE_URL}/auth/refresh`, {
        withCredentials: true,
      });
      return response;
    } catch (error) {
      return Promise.reject(error);
    }
};

// CSRF token initialization
const initializeCsrfToken = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/csrf-token`, {
      withCredentials: true
    });
    csrf_token = response.data.csrf_token;
    return csrf_token;
  } catch (error) {
    // Don't throw - let the application continue
    return null;
  }
};

// 2. Request Interceptor (for CSRF)
apiService.interceptors.request.use(
    async (config) => {
        const methodsRequiringCsrf = ['post', 'put', 'delete', 'patch'];
        
        // Special handling for multipart/form-data (file uploads)
        if (config.headers['Content-Type'] === 'multipart/form-data' || 
            (config.headers && config.headers['content-type'] === 'multipart/form-data')) {
            // For multipart/form-data, let the browser set the Content-Type with boundary
            delete config.headers['Content-Type'];
        }
        
        if (methodsRequiringCsrf.includes(config.method.toLowerCase())) {
            // Try to get CSRF token from cookie first
            const csrfToken = Cookies.get('csrf_token'); 
            
            // If no token in cookie, use the one we stored in memory
            if (csrfToken) {
                config.headers['X-CSRF-Token'] = csrfToken;
            } else if (csrf_token) {
                config.headers['X-CSRF-Token'] = csrf_token;
            } else {
                // If we don't have any token, try to get one before proceeding
                try {
                    const newToken = await initializeCsrfToken();
                    if (newToken) {
                        config.headers['X-CSRF-Token'] = newToken;
                    }
                } catch (error) {
                    // Silent fail
                }
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

// 3. Response Interceptor (for Toast error handling and token refresh)
apiService.interceptors.response.use(
    (response) => {
        // Pass successful responses (2xx) straight through
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Skip showing errors for auth status check - it's normal to get 401 there
        if (error.config && error.config.url && 
            (error.config.url.includes('/auth/status') && error.response?.status === 401)) {
            return Promise.reject(error);
        }

        // Prevent infinite loops: don't retry refresh or logout endpoints
        const isAuthEndpoint = originalRequest.url?.includes('/auth/refresh') || 
                               originalRequest.url?.includes('/auth/logout');

        // Handle token refresh when we get a 401 Unauthorized error
        // and it's not a login/refresh/logout request itself
        if (error.response?.status === 401 && 
            !originalRequest._retry && 
            !originalRequest.url?.includes('/auth/login') && 
            !isAuthEndpoint) {
            
            if (!isRefreshing) {
                isRefreshing = true;
                originalRequest._retry = true;

                try {
                    const refreshResponse = await refreshAuthToken();
                    isRefreshing = false;
                    
                    // On successful token refresh, retry all queued requests
                    processQueue(null, refreshResponse);
                    
                    // Get a fresh CSRF token for the retry
                    await initializeCsrfToken();
                    
                    // Retry the original request with new csrf token
                    if (csrf_token) {
                        originalRequest.headers['X-CSRF-Token'] = csrf_token;
                    }
                    
                    return apiService(originalRequest);
                } catch (refreshError) {
                    isRefreshing = false;
                    
                    // Token refresh failed - reject all queued requests
                    processQueue(refreshError);
                    
                    // Dispatch event to trigger logout in AuthContext
                    window.dispatchEvent(new CustomEvent('auth:tokenRefreshFailed'));
                    
                    // Don't try to run logout API call here, as we're already unauthorized
                    // Just return the refresh error
                    return Promise.reject(refreshError);
                }
            } else {
                // If another request is already refreshing the token,
                // add this request to the queue
                return new Promise((resolve, reject) => {
                    refreshSubscribers.push((token) => {
                        if (token instanceof Error) {
                            return reject(token);
                        }
                        
                        // Update csrf token in the request
                        if (csrf_token) {
                            originalRequest.headers['X-CSRF-Token'] = csrf_token;
                        }
                        
                        resolve(apiService(originalRequest));
                    });
                });
            }
        }
        
        // For auth endpoints that return 401, don't show an error toast
        // as this is being handled separately
        if (isAuthEndpoint && error.response?.status === 401) {
            return Promise.reject(error);
        }

        // Handle other errors (outside 2xx range)
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
            } else if (status === 403) {
                errorMessage = 'Permission denied.';
            } else if (status === 404) {
                errorMessage = 'Resource not found.';
            } else if (status === 422 && data?.msg?.toLowerCase().includes('csrf')) {
                errorMessage = 'Security token expired or missing. Please refresh and try again.';
                
                // Try to get a new CSRF token
                initializeCsrfToken();
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

// --- IMPORTANT: Add Initial CSRF Fetch Logic ---
// This function should be called ONCE when your application loads.
// Place the *call* to this function in your main App component or entry point.
export const initializeCsrf = async () => {
    try {
        // Make a GET request to the endpoint that sets the CSRF cookie
        await initializeCsrfToken();
    } catch (error) {
        // This might prevent subsequent state-changing requests from working
        // Silent fail - no need to alarm users with console errors
        toast.error('Could not initialize security token. Some actions may fail.');
    }
};

// 4. Export the instance
export default apiService;