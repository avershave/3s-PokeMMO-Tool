// vite.config.js
import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

export default defineConfig({
  // React Compiler (via Babel) memoises components and hooks automatically. A component that breaks
  // the Rules of React is skipped, not miscompiled, so it keeps working as written.
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  base: './', // required for Electron packaged paths
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version || '')
  }
});
