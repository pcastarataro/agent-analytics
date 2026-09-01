import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/plugin.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  outDir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node20',
  splitting: false,
  treeshake: true,
  sourcemap: false,
  minify: false,
  noExternal: [/@agent-analytics\//, 'zod'],
});
