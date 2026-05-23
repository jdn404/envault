<div align="center">

<img src="https://img.shields.io/badge/envault-v1.0.0-black?style=for-the-badge" />
<img src="https://img.shields.io/badge/zero_deps-✓-22c55e?style=for-the-badge" />
<img src="https://img.shields.io/badge/TypeScript-ready-3b82f6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/license-MIT-a855f7?style=for-the-badge" />

<br /><br />

# envault

**The last env validation library you'll ever need.**

Zero dependencies · Full TypeScript inference · Multi-env loading · CLI · Presets for every major platform

```bash
npm install @jadendev/envault
```

</div>

---

## Why envault?

Every other env lib has a fatal flaw:

| Library | Problem |
|---------|---------|
| `dotenv` | No types |
| `envalid` | Bad DX |
| `t3-env` | Framework-locked |
| Others | Require schema config files |

**envault** gives you a single function call, full inferred types, a beautiful error reporter, and it works anywhere — Next.js, Vite, Express, plain Node, whatever.

---

## Quick Start

```ts
import { envault, str, num, bool, url } from '@jadendev/envault'

const env = envault({
  DATABASE_URL:  url(),
  PORT:          num({ default: 3000 }),
  NODE_ENV:      str({ choices: ['development', 'production', 'test'], default: 'development' }),
  SECRET_KEY:    str({ minLength: 32 }),
  ENABLE_CACHE:  bool({ default: false }),
})

// Fully typed — no casting, no `as string`
console.log(env.PORT)         // number
console.log(env.DATABASE_URL) // string
```

If anything is missing or invalid, you get this — not a silent crash:

```
✖ envault: 2 environment variables failed validation

  DATABASE_URL   →  missing required variable
  SECRET_KEY     →  must be at least 32 characters (got 8)

  Check your .env file or environment configuration.
```

---

## Validators

| Function | Output | Notes |
|----------|--------|-------|
| `str()` | `string` | `minLength`, `maxLength`, `regex`, `choices`, `transform` |
| `num()` | `number` | `min`, `max`, `transform` |
| `bool()` | `boolean` | Accepts `true/false/1/0/yes/no/on/off` |
| `url()` | `string` | `protocols` whitelist, `transform` |
| `port()` | `number` | Validates range 1–65535 |
| `email()` | `string` | RFC-style regex |
| `json()` | `unknown` | Parses + optional transform |
| `list()` | `string[]` | Splits by separator (default `,`) |
| `uuid()` | `string` | UUID v4 format |
| `secret()` | `string` | Like `str()` — for keys/tokens |

### Common Options

All validators share these options:

```ts
{
  default?:     T        // fallback if var is missing
  optional?:    boolean  // allow undefined, no error if missing
  description?: string   // documents what this var is for
  devOnly?:     boolean  // only validated in development/test
}
```

### Validator Examples

```ts
// str
str({ minLength: 8, maxLength: 128, regex: /^[a-z]+$/, choices: ['admin', 'user'], transform: v => v.toUpperCase() })

// num
num({ min: 1, max: 65535, transform: n => n * 1000 })

// url
url({ protocols: ['https', 'postgresql'] })

// list
list({ separator: '|' })  // ALLOWED_IPS=1.2.3.4|5.6.7.8

// json
json<{ id: string; role: string }>({ transform: v => v })
```

---

## Options

```ts
const env = envault(schema, {
  path:        '.env.local',          // string or string[] — files to load in order
  override:    true,                  // file vars override process.env
  environment: 'production',          // auto-loads .env.production
  throws:      true,                  // throw instead of process.exit(1)
  strict:      true,                  // warn about undeclared vars in process.env
  onError: (errors) => {
    myLogger.fatal(errors)
    process.exit(1)
  },
  rules: [
    {
      when:    (env) => env.PAYMENT_ENABLED === true,
      require: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
      message: 'Stripe keys required when payments are enabled',
    }
  ],
})
```

### Multi-file Loading

```ts
envault(schema, {
  path: ['.env', '.env.local', '.env.production.local'],
})
```

Files are merged in order — later files win. `process.env` always wins unless `override: true`.

### Environment-based Loading

```ts
envault(schema, { environment: 'staging' })
// loads: .env → .env.staging → .env.staging.local
```

---

## Nested Schema

Group related vars under a namespace:

```ts
const env = envault({
  db: {
    URL:      url(),
    POOL_MIN: num({ default: 2 }),
    POOL_MAX: num({ default: 10 }),
  },
  redis: {
    URL: url(),
    TTL: num({ default: 3600 }),
  },
})

env.db.URL    // string
env.redis.TTL // number
```

> Env vars resolve as `DB_URL`, `DB_POOL_MIN`, `REDIS_URL`, etc.

---

## Server / Client Split

Keep server secrets off the client in SSR frameworks:

