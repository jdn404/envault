import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

export interface DetectedStack {
  framework?: string
  runtime?: string
  database?: string[]
  services?: string[]
  platform?: string
  language: 'typescript' | 'javascript'
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun'
}

export interface OnboardResult {
  stack: DetectedStack
  generatedSchema: string
  generatedEnvExample: string
  envTsPath: string
  envExamplePath: string
  presets: string[]
  message: string
}

const FRAMEWORK_DEPS: Record<string, string> = {
  next: 'next',
  vite: 'vite',
  remix: '@remix-run/node',
  astro: 'astro',
  nuxt: 'nuxt',
  sveltekit: '@sveltejs/kit',
  express: 'express',
  fastify: 'fastify',
  nestjs: '@nestjs/core',
  hono: 'hono',
  elysia: 'elysia',
  koa: 'koa',
  'socket.io': 'socket.io',
}

const DATABASE_DEPS: Record<string, string> = {
  prisma: '@prisma/client',
  drizzle: 'drizzle-orm',
  mongoose: 'mongoose',
  sequelize: 'sequelize',
  knex: 'knex',
  typeorm: 'typeorm',
  pg: 'pg',
  mysql2: 'mysql2',
  'better-sqlite3': 'better-sqlite3',
  redis: 'ioredis',
}

const SERVICE_DEPS: Record<string, string> = {
  supabase: '@supabase/supabase-js',
  stripe: 'stripe',
  clerk: '@clerk/nextjs',
  openai: 'openai',
  anthropic: '@anthropic-ai/sdk',
  resend: 'resend',
  sendgrid: '@sendgrid/mail',
  twilio: 'twilio',
  sentry: '@sentry/node',
  pusher: 'pusher',
  upstash: '@upstash/redis',
  cloudinary: 'cloudinary',
  aws: '@aws-sdk/client-s3',
  firebase: 'firebase-admin',
  planetscale: '@planetscale/database',
  neon: '@neondatabase/serverless',
  turso: '@libsql/client',
  lemon: '@lemonsqueezy/lemonsqueezy.js',
  paystack: 'paystack',
  posthog: 'posthog-node',
  mixpanel: 'mixpanel',
}

const PLATFORM_FILES: Record<string, string> = {
  vercel: 'vercel.json',
  netlify: 'netlify.toml',
  fly: 'fly.toml',
  railway: 'railway.toml',
  render: 'render.yaml',
  cloudflare: 'wrangler.toml',
}

