import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { pathToFileURL } from 'node:url';

export default defineConfig({
  plugins: [react(), {
    name: 'engine-test-file-url', enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/vicky/company/company.test.ts')) return;
      return code.replaceAll('import.meta.url', JSON.stringify(pathToFileURL(id).href));
    },
  }],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
