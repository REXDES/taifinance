import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Fallback publishable (anon) backend config. These are safe to ship to the
// browser and guarantee the app boots even if the .env file is missing from the
// build environment (a missing URL used to crash the whole app on load).
const FALLBACK_SUPABASE_URL = "https://ignhvbtqhcyxkwnsqpue.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnbmh2YnRxaGN5eGt3bnNxcHVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODY0NjQsImV4cCI6MjA4MjA2MjQ2NH0.Ln0hBVc-ZXtynLuTGF6u-6ngW7h8tNJGCmLIzK4S6vw";
const FALLBACK_SUPABASE_PROJECT_ID = "ignhvbtqhcyxkwnsqpue";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL,
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
      ),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
        env.VITE_SUPABASE_PROJECT_ID || FALLBACK_SUPABASE_PROJECT_ID,
      ),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
    },
  };
});
