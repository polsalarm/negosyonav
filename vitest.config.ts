import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

const alias = {
  "@": path.resolve(templateRoot, "client", "src"),
  "@shared": path.resolve(templateRoot, "shared"),
  "@assets": path.resolve(templateRoot, "attached_assets"),
};

export default defineConfig({
  root: templateRoot,
  resolve: { alias },
  esbuild: { jsx: "automatic" },
  test: {
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/**/*.test.ts",
      "client/**/*.test.tsx",
    ],
    environmentMatchGlobs: [
      ["client/**", "jsdom"],
      ["server/**", "node"],
    ],
    setupFiles: ["client/test/setup.ts"],
  },
});