function detectPackageManager(cwd: string): DetectedStack['packageManager'] {
  if (existsSync(join(cwd, 'bun.lockb'))) return 'bun'
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

function readPackageJson(cwd: string): Record<string, unknown> {
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return {}
  try { return JSON.parse(readFileSync(pkgPath, 'utf-8')) } catch { return {} }
}

function getAllDeps(pkg: Record<string, unknown>): Record<string, string> {
  return {
    ...((pkg.dependencies ?? {}) as Record<string, string>),
    ...((pkg.devDependencies ?? {}) as Record<string, string>),
    ...((pkg.peerDependencies ?? {}) as Record<string, string>),
  }
}

export function detectStack(cwd: string = process.cwd()): DetectedStack {
  const pkg = readPackageJson(cwd)
  const deps = getAllDeps(pkg)
  const allDepNames = Object.keys(deps)
  const packageManager = detectPackageManager(cwd)
  const isTypeScript = existsSync(join(cwd, 'tsconfig.json')) || allDepNames.includes('typescript')

  let framework: string | undefined
  for (const [name, dep] of Object.entries(FRAMEWORK_DEPS)) {
    if (allDepNames.includes(dep)) { framework = name; break }
  }

  const databases: string[] = []
  for (const [name, dep] of Object.entries(DATABASE_DEPS)) {
    if (allDepNames.includes(dep)) databases.push(name)
  }

  const services: string[] = []
  for (const [name, dep] of Object.entries(SERVICE_DEPS)) {
    if (allDepNames.includes(dep)) services.push(name)
  }

  let platform: string | undefined
  for (const [name, file] of Object.entries(PLATFORM_FILES)) {
    if (existsSync(join(cwd, file))) { platform = name; break }
  }

  return {
    framework,
    database: databases,
    services,
    platform,
    language: isTypeScript ? 'typescript' : 'javascript',
    packageManager,
  }
}

function getPresetNames(stack: DetectedStack): string[] {
  const presets: string[] = []

  if (stack.platform === 'railway') presets.push('railway')
  else if (stack.platform === 'vercel') presets.push('vercel')
  else if (stack.platform === 'fly') presets.push('fly')
  else if (stack.platform === 'render') presets.push('render')
  else if (stack.platform === 'netlify') presets.push('netlify')
  else presets.push('node')

  if (stack.database?.includes('supabase') || stack.services?.includes('supabase')) presets.push('supabase')
  if (stack.database?.includes('pg') || stack.database?.includes('prisma') || stack.database?.includes('drizzle')) presets.push('database')
  if (stack.database?.includes('redis')) presets.push('redis')
  if (stack.database?.includes('mongoose')) presets.push('mongodb')
  if (stack.services?.includes('stripe')) presets.push('stripe')
  if (stack.services?.includes('clerk')) presets.push('clerk')
  else if (stack.framework) presets.push('auth')
  if (stack.services?.includes('openai')) presets.push('openai')
  if (stack.services?.includes('anthropic')) presets.push('anthropic')
  if (stack.services?.includes('resend')) presets.push('resend')
  else if (stack.services?.includes('sendgrid')) presets.push('sendgrid')
  if (stack.services?.includes('upstash')) presets.push('upstash')
  if (stack.services?.includes('sentry')) presets.push('sentry')
  if (stack.services?.includes('pusher')) presets.push('pusher')
  if (stack.services?.includes('lemon')) presets.push('lemonsqueezy')
  if (stack.services?.includes('paystack')) presets.push('paystack')
  if (stack.services?.includes('aws')) presets.push('aws')

  return [...new Set(presets)]
}

function generateSchemaFile(stack: DetectedStack, presets: string[], ext: string): string {
  const importPath = '@jadendev/envault'
  const isNext = stack.framework === 'next'
  const isVite = stack.framework === 'vite'

  const lines: string[] = []

  if (isNext) {
    lines.push(`import { createNextEnv, str, num, bool, url, port, email, secret, list, enm } from '${importPath}/next'`)
    lines.push(`import { presets } from '${importPath}/presets'`)
    lines.push('')
    lines.push(`export const env = createNextEnv({`)
    lines.push(`  server: {`)
    for (const preset of presets.filter(p => !['vercel', 'netlify', 'cloudflare'].includes(p))) {
      lines.push(`    ...presets.${preset},`)
    }
    lines.push(`  },`)
    lines.push(`  client: {`)
    lines.push(`    NEXT_PUBLIC_APP_URL: url(),`)
    lines.push(`  },`)
    lines.push(`})`)
  } else if (isVite) {
    lines.push(`import { createEnv, str, num, bool, url, port, email, secret, list, enm } from '${importPath}/vite'`)
    lines.push(`import { presets } from '${importPath}/presets'`)
    lines.push('')
    lines.push(`export const env = createEnv({`)
    for (const preset of presets) {
      lines.push(`  ...presets.${preset},`)
    }
    lines.push(`  VITE_APP_TITLE: str({ default: 'My App' }),`)
    lines.push(`  VITE_API_URL: url({ optional: true }),`)
    lines.push(`})`)
  } else {
    lines.push(`import { envault, str, num, bool, url, port, email, secret, list, enm } from '${importPath}'`)
    lines.push(`import { presets } from '${importPath}/presets'`)
    lines.push('')
    lines.push(`export const env = envault({`)
    for (const preset of presets) {
      lines.push(`  ...presets.${preset},`)
    }
    lines.push(`})`)
  }

  lines.push('')
  return lines.join('\n')
}

function generateExampleFile(presets: string[]): string {
  const lines: string[] = [
    '# Generated by envault',
    `# ${new Date().toISOString()}`,
    '',
  ]

  const presetVars: Record<string, Record<string, string>> = {
    node: { NODE_ENV: 'development', PORT: '3000', HOST: '0.0.0.0' },
    database: { DATABASE_URL: 'postgresql://user:pass@localhost:5432/mydb' },
    redis: { REDIS_URL: 'redis://localhost:6379' },
    mongodb: { MONGODB_URI: 'mongodb://localhost:27017/mydb' },
    supabase: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '' },
    stripe: { STRIPE_SECRET_KEY: '', STRIPE_PUBLISHABLE_KEY: '', STRIPE_WEBHOOK_SECRET: '' },
    clerk: { CLERK_SECRET_KEY: '', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '' },
    auth: { JWT_SECRET: '', JWT_EXPIRES_IN: '7d' },
    openai: { OPENAI_API_KEY: '', OPENAI_MODEL: 'gpt-4o' },
    anthropic: { ANTHROPIC_API_KEY: '', ANTHROPIC_MODEL: 'claude-sonnet-4-20250514' },
    resend: { RESEND_API_KEY: '', EMAIL_FROM: 'noreply@example.com' },
    sendgrid: { SENDGRID_API_KEY: '', EMAIL_FROM: 'noreply@example.com' },
    sentry: { SENTRY_DSN: '' },
    upstash: { UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' },
    aws: { AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: '', AWS_REGION: 'us-east-1' },
    railway: { PORT: '3000' },
    vercel: { VERCEL_URL: '' },
  }

  for (const preset of presets) {
    const vars = presetVars[preset]
    if (!vars) continue
    lines.push(`# ${preset.toUpperCase()}`)
    for (const [key, val] of Object.entries(vars)) {
      lines.push(`${key}=${val}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function onboard(cwd: string = process.cwd()): OnboardResult {
  const stack = detectStack(cwd)
  const presets = getPresetNames(stack)
  const ext = stack.language === 'typescript' ? 'ts' : 'js'
  const envTsPath = join(cwd, `env.${ext}`)
  const envExamplePath = join(cwd, '.env.example')

  const generatedSchema = generateSchemaFile(stack, presets, ext)
  const generatedEnvExample = generateExampleFile(presets)

  const detectedItems = [
    stack.framework ? `Framework: ${stack.framework}` : null,
    stack.database?.length ? `Databases: ${stack.database.join(', ')}` : null,
    stack.services?.length ? `Services: ${stack.services.join(', ')}` : null,
    stack.platform ? `Platform: ${stack.platform}` : null,
  ].filter(Boolean)

  const message = [
    `Detected ${stack.language === 'typescript' ? 'TypeScript' : 'JavaScript'} project`,
    ...detectedItems,
    `Generated ${presets.length} preset${presets.length !== 1 ? 's' : ''}: ${presets.join(', ')}`,
  ].join('\n  ')

  return { stack, generatedSchema, generatedEnvExample, envTsPath, envExamplePath, presets, message }
}

export function writeOnboardFiles(result: OnboardResult, overwrite: boolean = false): { schemaWritten: boolean; exampleWritten: boolean } {
  let schemaWritten = false
  let exampleWritten = false

  if (overwrite || !existsSync(result.envTsPath)) {
    writeFileSync(result.envTsPath, result.generatedSchema, 'utf-8')
    schemaWritten = true
  }

  if (overwrite || !existsSync(result.envExamplePath)) {
    writeFileSync(result.envExamplePath, result.generatedEnvExample, 'utf-8')
    exampleWritten = true
  }

  return { schemaWritten, exampleWritten }
}
