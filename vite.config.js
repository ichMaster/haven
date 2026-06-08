import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Single config for both the dev server (Vite) and the test runner (Vitest).
// The v0 prototype is one self-contained file mounted by main.jsx; tests import
// its named logic exports and mount the component under jsdom.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        // The Anthropic SDK's environment worker dynamically imports a Node-only
        // agent-toolset (node:fs / node:path) that never runs in this
        // frontend-only chat client. Stub it so the browser bundle builds.
        find: /^.*tools\/agent-toolset\/node(\.mjs)?$/,
        replacement: fileURLToPath(new URL("./stubs/empty.mjs", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.{js,jsx}"],
  },
});
