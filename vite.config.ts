import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps asset URLs relative so the build works on Vercel, Netlify
// and GitHub Pages project sites (https://user.github.io/repo/) without edits.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
  },
});
