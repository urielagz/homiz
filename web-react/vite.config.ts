import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Mismos puertos de siempre: sitio y panel en 5500 (CORS de la API ya lo permite), app Homiz en 5600, API en 3000.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // /api pasa a la API del puerto 3000 (útil con VITE_API_URL=/api/v1: mismo origen, sin CORS)
  server: { host: true, port: 5500, strictPort: true, proxy: { '/api': 'http://localhost:3000' } },
  preview: { host: true, port: 5500, strictPort: true },
  // Dos páginas: el sitio público (index.html) y el panel (admin/index.html), cada una con su CSS
  build: {
    rollupOptions: {
      input: { sitio: 'index.html', panel: 'admin/index.html', acceso: 'admin/login.html' },
    },
  },
});
