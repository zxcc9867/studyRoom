import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");
          if (!normalizedId.includes("/node_modules/")) return undefined;
          if (normalizedId.includes("/three/")) return "three";
          if (normalizedId.includes("/@supabase/")) return "supabase";
          if (normalizedId.includes("/@mediapipe/")) return "vision";
          if (
            normalizedId.includes("/react/") ||
            normalizedId.includes("/react-dom/") ||
            normalizedId.includes("/scheduler/")
          ) {
            return "react";
          }
          return undefined;
        },
      },
    },
  },
});
