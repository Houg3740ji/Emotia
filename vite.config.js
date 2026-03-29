import { defineConfig } from 'vite';

export default defineConfig({
  // El root es la raíz del proyecto
  // index.html vive aquí, src/ contiene los módulos JS
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Generar sourcemaps para debug en desarrollo
    sourcemap: false,
  },
  // Vite carga automáticamente .env y expone variables VITE_* al cliente
  // Las variables se acceden como: import.meta.env.VITE_SUPABASE_URL
  server: {
    port: 5173,
    host: true,
  },
});
