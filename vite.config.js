import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Single config for both the dev server (Vite) and the test runner (Vitest).
// The v0 prototype is one self-contained file mounted by main.jsx; tests import
// its named logic exports and mount the component under jsdom.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.{js,jsx}"],
  },
});
