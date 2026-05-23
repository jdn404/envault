import { str, num, bool, url } from './validators/index.js'
import type { FieldSpec } from './types.js'

export const presets: Record<string, Record<string, FieldSpec>> = {
  railway: {
    PORT: num({ default: 3000, description: 'Railway assigned port' }),
    RAILWAY_ENVIRONMENT: str({ optional: true, description: 'Railway environment name' }),
    RAILWAY_SERVICE_NAME: str({ optional: true, description: 'Railway service name' }),
    RAILWAY_PROJECT_NAME: str({ optional: true, description: 'Railway project name' }),
  },

  vercel: {
    VERCEL: str({ optional: true, description: 'Set to 1 in Vercel deployments' }),
    VERCEL_ENV: str({ choices: ['production', 'preview', 'development'], optional: true, description: 'Vercel environment' }),
    VERCEL_URL: str({ optional: true, description: 'Auto-generated deployment URL' }),
    VERCEL_REGION: str({ optional: true, description: 'Vercel region' }),
  },

  render: {
    PORT: num({ default: 10000, description: 'Render assigned port' }),
    RENDER: str({ optional: true, description: 'Set to true in Render deployments' }),
    RENDER_SERVICE_NAME: str({ optional: true, description: 'Render service name' }),
    RENDER_EXTERNAL_URL: url({ optional: true, description: 'External URL of the Render service' }),
  },

  fly: {
    PORT: num({ default: 8080, description: 'Fly.io assigned port' }),
    FLY_APP_NAME: str({ optional: true, description: 'Fly.io app name' }),
    FLY_REGION: str({ optional: true, description: 'Fly.io region' }),
    FLY_ALLOC_ID: str({ optional: true, description: 'Fly.io allocation ID' }),
  },

  netlify: {
    NETLIFY: str({ optional: true, description: 'Set to true in Netlify deployments' }),
    CONTEXT: str({ optional: true, description: 'Netlify deploy context' }),
    DEPLOY_URL: url({ optional: true, description: 'Netlify deploy URL' }),
    URL: url({ optional: true, description: 'Netlify site URL' }),
  },

  cloudflare: {
    CF_PAGES: str({ optional: true, description: 'Set to 1 in Cloudflare Pages' }),
    CF_PAGES_URL: url({ optional: true, description: 'Cloudflare Pages URL' }),
    CF_PAGES_BRANCH: str({ optional: true, description: 'Cloudflare Pages branch' }),
    CF_PAGES_COMMIT_SHA: str({ optional: true, description: 'Cloudflare Pages commit SHA' }),
  },

  supabase: {
    SUPABASE_URL: url({ description: 'Supabase project URL' }),
    SUPABASE_ANON_KEY: str({ description: 'Supabase anon/public key' }),
    SUPABASE_SERVICE_ROLE_KEY: str({ optional: true, description: 'Supabase service role key (server only)' }),
  },

  planetscale: {
    DATABASE_URL: url({ protocols: ['mysql'], description: 'PlanetScale connection URL' }),
  },

  upstash: {
    UPSTASH_REDIS_REST_URL: url({ description: 'Upstash Redis REST URL' }),
    UPSTASH_REDIS_REST_TOKEN: str({ description: 'Upstash Redis REST token' }),
  },

  stripe: {
    STRIPE_SECRET_KEY: str({ description: 'Stripe secret key' }),
    STRIPE_PUBLISHABLE_KEY: str({ description: 'Stripe publishable key' }),
    STRIPE_WEBHOOK_SECRET: str({ optional: true, description: 'Stripe webhook signing secret' }),
  },

  aws: {
    AWS_ACCESS_KEY_ID: str({ description: 'AWS access key ID' }),
    AWS_SECRET_ACCESS_KEY: str({ description: 'AWS secret access key' }),
    AWS_REGION: str({ default: 'us-east-1', description: 'AWS region' }),
    AWS_S3_BUCKET: str({ optional: true, description: 'AWS S3 bucket name' }),
  },

  node: {
    NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development', description: 'Node environment' }),
    PORT: num({ default: 3000, description: 'HTTP server port' }),
    HOST: str({ default: '0.0.0.0', description: 'Server host' }),
    LOG_LEVEL: str({ choices: ['debug', 'info', 'warn', 'error'], default: 'info', optional: true, description: 'Log level' }),
  },

  database: {
    DATABASE_URL: url({ description: 'Database connection URL' }),
    DATABASE_POOL_MIN: num({ default: 2, optional: true, description: 'Minimum connection pool size' }),
    DATABASE_POOL_MAX: num({ default: 10, optional: true, description: 'Maximum connection pool size' }),
  },

  resend: {
    RESEND_API_KEY: str({ description: 'Resend API key' }),
    EMAIL_FROM: str({ optional: true, description: 'Default from email address' }),
  },

  openai: {
    OPENAI_API_KEY: str({ description: 'OpenAI API key' }),
    OPENAI_MODEL: str({ default: 'gpt-4o', optional: true, description: 'OpenAI model to use' }),
  },

  clerk: {
    CLERK_SECRET_KEY: str({ description: 'Clerk secret key' }),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: str({ description: 'Clerk publishable key' }),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: str({ default: '/sign-in', optional: true }),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: str({ default: '/sign-up', optional: true }),
  },

  auth: {
    JWT_SECRET: str({ minLength: 32, description: 'JWT signing secret' }),
    JWT_EXPIRES_IN: str({ default: '7d', optional: true, description: 'JWT expiry duration' }),
    REFRESH_TOKEN_SECRET: str({ optional: true, description: 'Refresh token secret' }),
  },

  debug: {
    DEBUG: bool({ default: false, optional: true, description: 'Enable debug mode' }),
    VERBOSE: bool({ default: false, optional: true, description: 'Enable verbose logging' }),
  },
}
