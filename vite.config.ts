import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(__dirname, "node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx"),
          dest: "vad-assets"
        },
        {
          src: path.resolve(__dirname, "node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx"),
          dest: "vad-assets"
        },
        {
          src: path.resolve(__dirname, "node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js"),
          dest: "vad-assets"
        },
        {
          src: path.resolve(__dirname, "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm"),
          dest: "vad-assets"
        },
        {
          src: path.resolve(__dirname, "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs"),
          dest: "vad-assets"
        },
        {
          src: path.resolve(__dirname, "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm"),
          dest: "vad-assets"
        },
        {
          src: path.resolve(__dirname, "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs"),
          dest: "vad-assets"
        },
        {
          src: path.resolve(__dirname, "node_modules/onnxruntime-web/dist/ort.wasm.min.mjs"),
          dest: "vad-assets"
        },
      ]
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['wouter'],
          'query': ['@tanstack/react-query'],
          'ui-core': ['@radix-ui/react-slot', '@radix-ui/react-label', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          'framer': ['framer-motion'],
          'icons': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'wouter', '@tanstack/react-query'],
    exclude: ['@shared/schema'],
  },
  assetsInclude: ['**/*.onnx', '**/*.wasm'],
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
