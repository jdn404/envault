import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    presets: 'src/presets.ts',
    'plugins/next': 'src/plugins/next.ts',
    'plugins/vite': 'src/plugins/vite.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  treeshake: true,
  target: 'node18',
})
