import { str, num, bool, url, secret, port } from './validators/index.js'
import type { FieldSpec } from './types.js'

export const presets: Record<string, Record<string, FieldSpec>> = {
  node: {
    NODE_ENV: str({ choices: ['development', 'production', 'test', 'staging'], default: 'development' }),
    PORT: num({ default: 3000, integer: true }),
    HOST: str({ default: '0.0.0.0' }),
    LOG_LEVEL: str({ choices: ['debug', 'info', 'warn', 'error', 'fatal'], default: 'info', optional: true }),
  },

  railway: {
    PORT: num({ default: 3000, integer: true }),
    RAILWAY_ENVIRONMENT: str({ optional: true }),
    RAILWAY_SERVICE_NAME: str({ optional: true }),
    RAILWAY_PROJECT_NAME: str({ optional: true }),
  },

  vercel: {
    VERCEL: str({ optional: true }),
    VERCEL_ENV: str({ choices: ['production', 'preview', 'development'], optional: true }),
    VERCEL_URL: str({ optional: true }),
    VERCEL_REGION: str({ optional: true }),
    VERCEL_GIT_COMMIT_SHA: str({ optional: true }),
  },

  render: {
    PORT: num({ default: 10000, integer: true }),
    RENDER: str({ optional: true }),
    RENDER_SERVICE_NAME: str({ optional: true }),
    RENDER_EXTERNAL_URL: url({ optional: true }),
  },

  fly: {
    PORT: num({ default: 8080, integer: true }),
    FLY_APP_NAME: str({ optional: true }),
    FLY_REGION: str({ optional: true }),
    FLY_ALLOC_ID: str({ optional: true }),
  },

  netlify: {
    NETLIFY: str({ optional: true }),
    CONTEXT: str({ optional: true }),
    DEPLOY_URL: url({ optional: true }),
    URL: url({ optional: true }),
  },

  cloudflare: {
    CF_PAGES: str({ optional: true }),
    CF_PAGES_URL: url({ optional: true }),
    CF_PAGES_BRANCH: str({ optional: true }),
    CF_PAGES_COMMIT_SHA: str({ optional: true }),
  },

  supabase: {
    SUPABASE_URL: url({ requireTls: true }),
    SUPABASE_ANON_KEY: str(),
    SUPABASE_SERVICE_ROLE_KEY: secret({ optional: true }),
    SUPABASE_JWT_SECRET: secret({ optional: true, minLength: 32 }),
  },

  database: {
    DATABASE_URL: url(),
    DATABASE_POOL_MIN: num({ default: 2, integer: true, optional: true }),
    DATABASE_POOL_MAX: num({ default: 10, integer: true, optional: true }),
    DATABASE_SSL: bool({ default: true, optional: true }),
  },

  planetscale: {
    DATABASE_URL: url({ protocols: ['mysql'] }),
  },

  neon: {
    DATABASE_URL: url({ protocols: ['postgresql', 'postgres'] }),
    DATABASE_URL_UNPOOLED: url({ protocols: ['postgresql', 'postgres'], optional: true }),
  },

  upstash: {
    UPSTASH_REDIS_REST_URL: url({ requireTls: true }),
    UPSTASH_REDIS_REST_TOKEN: secret(),
  },

  stripe: {
    STRIPE_SECRET_KEY: secret(),
    STRIPE_PUBLISHABLE_KEY: str(),
    STRIPE_WEBHOOK_SECRET: secret({ optional: true }),
    STRIPE_PRICE_ID: str({ optional: true }),
  },

  lemonsqueezy: {
    LEMON_SQUEEZY_API_KEY: secret(),
    LEMON_SQUEEZY_WEBHOOK_SECRET: secret({ optional: true }),
    LEMON_SQUEEZY_STORE_ID: str({ optional: true }),
  },

  paystack: {
    PAYSTACK_SECRET_KEY: secret(),
    PAYSTACK_PUBLIC_KEY: str(),
  },

  aws: {
    AWS_ACCESS_KEY_ID: str(),
    AWS_SECRET_ACCESS_KEY: secret(),
    AWS_REGION: str({ default: 'us-east-1' }),
    AWS_S3_BUCKET: str({ optional: true }),
    AWS_S3_ENDPOINT: url({ optional: true }),
  },

  resend: {
    RESEND_API_KEY: secret(),
    EMAIL_FROM: str({ optional: true }),
    EMAIL_REPLY_TO: str({ optional: true }),
  },

  sendgrid: {
    SENDGRID_API_KEY: secret(),
    EMAIL_FROM: str({ optional: true }),
  },

  openai: {
    OPENAI_API_KEY: secret(),
    OPENAI_MODEL: str({ default: 'gpt-4o', optional: true }),
    OPENAI_ORG_ID: str({ optional: true }),
    OPENAI_BASE_URL: url({ optional: true }),
  },

  anthropic: {
    ANTHROPIC_API_KEY: secret(),
    ANTHROPIC_MODEL: str({ default: 'claude-sonnet-4-20250514', optional: true }),
  },

  clerk: {
    CLERK_SECRET_KEY: secret(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: str(),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: str({ default: '/sign-in', optional: true }),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: str({ default: '/sign-up', optional: true }),
  },

  auth: {
    JWT_SECRET: secret({ minLength: 32 }),
    JWT_EXPIRES_IN: str({ default: '7d', optional: true }),
    REFRESH_TOKEN_SECRET: secret({ optional: true, minLength: 32 }),
    SESSION_SECRET: secret({ optional: true, minLength: 32 }),
  },

  oauth: {
    GOOGLE_CLIENT_ID: str({ optional: true }),
    GOOGLE_CLIENT_SECRET: secret({ optional: true }),
    GITHUB_CLIENT_ID: str({ optional: true }),
    GITHUB_CLIENT_SECRET: secret({ optional: true }),
    DISCORD_CLIENT_ID: str({ optional: true }),
    DISCORD_CLIENT_SECRET: secret({ optional: true }),
  },

  twilio: {
    TWILIO_ACCOUNT_SID: str(),
    TWILIO_AUTH_TOKEN: secret(),
    TWILIO_PHONE_NUMBER: str({ optional: true }),
  },

  pusher: {
    PUSHER_APP_ID: str(),
    PUSHER_KEY: str(),
    PUSHER_SECRET: secret(),
    PUSHER_CLUSTER: str({ default: 'mt1' }),
    NEXT_PUBLIC_PUSHER_KEY: str({ optional: true }),
    NEXT_PUBLIC_PUSHER_CLUSTER: str({ optional: true }),
  },

  sentry: {
    SENTRY_DSN: url({ optional: true }),
    SENTRY_ORG: str({ optional: true }),
    SENTRY_PROJECT: str({ optional: true }),
    SENTRY_AUTH_TOKEN: secret({ optional: true }),
  },

  redis: {
    REDIS_URL: url({ protocols: ['redis', 'rediss'] }),
    REDIS_PASSWORD: secret({ optional: true }),
    REDIS_PORT: port({ default: 6379 }),
    REDIS_DB: num({ default: 0, integer: true, optional: true }),
  },

  mongodb: {
    MONGODB_URI: url({ protocols: ['mongodb', 'mongodb+srv'] }),
    MONGODB_DB_NAME: str({ optional: true }),
  },

  kafka: {
    KAFKA_BROKERS: str(),
    KAFKA_CLIENT_ID: str({ optional: true }),
    KAFKA_USERNAME: str({ optional: true }),
    KAFKA_PASSWORD: secret({ optional: true }),
  },

  debug: {
    DEBUG: bool({ default: false, optional: true }),
    VERBOSE: bool({ default: false, optional: true }),
    LOG_LEVEL: str({ choices: ['debug', 'info', 'warn', 'error'], default: 'info', optional: true }),
  },
}
