import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.VITE_BACKEND_TARGET || process.env.GATEWAY_TARGET || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_NETRA_ADMIN_TOKEN': JSON.stringify(
      process.env.VITE_NETRA_ADMIN_TOKEN || process.env.NETRA_ADMIN_TOKEN || ''
    ),
  },
  envPrefix: ['VITE_', 'NETRA_'],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-analytics': ['@vercel/analytics/react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/v1': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/admin': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/health': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});

