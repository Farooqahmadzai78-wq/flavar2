import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    spa: {
      enabled: false,
    },
    server: {
      entry: "server",
    },
    prerender: {
      enabled: false,
    },
  },
  nitro: {
    preset: "vercel",
    output: {
      dir: ".output",
      serverDir: ".output/server",
      publicDir: ".output/public",
    },
  },
});
