import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index:          'src/index.ts',
    presets:        'src/presets.ts',
    edge:           'src/edge.ts',
    crypto:         'src/crypto.ts',
    health:         'src/health.ts',
    docs:           'src/docs.ts',
    migrate:        'src/migrate.ts',
    monorepo:       'src/monorepo.ts',
    watch:          'src/watch.ts',
    onboard:        'src/onboard.ts',
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
  external: ['fs', 'path', 'crypto', 'http', 'https', 'net', 'dns', 'child_process', 'os', 'stream'],
})
