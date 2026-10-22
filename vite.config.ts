import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        agb: resolve(__dirname, 'agb.html'),
        datenschutz: resolve(__dirname, 'datenschutz.html'),
        impressum: resolve(__dirname, 'impressum.html'),
        sitemap: resolve(__dirname, 'sitemap.html'),
      },
    },
  },
  plugins: [
    {
      name: 'copy-static-assets',
      closeBundle() {
        if (fs.existsSync('img')) {
          fs.cpSync('img', 'dist/img', { recursive: true });
        }
        if (fs.existsSync('robots.txt')) {
          fs.copyFileSync('robots.txt', 'dist/robots.txt');
        }
        if (fs.existsSync('sitemap.xml')) {
          fs.copyFileSync('sitemap.xml', 'dist/sitemap.xml');
        }
      },
    },
  ],
  server: {
    port: 3000,
    open: false,
  },
  css: {
    devSourcemap: true,
  },
});
