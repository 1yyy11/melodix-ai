// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react";
// import tailwindcss from "@tailwindcss/vite";
// import path from "path";
// import { useAuth } from "@/contexts/AuthContext";

// const rawPort = process.env.PORT;

// if (!rawPort) {
//   throw new Error(
//     "PORT environment variable is required but was not provided.",
//   );
// }

// const port = Number(rawPort);

// if (Number.isNaN(port) || port <= 0) {
//   throw new Error(`Invalid PORT value: "${rawPort}"`);
// }

// const basePath = process.env.BASE_PATH;

// if (!basePath) {
//   throw new Error(
//     "BASE_PATH environment variable is required but was not provided.",
//   );
// }

// export default defineConfig({
//   base: basePath,
//   plugins: [
//     react(),
//     tailwindcss(),
   
//     ...(process.env.NODE_ENV !== "production" &&
//     process.env.REPL_ID !== undefined
//       ? [
//           await import("@replit/vite-plugin-cartographer").then((m) =>
//             m.cartographer({
//               root: path.resolve(import.meta.dirname, ".."),
//             }),
//           ),
//           await import("@replit/vite-plugin-dev-banner").then((m) =>
//             m.devBanner(),
//           ),
//         ]
//       : []),
//   ],
//   resolve: {
//     alias: {
//       "@": path.resolve(import.meta.dirname, "src"),
//       "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
//         "@workspace/api-client-react": path.resolve(import.meta.dirname, "workspace-stubs/api-client-react.js"),
//     },
//     dedupe: ["react", "react-dom"],
//   },
//   root: path.resolve(import.meta.dirname),
//   build: {
//     outDir: path.resolve(import.meta.dirname, "dist/public"),
//     emptyOutDir: true,
//   },
//   server: {
//     port: 3000,
//     host: '0.0.0.0',  // уже есть
//     proxy: {
      
//         '/api': {
//             target: 'http://localhost:3001',
//             changeOrigin: true,
//             // Добавьте это:
//             configure: (proxy, options) => {
//                 proxy.on('error', (err, req, res) => {
//                     console.log('proxy error', err);
//                 });
//                 proxy.on('proxyReq', (proxyReq, req, res) => {
//                     console.log('Proxying:', req.method, req.url);
//                 });
//             },
//         },
        
//     },
// },
//   preview: {
//     port,
//     host: "0.0.0.0",
//     allowedHosts: true,
//   },
// });

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@workspace/api-client-react': path.resolve(__dirname, './src/lib/api-client.ts'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
       '/audio': {                    // <--- ДОБАВЬТЕ ЭТОТ БЛОК
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});