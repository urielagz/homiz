import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Mismos puertos de siempre: sitio y panel en 5500 (CORS de la API ya lo permite), app Homiz en 5600, API en 3000.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5500, strictPort: true },
  preview: { host: true, port: 5500, strictPort: true },
});