```ts
import { envaultSplit } from '@jadendev/envault'

const env = envaultSplit({
  server: {
    DATABASE_URL:  url(),
    STRIPE_SECRET: str(),
  },
  client: {
    NEXT_PUBLIC_APP_URL:   url(),
    NEXT_PUBLIC_CLERK_KEY: str(),
  },
})
```

Accessing a server variable on the client throws at runtime with a clear error.

---

## Framework Integrations

### Next.js

```ts
import { createNextEnv, str, url } from '@jadendev/envault/next'

export const env = createNextEnv({
  server: {
    DATABASE_URL: url(),
    AUTH_SECRET:  str({ minLength: 32 }),
  },
  client: {
    NEXT_PUBLIC_API_URL: url(),
  },
})
```

Automatically loads `.env`, `.env.local`, `.env.production.local`, `.env.development.local`. Sets `clientPrefix` to `NEXT_PUBLIC_` automatically.

### Vite

```ts
// vite.config.ts
import { envaultPlugin, str, url } from '@jadendev/envault/vite'

export default {
  plugins: [
    envaultPlugin({
      VITE_API_URL:   url(),
      VITE_APP_TITLE: str({ default: 'My App' }),
    })
  ]
}
```

Validation runs at **build time** — your Vite build fails loudly before bad env reaches production.

---

## Presets

Drop-in schema blocks for common platforms. Mix and match freely:

```ts
import { envault } from '@jadendev/envault'
import { presets } from '@jadendev/envault/presets'

const env = envault({
  ...presets.railway,
  ...presets.supabase,
  ...presets.stripe,
  API_KEY: str({ minLength: 32 }),
})
```

### Available Presets

| Preset | Variables |
|--------|-----------|
| `railway` | `PORT`, `RAILWAY_ENVIRONMENT`, `RAILWAY_SERVICE_NAME`, `RAILWAY_PROJECT_NAME` |
| `render` | `PORT`, `RENDER`, `RENDER_SERVICE_NAME`, `RENDER_EXTERNAL_URL` |
| `vercel` | `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_REGION` |
| `fly` | `PORT`, `FLY_APP_NAME`, `FLY_REGION`, `FLY_ALLOC_ID` |
| `netlify` | `NETLIFY`, `CONTEXT`, `DEPLOY_URL`, `URL` |
| `cloudflare` | `CF_PAGES`, `CF_PAGES_URL`, `CF_PAGES_BRANCH`, `CF_PAGES_COMMIT_SHA` |
| `supabase` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `planetscale` | `DATABASE_URL` (mysql protocol enforced) |
| `upstash` | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| `stripe` | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `aws` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` |
| `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| `clerk` | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, sign-in/up URLs |
| `resend` | `RESEND_API_KEY`, `EMAIL_FROM` |
| `database` | `DATABASE_URL`, `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX` |
| `node` | `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL` |
| `auth` | `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_SECRET` |
| `debug` | `DEBUG`, `VERBOSE` |

---

## Conditional Rules

Require certain vars only when a condition is true:

```ts
const env = envault({
  PAYMENT_ENABLED:       bool({ default: false }),
  STRIPE_SECRET_KEY:     str({ optional: true }),
  STRIPE_WEBHOOK_SECRET: str({ optional: true }),
}, {
  rules: [
    {
      when:    (env) => env.PAYMENT_ENABLED === true,
      require: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
      message: 'Stripe keys are required when payments are enabled',
    }
  ]
})
```

---

## Other Features

### `devOnly` — Dev-only Variables

```ts
const env = envault({
  DEBUG_TOKEN:  str({ devOnly: true }), // skipped when NODE_ENV === 'production'
  DATABASE_URL: url(),
})
```

### Hot Reload — For Test Suites

```ts
import { reload } from '@jadendev/envault'

const env = reload(schema) // re-validates after clearing process.env
```

### Frozen Output

The object returned by `envault()` is **deeply frozen**. Mutations throw in strict mode, silently fail otherwise. Your config is immutable at runtime — intentionally.

---

## TypeScript

Everything is inferred. No generics to manually specify, no `as string` casting:

```ts
const env = envault({
  PORT:     num(),
  API_KEY:  str(),
  IS_PROD:  bool(),
  TAGS:     list(),
})

env.PORT    // number
env.API_KEY // string
env.IS_PROD // boolean
env.TAGS    // string[]
```

Works with nested schemas too — the full depth is inferred.

---

## Exports

```ts
import { envault, envaultSplit, reload }                    from '@jadendev/envault'
import { str, num, bool, url, port, email, json, list,
         uuid, secret }                                     from '@jadendev/envault'
import { presets }                                          from '@jadendev/envault/presets'
import { createNextEnv }                                    from '@jadendev/envault/next'
import { createEnv, envaultPlugin }                         from '@jadendev/envault/vite'
```

---

## Requirements

- Node.js >= 18
- Zero runtime dependencies

---

<div align="center">

MIT License · Made by [@jadendev](https://github.com/jdn404)

</div>

