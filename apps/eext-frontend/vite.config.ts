import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function copyEntryPlugin(): any {
  return {
    name: 'copy-entry',
    buildStart() {
      const srcPath = path.resolve(__dirname, 'src/entry.ts');
      const destPath = path.resolve(__dirname, '../extension/src/index.ts');
      fs.copyFileSync(srcPath, destPath);
      console.log('[copy-entry] Copied entry.ts to extension/src/index.ts');
      
      const htmlSrc = path.resolve(__dirname, '../extension/iframe/index.html');
      const htmlDest = path.resolve(__dirname, '../extension/dist/index.html');
      fs.copyFileSync(htmlSrc, htmlDest);
      console.log('[copy-entry] Copied index.html to extension/dist/');
    },
  };
}

export default defineConfig({
  plugins: [react(), copyEntryPlugin()],
  base: '/',
  build: {
    outDir: '../extension/dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        iframe: path.resolve(__dirname, 'src/main.tsx'),
      },
      output: {
        entryFileNames: 'iframe.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'styles.css';
          }
          return '[name][extname]';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
