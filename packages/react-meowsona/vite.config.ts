import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dts({ tsconfigPath: "./tsconfig.app.json" })],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "react-meowsona",
    },
    rolldownOptions: {
      external: [/^react/, /^meowsona/, /^@stencil\//],
    },
  },
});
