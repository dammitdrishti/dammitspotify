import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: {
      port: 5000,
      host: "0.0.0.0",
      allowedHosts: [
        "054b2b25-7d24-4785-af83-0b5c07e3e027-00-25z67ey8dxjtc.pike.replit.dev",
        "054b2b25-7d24-4785-af83-0b5c07e3e027-00-25z67ey8dxjtc.pike.replit.dev",
        
      ], // <--- CHANGED TO 'true' (simpler & safer for Replit)
      hmr: {
        clientPort: 443,
      },
    },
    plugins: [react()],
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
