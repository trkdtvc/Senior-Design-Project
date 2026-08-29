import process from "node:process";
import { URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const validateProductionApiUrl = (mode, env) => {
  if (mode !== "production") {
    return;
  }

  const apiUrl = env.VITE_API_URL?.trim();

  if (!apiUrl) {
    throw new Error(
      "VITE_API_URL is required for production builds. Copy .env.example to .env and set the deployed backend API URL."
    );
  }

  if (apiUrl.startsWith("/") && !apiUrl.startsWith("//")) {
    return;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw new Error(
      "VITE_API_URL must be an absolute http(s) URL or a root-relative path such as /api."
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("VITE_API_URL must use http:// or https://.");
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  validateProductionApiUrl(mode, env);

  return {
    plugins: [react()]
  };
});
