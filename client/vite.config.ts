import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4500,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4501',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4500,
    strictPort: true,
  },
});
