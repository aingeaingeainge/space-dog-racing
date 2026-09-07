import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Art is never inlined into the JS bundle. Vite's default is to fold anything under 4 kB
    // into a data: URL, which would have swallowed most of the placeholder set and, later, any
    // small icon or tile — the bundle is what every player downloads before they see anything,
    // and images are meant to arrive lazily and per planet (design/ASSET_LIST.md).
    assetsInlineLimit: 0,
  },
});
