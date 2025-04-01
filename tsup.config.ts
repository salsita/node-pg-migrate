import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  clean: true,
  format: 'esm',
  target: ['es2023', 'node20'],
  dts: false,
  minify: false,
  sourcemap: false,
  bundle: true,
});
