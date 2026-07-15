import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Web Audio's getUserMedia requires a secure context.
    // When accessing from another device on your network, use HTTPS or
    // open the dev server on https://localhost.
  },
});
