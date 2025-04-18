// Use environment variable for API base URL, fallback to localhost for development
export const API_BASE_URL = import.meta.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';