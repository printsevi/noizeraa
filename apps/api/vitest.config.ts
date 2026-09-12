import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest's default esbuild transform doesn't emit decorator metadata,
  // which Nest's DI needs to resolve constructor parameters. SWC does.
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["src/**/*.spec.ts"],
  },
});
