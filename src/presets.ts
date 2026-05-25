import { str, num, bool, url, secret, port, email, ip, semver, list } from './validators/index.js'
import type { FieldSpec } from './types.js'

export const presets: Record<string, Record<string, FieldSpec>> = {
  node: {
    NODE_ENV:  str({ choices: ['development', 'production', 'test', 'staging'], default: 'development', description: 'Runtime environment' }),
    PORT:      num({ default: 3000, integer: true, min: 1, max: 65535, description: 'HTTP server port' }),
    HOST:      str({ default: '0.0.0.0', description: 'Server bind address' }),
    LOG_LEVEL: str({ choices: ['debug', 'info', 'warn', 'error', 'fatal', 'silent'], default: 'info', optional: true, description: 'Logging level' }),
    TZ:        str({ default: 'UTC', optional: true, description: 'Server timezone' }),
  },

  railway: {
    PORT:                  num({ default: 3000, integer: true }),
    RAILWAY_ENVIRONMENT:   str({ optional: true }),
    RAILWAY_SERVICE_NAME:  str({ optional: true }),
    RAILWAY_PROJECT_NAME:  str({ optional: true }),
    RAILWAY_SERVICE_ID:    str({ optional: true }),
    RAILWAY_PROJECT_ID:    str({ optional: true }),
    RAILWAY_STATIC_URL:    url({ optional: true }),
  },

  vercel: {
    VERCEL:                str({ optional: true }),
    VERCEL_ENV:            str({ choices: ['production', 'preview', 'development'], optional: true }),
    VERCEL_URL:            str({ optional: true }),
    VERCEL_REGION:         str({ optional: true }),
    VERCEL_GIT_COMMIT_SHA: str({ optional: true }),
    VERCEL_GIT_COMMIT_REF: str({ optional: true }),
    VERCEL_GIT_REPO_SLUG:  str({ optional: true }),
    VERCEL_GIT_REPO_OWNER: str({ optional: true }),
  },

  render: {
    PORT:               num({ default: 10000, integer: true }),
    RENDER:             str({ optional: true }),
    RENDER_SERVICE_NAME: str({ optional: true }),
    RENDER_EXTERNAL_URL: url({ optional: true }),
    RENDER_GIT_BRANCH:   str({ optional: true }),
    RENDER_GIT_COMMIT:   str({ optional: true }),
  },

  fly: {
    PORT:          num({ default: 8080, integer: true }),
    FLY_APP_NAME:  str({ optional: true }),
    FLY_REGION:    str({ optional: true }),
    FLY_ALLOC_ID:  str({ optional: true }),
    FLY_IMAGE_REF: str({ optional: true }),
    FLY_PUBLIC_IP: ip({ optional: true }),
  },

  netlify: {
    NETLIFY:      str({ optional: true }),
    CONTEXT:      str({ optional: true }),
    DEPLOY_URL:   url({ optional: true }),
    URL:          url({ optional: true }),
    BRANCH:       str({ optional: true }),
    DEPLOY_ID:    str({ optional: true }),
    SITE_ID:      str({ optional: true }),
    SITE_NAME:    str({ optional: true }),
  },

  cloudflare: {
    CF_PAGES:            str({ optional: true }),
    CF_PAGES_URL:        url({ optional: true }),
    CF_PAGES_BRANCH:     str({ optional: true }),
    CF_PAGES_COMMIT_SHA: str({ optional: true }),
  },

  heroku: {
    PORT:             num({ default: 5000, integer: true }),
    DYNO:             str({ optional: true }),
    HEROKU_APP_NAME:  str({ optional: true }),
    HEROKU_SLUG_COMMIT: str({ optional: true }),
  },

  digitalocean: {
    APP_URL:      url({ optional: true }),
    APP_NAME:     str({ optional: true }),
    APP_ID:       str({ optional: true }),
    REGION:       str({ optional: true }),
  },

  supabase: {
    SUPABASE_URL:              url({ requireTls: true, description: 'Supabase project URL' }),
    SUPABASE_ANON_KEY:         str({ description: 'Supabase anonymous key' }),
    SUPABASE_SERVICE_ROLE_KEY: secret({ optional: true, description: 'Supabase service role key — never expose to client' }),
    SUPABASE_JWT_SECRET:       secret({ optional: true, minLength: 32, description: 'Supabase JWT secret' }),
    SUPABASE_DB_URL:           url({ optional: true, protocols: ['postgresql', 'postgres'], description: 'Direct Postgres connection URL' }),
  },

  database: {
    DATABASE_URL:      url({ description: 'Primary database connection URL' }),
    DATABASE_POOL_MIN: num({ default: 2, integer: true, optional: true, description: 'Minimum connection pool size' }),
    DATABASE_POOL_MAX: num({ default: 10, integer: true, optional: true, description: 'Maximum connection pool size' }),
    DATABASE_SSL:      bool({ default: true, optional: true, description: 'Enable SSL for database connection' }),
    DATABASE_TIMEOUT:  num({ default: 5000, integer: true, optional: true, description: 'Connection timeout in ms' }),
  },

  postgres: {
    POSTGRES_URL:      url({ protocols: ['postgresql', 'postgres'] }),
    POSTGRES_USER:     str({ optional: true }),
    POSTGRES_PASSWORD: secret({ optional: true }),
    POSTGRES_DB:       str({ optional: true }),
    POSTGRES_HOST:     str({ optional: true }),
    POSTGRES_PORT:     port({ default: 5432, optional: true }),
  },

  mysql: {
    MYSQL_URL:      url({ protocols: ['mysql'] }),
    MYSQL_USER:     str({ optional: true }),
    MYSQL_PASSWORD: secret({ optional: true }),
    MYSQL_DATABASE: str({ optional: true }),
    MYSQL_HOST:     str({ optional: true }),
    MYSQL_PORT:     port({ default: 3306, optional: true }),
  },

  planetscale: {
    DATABASE_URL:              url({ protocols: ['mysql'], description: 'PlanetScale database URL' }),
    PLANETSCALE_SERVICE_TOKEN: secret({ optional: true }),
    PLANETSCALE_ORG:           str({ optional: true }),
    PLANETSCALE_DB:            str({ optional: true }),
  },

  neon: {
    DATABASE_URL:          url({ protocols: ['postgresql', 'postgres'], description: 'Neon pooled connection URL' }),
    DATABASE_URL_UNPOOLED: url({ protocols: ['postgresql', 'postgres'], optional: true, description: 'Neon direct connection URL' }),
    PGHOST:                str({ optional: true }),
    PGDATABASE:            str({ optional: true }),
    PGUSER:                str({ optional: true }),
    PGPASSWORD:            secret({ optional: true }),
  },

  turso: {
    TURSO_DATABASE_URL:  url({ protocols: ['libsql', 'https', 'http'] }),
    TURSO_AUTH_TOKEN:    secret(),
  },

  mongodb: {
    MONGODB_URI:     url({ protocols: ['mongodb', 'mongodb+srv'], description: 'MongoDB connection URI' }),
    MONGODB_DB_NAME: str({ optional: true }),
    MONGODB_USER:    str({ optional: true }),
    MONGODB_PASS:    secret({ optional: true }),
  },

  redis: {
    REDIS_URL:      url({ protocols: ['redis', 'rediss'], description: 'Redis connection URL' }),
    REDIS_PASSWORD: secret({ optional: true }),
    REDIS_PORT:     port({ default: 6379, optional: true }),
    REDIS_HOST:     str({ optional: true }),
    REDIS_DB:       num({ default: 0, integer: true, optional: true }),
    REDIS_TLS:      bool({ default: false, optional: true }),
  },

  upstash: {
    UPSTASH_REDIS_REST_URL:   url({ requireTls: true, description: 'Upstash REST URL' }),
    UPSTASH_REDIS_REST_TOKEN: secret({ description: 'Upstash REST token' }),
    UPSTASH_KAFKA_REST_URL:   url({ optional: true }),
    UPSTASH_KAFKA_REST_TOKEN: secret({ optional: true }),
  },

  kafka: {
    KAFKA_BROKERS:       str({ description: 'Comma-separated list of Kafka brokers' }),
    KAFKA_CLIENT_ID:     str({ optional: true }),
    KAFKA_USERNAME:      str({ optional: true }),
    KAFKA_PASSWORD:      secret({ optional: true }),
    KAFKA_SSL:           bool({ default: false, optional: true }),
    KAFKA_SASL_MECHANISM: str({ choices: ['plain', 'scram-sha-256', 'scram-sha-512'], optional: true }),
  },

  stripe: {
    STRIPE_SECRET_KEY:          secret({ description: 'Stripe secret key (sk_live_* or sk_test_*)' }),
    STRIPE_PUBLISHABLE_KEY:     str({ description: 'Stripe publishable key (pk_live_* or pk_test_*)' }),
    STRIPE_WEBHOOK_SECRET:      secret({ optional: true, description: 'Stripe webhook signing secret' }),
    STRIPE_PRICE_ID:            str({ optional: true }),
    STRIPE_CUSTOMER_PORTAL_URL: url({ optional: true }),
  },

  lemonsqueezy: {
    LEMON_SQUEEZY_API_KEY:       secret({ description: 'Lemon Squeezy API key' }),
    LEMON_SQUEEZY_WEBHOOK_SECRET: secret({ optional: true }),
    LEMON_SQUEEZY_STORE_ID:      str({ optional: true }),
    LEMON_SQUEEZY_VARIANT_ID:    str({ optional: true }),
  },

  paystack: {
    PAYSTACK_SECRET_KEY: secret({ description: 'Paystack secret key' }),
    PAYSTACK_PUBLIC_KEY: str({ description: 'Paystack public key' }),
    PAYSTACK_WEBHOOK_SECRET: secret({ optional: true }),
  },

  flutterwave: {
    FLW_PUBLIC_KEY:  str({ description: 'Flutterwave public key' }),
    FLW_SECRET_KEY:  secret({ description: 'Flutterwave secret key' }),
    FLW_SECRET_HASH: secret({ optional: true, description: 'Flutterwave webhook secret hash' }),
  },

  paddle: {
    PADDLE_API_KEY:       secret(),
    PADDLE_WEBHOOK_SECRET: secret({ optional: true }),
    PADDLE_VENDOR_ID:     str({ optional: true }),
    PADDLE_ENVIRONMENT:   str({ choices: ['sandbox', 'production'], default: 'production', optional: true }),
  },

  aws: {
    AWS_ACCESS_KEY_ID:     str({ description: 'AWS access key ID' }),
    AWS_SECRET_ACCESS_KEY: secret({ description: 'AWS secret access key' }),
    AWS_REGION:            str({ default: 'us-east-1', description: 'AWS region' }),
    AWS_S3_BUCKET:         str({ optional: true }),
    AWS_S3_ENDPOINT:       url({ optional: true }),
    AWS_CLOUDFRONT_URL:    url({ optional: true }),
  },

  gcp: {
    GCP_PROJECT_ID:         str({ description: 'Google Cloud project ID' }),
    GCP_CLIENT_EMAIL:       email({ optional: true }),
    GCP_PRIVATE_KEY:        secret({ optional: true }),
    GCP_SERVICE_ACCOUNT:    str({ optional: true }),
    GCP_STORAGE_BUCKET:     str({ optional: true }),
    GOOGLE_APPLICATION_CREDENTIALS: str({ optional: true }),
  },

  azure: {
    AZURE_TENANT_ID:        str({ optional: true }),
    AZURE_CLIENT_ID:        str({ optional: true }),
    AZURE_CLIENT_SECRET:    secret({ optional: true }),
    AZURE_SUBSCRIPTION_ID:  str({ optional: true }),
    AZURE_STORAGE_ACCOUNT:  str({ optional: true }),
    AZURE_STORAGE_KEY:      secret({ optional: true }),
  },

  cloudinary: {
    CLOUDINARY_CLOUD_NAME: str({ description: 'Cloudinary cloud name' }),
    CLOUDINARY_API_KEY:    str({ description: 'Cloudinary API key' }),
    CLOUDINARY_API_SECRET: secret({ description: 'Cloudinary API secret' }),
    CLOUDINARY_URL:        url({ optional: true, protocols: ['cloudinary'] }),
  },

  uploadthing: {
    UPLOADTHING_SECRET: secret({ description: 'UploadThing secret key' }),
    UPLOADTHING_APP_ID: str({ description: 'UploadThing app ID' }),
  },

  resend: {
    RESEND_API_KEY:  secret({ description: 'Resend API key' }),
    EMAIL_FROM:      str({ optional: true, description: 'Default sender email address' }),
    EMAIL_REPLY_TO:  str({ optional: true }),
  },

  sendgrid: {
    SENDGRID_API_KEY: secret({ description: 'SendGrid API key' }),
    EMAIL_FROM:       str({ optional: true }),
    SENDGRID_TEMPLATE_ID: str({ optional: true }),
  },

  mailgun: {
    MAILGUN_API_KEY:   secret({ description: 'Mailgun API key' }),
    MAILGUN_DOMAIN:    str({ description: 'Mailgun domain' }),
    MAILGUN_REGION:    str({ choices: ['US', 'EU'], default: 'US', optional: true }),
    EMAIL_FROM:        str({ optional: true }),
  },

  postmark: {
    POSTMARK_SERVER_TOKEN: secret({ description: 'Postmark server token' }),
    POSTMARK_ACCOUNT_TOKEN: secret({ optional: true }),
    EMAIL_FROM: str({ optional: true }),
  },

  ses: {
    AWS_SES_REGION:           str({ default: 'us-east-1' }),
    AWS_SES_ACCESS_KEY_ID:    str({ optional: true }),
    AWS_SES_SECRET_ACCESS_KEY: secret({ optional: true }),
    EMAIL_FROM:               str({ optional: true }),
  },

  openai: {
    OPENAI_API_KEY:    secret({ description: 'OpenAI API key' }),
    OPENAI_MODEL:      str({ default: 'gpt-4o', optional: true }),
    OPENAI_ORG_ID:     str({ optional: true }),
    OPENAI_BASE_URL:   url({ optional: true }),
    OPENAI_MAX_TOKENS: num({ default: 4096, integer: true, optional: true }),
  },

  anthropic: {
    ANTHROPIC_API_KEY: secret({ description: 'Anthropic API key' }),
    ANTHROPIC_MODEL:   str({ default: 'claude-sonnet-4-20250514', optional: true }),
    ANTHROPIC_MAX_TOKENS: num({ default: 4096, integer: true, optional: true }),
  },

  mistral: {
    MISTRAL_API_KEY: secret({ description: 'Mistral AI API key' }),
    MISTRAL_MODEL:   str({ default: 'mistral-large-latest', optional: true }),
  },

  groq: {
    GROQ_API_KEY: secret({ description: 'Groq API key' }),
    GROQ_MODEL:   str({ default: 'llama-3.1-70b-versatile', optional: true }),
  },

  together: {
    TOGETHER_API_KEY: secret({ description: 'Together AI API key' }),
    TOGETHER_MODEL:   str({ optional: true }),
  },

  cohere: {
    COHERE_API_KEY:  secret({ description: 'Cohere API key' }),
    COHERE_MODEL:    str({ default: 'command-r-plus', optional: true }),
  },

  replicate: {
    REPLICATE_API_TOKEN: secret({ description: 'Replicate API token' }),
  },

  huggingface: {
    HUGGINGFACE_API_KEY: secret({ description: 'Hugging Face API key' }),
    HUGGINGFACE_MODEL:   str({ optional: true }),
  },

  clerk: {
    CLERK_SECRET_KEY:                  secret({ description: 'Clerk secret key' }),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: str({ description: 'Clerk publishable key' }),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL:     str({ default: '/sign-in', optional: true }),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL:     str({ default: '/sign-up', optional: true }),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: str({ default: '/', optional: true }),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: str({ default: '/', optional: true }),
    CLERK_WEBHOOK_SECRET:              secret({ optional: true }),
  },

  auth0: {
    AUTH0_SECRET:        secret({ minLength: 32, description: 'Auth0 secret' }),
    AUTH0_BASE_URL:      url({ description: 'Auth0 base URL' }),
    AUTH0_ISSUER_BASE_URL: url({ description: 'Auth0 issuer URL' }),
    AUTH0_CLIENT_ID:     str({ description: 'Auth0 client ID' }),
    AUTH0_CLIENT_SECRET: secret({ description: 'Auth0 client secret' }),
    AUTH0_AUDIENCE:      str({ optional: true }),
  },

  nextauth: {
    NEXTAUTH_SECRET:  secret({ minLength: 32, description: 'NextAuth.js secret' }),
    NEXTAUTH_URL:     url({ description: 'NextAuth.js canonical URL' }),
  },

  betterauth: {
    BETTER_AUTH_SECRET: secret({ minLength: 32, description: 'Better Auth secret' }),
    BETTER_AUTH_URL:    url({ description: 'Better Auth base URL' }),
  },

  auth: {
    JWT_SECRET:            secret({ minLength: 32, description: 'JWT signing secret' }),
    JWT_EXPIRES_IN:        str({ default: '7d', optional: true }),
    REFRESH_TOKEN_SECRET:  secret({ optional: true, minLength: 32 }),
    SESSION_SECRET:        secret({ optional: true, minLength: 32 }),
    COOKIE_SECRET:         secret({ optional: true, minLength: 32 }),
    ENCRYPTION_KEY:        secret({ optional: true, minLength: 32 }),
  },

  oauth: {
    GOOGLE_CLIENT_ID:      str({ optional: true }),
    GOOGLE_CLIENT_SECRET:  secret({ optional: true }),
    GITHUB_CLIENT_ID:      str({ optional: true }),
    GITHUB_CLIENT_SECRET:  secret({ optional: true }),
    DISCORD_CLIENT_ID:     str({ optional: true }),
    DISCORD_CLIENT_SECRET: secret({ optional: true }),
    TWITTER_CLIENT_ID:     str({ optional: true }),
    TWITTER_CLIENT_SECRET: secret({ optional: true }),
    FACEBOOK_CLIENT_ID:    str({ optional: true }),
    FACEBOOK_CLIENT_SECRET: secret({ optional: true }),
    LINKEDIN_CLIENT_ID:    str({ optional: true }),
    LINKEDIN_CLIENT_SECRET: secret({ optional: true }),
    APPLE_CLIENT_ID:       str({ optional: true }),
    APPLE_CLIENT_SECRET:   secret({ optional: true }),
  },

  twilio: {
    TWILIO_ACCOUNT_SID:    str({ description: 'Twilio account SID' }),
    TWILIO_AUTH_TOKEN:     secret({ description: 'Twilio auth token' }),
    TWILIO_PHONE_NUMBER:   str({ optional: true }),
    TWILIO_MESSAGING_SID:  str({ optional: true }),
  },

  pusher: {
    PUSHER_APP_ID:              str({ description: 'Pusher app ID' }),
    PUSHER_KEY:                 str({ description: 'Pusher key' }),
    PUSHER_SECRET:              secret({ description: 'Pusher secret' }),
    PUSHER_CLUSTER:             str({ default: 'mt1', description: 'Pusher cluster' }),
    NEXT_PUBLIC_PUSHER_KEY:     str({ optional: true }),
    NEXT_PUBLIC_PUSHER_CLUSTER: str({ optional: true }),
    PUSHER_USE_TLS:             bool({ default: true, optional: true }),
  },

  ably: {
    ABLY_API_KEY:          secret({ description: 'Ably API key' }),
    NEXT_PUBLIC_ABLY_KEY:  str({ optional: true }),
  },

  livekit: {
    LIVEKIT_API_KEY:    str({ description: 'LiveKit API key' }),
    LIVEKIT_API_SECRET: secret({ description: 'LiveKit API secret' }),
    LIVEKIT_URL:        url({ optional: true }),
  },

  sentry: {
    SENTRY_DSN:         url({ optional: true, description: 'Sentry DSN' }),
    SENTRY_ORG:         str({ optional: true }),
    SENTRY_PROJECT:     str({ optional: true }),
    SENTRY_AUTH_TOKEN:  secret({ optional: true }),
    SENTRY_ENVIRONMENT: str({ optional: true }),
  },

  datadog: {
    DD_API_KEY:      secret({ description: 'Datadog API key' }),
    DD_APP_KEY:      secret({ optional: true }),
    DD_SITE:         str({ default: 'datadoghq.com', optional: true }),
    DD_SERVICE:      str({ optional: true }),
    DD_ENV:          str({ optional: true }),
  },

  logtail: {
    LOGTAIL_SOURCE_TOKEN: secret({ description: 'Logtail source token' }),
  },

  axiom: {
    AXIOM_TOKEN:   secret({ description: 'Axiom API token' }),
    AXIOM_ORG_ID:  str({ optional: true }),
    AXIOM_DATASET: str({ optional: true }),
  },

  posthog: {
    POSTHOG_API_KEY:  secret({ description: 'PostHog API key' }),
    POSTHOG_HOST:     url({ default: 'https://app.posthog.com', optional: true }),
    NEXT_PUBLIC_POSTHOG_KEY:  str({ optional: true }),
    NEXT_PUBLIC_POSTHOG_HOST: str({ optional: true }),
  },

  mixpanel: {
    MIXPANEL_TOKEN:     str({ description: 'Mixpanel project token' }),
    MIXPANEL_API_SECRET: secret({ optional: true }),
  },

  segment: {
    SEGMENT_WRITE_KEY: secret({ description: 'Segment write key' }),
    NEXT_PUBLIC_SEGMENT_WRITE_KEY: str({ optional: true }),
  },

  amplitude: {
    AMPLITUDE_API_KEY: str({ description: 'Amplitude API key' }),
    AMPLITUDE_SECRET_KEY: secret({ optional: true }),
  },

  intercom: {
    INTERCOM_APP_ID:       str({ optional: true }),
    INTERCOM_ACCESS_TOKEN: secret({ optional: true }),
    INTERCOM_SECRET_KEY:   secret({ optional: true }),
  },

  hubspot: {
    HUBSPOT_ACCESS_TOKEN: secret({ description: 'HubSpot access token' }),
    HUBSPOT_CLIENT_SECRET: secret({ optional: true }),
  },

  algolia: {
    ALGOLIA_APP_ID:        str({ description: 'Algolia application ID' }),
    ALGOLIA_ADMIN_KEY:     secret({ description: 'Algolia admin API key' }),
    ALGOLIA_SEARCH_KEY:    str({ optional: true }),
    ALGOLIA_INDEX_NAME:    str({ optional: true }),
    NEXT_PUBLIC_ALGOLIA_APP_ID:    str({ optional: true }),
    NEXT_PUBLIC_ALGOLIA_SEARCH_KEY: str({ optional: true }),
  },

  sanity: {
    SANITY_PROJECT_ID:  str({ description: 'Sanity project ID' }),
    SANITY_DATASET:     str({ default: 'production', description: 'Sanity dataset name' }),
    SANITY_API_TOKEN:   secret({ optional: true }),
    SANITY_WEBHOOK_SECRET: secret({ optional: true }),
    NEXT_PUBLIC_SANITY_PROJECT_ID: str({ optional: true }),
    NEXT_PUBLIC_SANITY_DATASET:    str({ optional: true }),
  },

  contentful: {
    CONTENTFUL_SPACE_ID:    str({ description: 'Contentful space ID' }),
    CONTENTFUL_ACCESS_TOKEN: secret({ description: 'Contentful delivery token' }),
    CONTENTFUL_PREVIEW_TOKEN: secret({ optional: true }),
    CONTENTFUL_MANAGEMENT_TOKEN: secret({ optional: true }),
    CONTENTFUL_WEBHOOK_SECRET: secret({ optional: true }),
  },

  prismic: {
    PRISMIC_REPO_NAME:     str({ description: 'Prismic repository name' }),
    PRISMIC_ACCESS_TOKEN:  secret({ optional: true }),
    PRISMIC_WEBHOOK_SECRET: secret({ optional: true }),
  },

  github: {
    GITHUB_TOKEN:        secret({ optional: true, description: 'GitHub personal access token' }),
    GITHUB_APP_ID:       str({ optional: true }),
    GITHUB_CLIENT_ID:    str({ optional: true }),
    GITHUB_CLIENT_SECRET: secret({ optional: true }),
    GITHUB_WEBHOOK_SECRET: secret({ optional: true }),
    GITHUB_PRIVATE_KEY:  secret({ optional: true }),
  },

  gitlab: {
    GITLAB_TOKEN:        secret({ optional: true }),
    GITLAB_CLIENT_ID:    str({ optional: true }),
    GITLAB_CLIENT_SECRET: secret({ optional: true }),
    GITLAB_WEBHOOK_TOKEN: secret({ optional: true }),
  },

  shopify: {
    SHOPIFY_API_KEY:      str({ description: 'Shopify API key' }),
    SHOPIFY_API_SECRET:   secret({ description: 'Shopify API secret' }),
    SHOPIFY_ACCESS_TOKEN: secret({ optional: true }),
    SHOPIFY_WEBHOOK_SECRET: secret({ optional: true }),
    SHOPIFY_STORE_DOMAIN: str({ optional: true }),
  },

  slack: {
    SLACK_BOT_TOKEN:      secret({ description: 'Slack bot token' }),
    SLACK_SIGNING_SECRET: secret({ description: 'Slack signing secret' }),
    SLACK_APP_TOKEN:      secret({ optional: true }),
    SLACK_WEBHOOK_URL:    url({ optional: true }),
  },

  discord: {
    DISCORD_TOKEN:          secret({ optional: true, description: 'Discord bot token' }),
    DISCORD_CLIENT_ID:      str({ optional: true }),
    DISCORD_CLIENT_SECRET:  secret({ optional: true }),
    DISCORD_WEBHOOK_URL:    url({ optional: true }),
    DISCORD_PUBLIC_KEY:     str({ optional: true }),
  },

  telegram: {
    TELEGRAM_BOT_TOKEN:   secret({ description: 'Telegram bot token' }),
    TELEGRAM_WEBHOOK_URL: url({ optional: true }),
    TELEGRAM_CHAT_ID:     str({ optional: true }),
  },

  firebase: {
    FIREBASE_API_KEY:       str({ description: 'Firebase API key' }),
    FIREBASE_PROJECT_ID:    str({ description: 'Firebase project ID' }),
    FIREBASE_CLIENT_EMAIL:  email({ optional: true }),
    FIREBASE_PRIVATE_KEY:   secret({ optional: true }),
    FIREBASE_APP_ID:        str({ optional: true }),
    FIREBASE_MEASUREMENT_ID: str({ optional: true }),
    FIREBASE_STORAGE_BUCKET: str({ optional: true }),
    FIREBASE_MESSAGING_SENDER_ID: str({ optional: true }),
  },

  mapbox: {
    MAPBOX_ACCESS_TOKEN:             secret({ description: 'Mapbox access token' }),
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: str({ optional: true }),
  },

  googlemaps: {
    GOOGLE_MAPS_API_KEY:             secret({ description: 'Google Maps API key' }),
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: str({ optional: true }),
  },

  opentelemetry: {
    OTEL_SERVICE_NAME:           str({ optional: true }),
    OTEL_EXPORTER_OTLP_ENDPOINT: url({ optional: true }),
    OTEL_EXPORTER_OTLP_HEADERS:  str({ optional: true }),
    OTEL_TRACES_SAMPLER:         str({ optional: true }),
    OTEL_LOG_LEVEL:              str({ choices: ['debug', 'info', 'warn', 'error'], default: 'info', optional: true }),
  },

  smtp: {
    SMTP_HOST:     str({ description: 'SMTP server host' }),
    SMTP_PORT:     port({ default: 587, description: 'SMTP server port' }),
    SMTP_USER:     str({ optional: true, description: 'SMTP username' }),
    SMTP_PASS:     secret({ optional: true, description: 'SMTP password' }),
    SMTP_SECURE:   bool({ default: false, optional: true }),
    SMTP_FROM:     email({ optional: true }),
  },

  debug: {
    DEBUG:     bool({ default: false, optional: true }),
    VERBOSE:   bool({ default: false, optional: true }),
    LOG_LEVEL: str({ choices: ['debug', 'info', 'warn', 'error'], default: 'info', optional: true }),
    DRY_RUN:   bool({ default: false, optional: true }),
    MOCK_DATA: bool({ default: false, optional: true, devOnly: true }),
  },
}
