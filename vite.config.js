const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const path = require("path");

module.exports = defineConfig({
  root: path.resolve(__dirname, "src/renderer"),
  // Required for file:// loading inside the packaged Electron app.
  // Without this, Vite emits /assets/... absolute paths and the production window is blank.
  base: "./",
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
  },
});
