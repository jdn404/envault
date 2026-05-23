import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'plugins/next': 'src/plugins/next.ts',
    'plugins/vite': 'src/plugins/vite.ts',
  },
  format: ['esm', 'cjs'],
  dts: false,
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
})
EO
