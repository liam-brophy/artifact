import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Add this proxy configuration
    proxy: {
      // String shorthand: '/api' requests are proxied to 'http://localhost:5000/api'
      // '/api': 'http://localhost:5000', // Simple way if paths match
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true, // Recommended for virtual hosted sites
        // Optional: rewrite path if needed, but often not necessary if backend routes also start with /api
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});