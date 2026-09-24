const { defineConfig, loadEnv } = require("vite");
const react = require("@vitejs/plugin-react");

module.exports = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL || "http://localhost:4317";

  return {
    root: "app",
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": apiUrl
      }
    }
  };
});
