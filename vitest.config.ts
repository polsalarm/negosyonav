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
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "client",
          environment: "jsdom",
          include: ["client/**/*.test.ts", "client/**/*.test.tsx"],
          setupFiles: ["client/test/setup.ts"],
          globals: false,
        },
      },
    ],
  },
});
