import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app is served under a runtime path prefix (app.pellerex.com/proxy/{ProductName}/{env}/).
// Using a RELATIVE base ("./") makes every asset URL relative to index.html, so the SAME built
// image works under any prefix in QA, Staging and Prod — no per-environment rebuild (WA-D7).
// The router basename is resolved at runtime from window.location / env.js (see src/config/env.ts).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
