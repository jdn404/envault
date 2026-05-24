<div align="center">
  <img src="https://files.catbox.moe/m9q6ik.png" width="100%" alt="envault banner" />
</div>

<br />

<div align="center">

[![npm](https://img.shields.io/badge/%40jadendev%2Fenvault-1.0.3-22c55e?style=for-the-badge&logo=npm&logoColor=white&labelColor=09090b)](https://www.npmjs.com/package/@jadendev/envault)
&nbsp;
![zero deps](https://img.shields.io/badge/zero_dependencies-09090b?style=for-the-badge&logo=nodedotjs&logoColor=22c55e)
&nbsp;
![TypeScript](https://img.shields.io/badge/TypeScript-ready-09090b?style=for-the-badge&logo=typescript&logoColor=3b82f6)
&nbsp;
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-09090b?style=for-the-badge&logo=nodedotjs&logoColor=84cc16)
&nbsp;
![MIT](https://img.shields.io/badge/license-MIT-09090b?style=for-the-badge)

<br />

<kbd>[Why envault?](#-why-envault)</kbd>&nbsp;&nbsp;
<kbd>[Quick Start](#-quick-start)</kbd>&nbsp;&nbsp;
<kbd>[Validators](#-validators)</kbd>&nbsp;&nbsp;
<kbd>[Options](#-options)</kbd>&nbsp;&nbsp;
<kbd>[Presets](#-presets)</kbd>&nbsp;&nbsp;
<kbd>[CLI](#-cli)</kbd>&nbsp;&nbsp;
<kbd>[Integrations](#-framework-integrations)</kbd>

<br />

```sh
npm install @jadendev/envault
```

</div>

<br />

---

<br />

## ◈ Why envault?

<br />

<table>
<tr>
<td width="50%" valign="top">

**Every other env lib has a fatal flaw**

<br />

| Library | Problem |
|:--------|:--------|
| `dotenv` | No types — everything is `string \| undefined` |
| `envalid` | Clunky DX, verbose config, has dependencies |
| `t3-env` | Locked to Zod, locked to specific frameworks |
| `zod` | General purpose — overkill and verbose for env |
| Others | Crash on first missing var, no CLI tooling |

</td>
<td width="50%" valign="top">

**envault gives you everything, once**

<br />

```
  ✓  Single function call — done
  ✓  Full TypeScript inference — no casting
  ✓  Collects ALL errors before crashing
  ✓  Beautiful, readable terminal output
  ✓  Works in Next.js, Vite, Express, any Node app
  ✓  Multi-file env loading with cascade
  ✓  Presets for every major platform and service
  ✓  CLI that no other env lib ships
  ✓  Zero runtime dependencies. Zero.
```

</td>
</tr>
</table>

<br />

---

<br />

## ◈ Quick Start

<br />

```ts
import { envault, str, num, bool, url, secret } from '@jadendev/envault'

export const env = envault({
  DATABASE_URL: url(),
  PORT:         num({ default: 3000, integer: true }),
  NODE_ENV:     str({ choices: ['development', 'production', 'test'], default: 'development' }),
  JWT_SECRET:   secret({ minLength: 32 }),
  ENABLE_CACHE: bool({ default: false }),
})

// Fully typed — no `as string`, no casting, no lying to TypeScript
env.PORT         // number
env.DATABASE_URL // string
env.ENABLE_CACHE // boolean
```

<br />

> **Missing or invalid variables?** You get this — not a silent crash, not a cryptic stack trace. Every error at once.

<br />

```
✖  envault: 2 environment variables failed validation

   DATABASE_URL          →  missing required variable
   JWT_SECRET            →  must be at least 32 characters (got 8)

   Fix the above in your .env file or deployment environment configuration.
```

<br />

---

<br />

## ◈ Validators

<br />

<div align="center">

| Function | Output type | What it does |
|:--------:|:-----------:|:-------------|
| `str()` | `string` | String with optional length, regex, choices, coerce |
| `num()` | `number` | Number with optional min, max, integer enforcement |
| `bool()` | `boolean` | Accepts `true` `false` `1` `0` `yes` `no` `on` `off` |
| `url()` | `string` | Valid URL with optional protocol whitelist and TLS enforcement |
| `port()` | `number` | Integer validated in range 1–65535 |
| `email()` | `string` | RFC 5321-compliant email validation |
| `json()` | `unknown` | Parses JSON string, optional required-key shape check |
| `list()` | `string[]` | Splits by separator (default `,`), optional choices per item |
| `uuid()` | `string` | UUID v1/v3/v4/v5 with optional version pinning |
| `secret()` | `string` | Like `str()` — masked in CLI output, for keys and tokens |
| `date()` | `Date` | ISO date string parsed to `Date`, optional min/max |
| `phone()` | `string` | E.164 phone number, normalized on read |
| `semver()` | `string` | Semantic version string (e.g. `1.2.3`, `1.0.0-beta.1`) |
| `ip()` | `string` | IPv4 or IPv6 address — uses WHATWG URL parser for IPv6 |
| `hex()` | `string` | Hex color code, auto-normalized to `#rrggbb` form |
| `enm()` | `string` | Shorthand enum — cleaner than `str({ choices })` |

</div>

<br />

### Shared Options

Every validator accepts these base options:

```ts
{
  default?:     T        // fallback value when the variable is missing
  optional?:    boolean  // if true, missing var resolves to undefined instead of erroring
  description?: string   // documents what the var is for (used by CLI init)
  devOnly?:     boolean  // only validated in development — silently skipped in production
}
```

<br />

### Examples

```ts
// str — string validation
str({ minLength: 8, maxLength: 128 })
str({ regex: /^[a-z_]+$/ })
str({ choices: ['admin', 'user', 'viewer'], default: 'user' })
str({ coerce: 'upper' })          // auto-uppercases on read
str({ coerce: 'lower' })          // auto-lowercases on read
str({ coerce: 'trim' })           // trims whitespace on read
str({ transform: v => v.split(',') })

// num — number validation
num({ min: 1, max: 65535 })
num({ integer: true })            // must be a whole number
num({ default: 3000 })

// url — URL validation
url({ protocols: ['https', 'postgresql', 'redis'] })
url({ requireTls: true })         // enforces https:// or wss://

// list — comma-separated strings
list({ separator: '|' })          // ALLOWED_IPS=1.2.3.4|5.6.7.8
list({ minItems: 1, maxItems: 5 })
list({ choices: ['read', 'write', 'admin'] })  // validates each item

// uuid — UUID validation
uuid({ version: 4 })             // pin to a specific UUID version

// json — parsed JSON
json({ shape: ['id', 'role'] })  // require these keys to exist in the object
json<{ id: string; role: string }>({ transform: v => v as MyType })

// date — ISO date string → Date object
date({ min: '2024-01-01', max: '2030-12-31' })
date({ transform: d => d.getTime() })  // convert to unix timestamp

// enm — enum shorthand
enm(['development', 'production', 'test'], { default: 'development' })
// equivalent to: str({ choices: [...], default: 'development' })

// secret — for credentials and keys
secret({ minLength: 32 })        // enforce minimum secret strength
```

<br />

---

<br />

## ◈ Options

<br />

```ts
const env = envault(schema, {
  // File loading
  path:        '.env.local',                      // single file
  path:        ['.env', '.env.local'],             // or array — merged in order
  override:    true,                               // later files override earlier ones
  environment: 'staging',                          // auto-loads .env.staging cascade

  // Error handling
  throws:      true,                               // throw Error instead of process.exit(1)
  onError:    (errors) => { myLogger.fatal(errors); process.exit(1) },
  onWarn:     (warnings) => { myLogger.warn(warnings) },

  // DX
  strict:      true,                               // warn on env vars not in schema

  // Conditional rules — require vars only when a condition is met
  rules: [
    {
      when:    (env) => env.PAYMENT_ENABLED === true,
      require: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
      message: 'Stripe keys are required when payments are enabled',
    }
  ],

  // Cross-field validation — validate relationships between vars
  crossRules: [
    {
      fields:   ['MIN_PRICE', 'MAX_PRICE'],
      validate: ({ MIN_PRICE, MAX_PRICE }) =>
        (MIN_PRICE as number) >= (MAX_PRICE as number)
          ? 'MIN_PRICE must be less than MAX_PRICE'
          : null,
    },
    {
      fields:   ['SMTP_USER', 'SMTP_PASS'],
      validate: ({ SMTP_USER, SMTP_PASS }) =>
        (!!SMTP_USER !== !!SMTP_PASS)
          ? 'SMTP_USER and SMTP_PASS must both be set or both be empty'
          : null,
    }
  ],
})
```

<br />

<details>
<summary><strong>Multi-file Loading</strong></summary>
<br />

```ts
envault(schema, {
  path: ['.env', '.env.local', '.env.production.local'],
})
```

Files are merged in order — later files win among themselves. `process.env` always has highest priority (your deployment platform sets these). Use `override: true` to change priority between listed files.

<br />
</details>

<details>
<summary><strong>Environment-based Loading</strong></summary>
<br />

```ts
envault(schema, { environment: 'staging' })
// Automatically loads: .env → .env.staging → .env.local → .env.staging.local
```

Or rely on `NODE_ENV` — envault reads it automatically when `environment` is not set.

<br />
</details>

<details>
<summary><strong>Nested Schema</strong></summary>
<br />

Group related variables under a namespace. envault resolves them automatically from prefixed env keys:

```ts
const env = envault({
  db: {
    URL:      url(),
    POOL_MIN: num({ default: 2, integer: true }),
    POOL_MAX: num({ default: 10, integer: true }),
    SSL:      bool({ default: true }),
  },
  redis: {
    URL: url({ protocols: ['redis', 'rediss'] }),
    TTL: num({ default: 3600, integer: true }),
  },
})

env.db.URL      // string — reads from DB_URL
env.db.POOL_MAX // number — reads from DB_POOL_MAX
env.redis.TTL   // number — reads from REDIS_TTL
```

<br />
</details>

<details>
<summary><strong>Server / Client Split</strong></summary>
<br />

Keep server secrets off the client bundle in SSR frameworks:

```ts
import { envaultSplit } from '@jadendev/envault'

const env = envaultSplit({
  server: {
    DATABASE_URL:  url(),
    STRIPE_SECRET: secret(),
    JWT_SECRET:    secret({ minLength: 32 }),
  },
  client: {
    NEXT_PUBLIC_APP_URL:   url(),
    NEXT_PUBLIC_CLERK_KEY: str(),
  },
})
```

Accessing a server variable on the client **throws at runtime** with a clear error — not a silent `undefined`.

<br />
</details>

<details>
<summary><strong>Conditional Rules</strong></summary>
<br />

Require certain variables only when a condition is met. The `when` function receives the fully validated, typed result object:

```ts
const env = envault({
  PAYMENT_ENABLED:       bool({ default: false }),
  SMTP_ENABLED:          bool({ default: false }),
  STRIPE_SECRET_KEY:     secret({ optional: true }),
  STRIPE_WEBHOOK_SECRET: secret({ optional: true }),
  SMTP_HOST:             str({ optional: true }),
  SMTP_PORT:             port({ optional: true }),
}, {
  rules: [
    {
      when:    (env) => env.PAYMENT_ENABLED === true,
      require: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
      message: 'Stripe keys are required when payments are enabled',
    },
    {
      when:    (env) => env.SMTP_ENABLED === true,
      require: ['SMTP_HOST', 'SMTP_PORT'],
    },
  ]
})
```

<br />
</details>

<details>
<summary><strong>Cross-field Validation</strong></summary>
<br />

Validate relationships between multiple fields — no external library needed:

```ts
const env = envault({
  MIN_CONNECTIONS: num({ integer: true }),
  MAX_CONNECTIONS: num({ integer: true }),
  CACHE_TTL:       num({ integer: true }),
  CACHE_MAX_AGE:   num({ integer: true }),
}, {
  crossRules: [
    {
      fields:   ['MIN_CONNECTIONS', 'MAX_CONNECTIONS'],
      validate: ({ MIN_CONNECTIONS, MAX_CONNECTIONS }) =>
        (MIN_CONNECTIONS as number) > (MAX_CONNECTIONS as number)
          ? 'MIN_CONNECTIONS cannot exceed MAX_CONNECTIONS'
          : null,
    },
    {
      fields:   ['CACHE_TTL', 'CACHE_MAX_AGE'],
      validate: ({ CACHE_TTL, CACHE_MAX_AGE }) =>
        (CACHE_TTL as number) > (CACHE_MAX_AGE as number)
          ? 'CACHE_TTL must be ≤ CACHE_MAX_AGE'
          : null,
    },
  ]
})
```

<br />
</details>

<details>
<summary><strong>devOnly Variables</strong></summary>
<br />

Mark variables as only required in development. They are silently skipped when `NODE_ENV === 'production'`:

```ts
const env = envault({
  DEBUG_TOKEN:  str({ devOnly: true }),   // never required in production
  DATABASE_URL: url(),
  MOCK_EMAIL:   bool({ devOnly: true, default: false }),
})
```

<br />
</details>

<details>
<summary><strong>Runtime Environment Helpers</strong></summary>
<br />

No more `process.env.NODE_ENV === 'production'` scattered across your codebase:

```ts
import { envIsDev, envIsProd } from '@jadendev/envault'

if (envIsDev()) {
  enableDebugLogging()
}

if (envIsProd()) {
  enableSentry()
}
```

Also available: `env_isTest()`, `env_isStaging()`.

<br />
</details>

<details>
<summary><strong>Type Extraction</strong></summary>
<br />

Extract the inferred type of your env object to pass around your codebase:

```ts
import { envault, str, num } from '@jadendev/envault'
import type { InferEnv } from '@jadendev/envault'

const schema = {
  DATABASE_URL: str(),
  PORT: num({ default: 3000 }),
}

export const env = envault(schema)
export type Env = InferEnv<typeof schema>

// Use Env as a type in service constructors, tests, etc.
function createServer(env: Env) { ... }
```

<br />
</details>

<details>
<summary><strong>Frozen Output</strong></summary>
<br />

The object returned by `envault()` is **deeply frozen**. Mutations throw in strict mode and silently fail otherwise. Your config is immutable at runtime — intentionally.

```ts
const env = envault({ PORT: num() })
env.PORT = 9999 // TypeError: Cannot assign to read only property
```

<br />
</details>

<br />

---

<br />

## ◈ Framework Integrations

<br />

<table>
<tr>
<td width="50%" valign="top">

### Next.js

```ts
// env.ts
import { createNextEnv, secret, url, str } from '@jadendev/envault/next'

export const env = createNextEnv({
  server: {
    DATABASE_URL: url(),
    AUTH_SECRET:  secret({ minLength: 32 }),
    STRIPE_KEY:   secret(),
  },
  client: {
    NEXT_PUBLIC_APP_URL:  url(),
    NEXT_PUBLIC_CLERK_PK: str(),
  },
})
```

Auto-loads `.env`, `.env.local`, and environment-specific files. Sets `clientPrefix: 'NEXT_PUBLIC_'` automatically. Accessing a server var on the client throws at runtime.

</td>
<td width="50%" valign="top">

### Vite

```ts
// vite.config.ts
import { envaultPlugin, url, str, bool } from '@jadendev/envault/vite'

export default {
  plugins: [
    envaultPlugin({
      VITE_API_URL:     url({ requireTls: true }),
      VITE_APP_TITLE:   str({ default: 'My App' }),
      VITE_ENABLE_LOGS: bool({ default: false }),
    })
  ]
}
```

Validation runs at **build time** — your build fails loudly before bad env reaches production.

</td>
</tr>
</table>

<br />

### Any Node.js / Express / Fastify App

```ts
// env.ts — create once, import everywhere
import { envault, url, num, secret, bool, str, enm } from '@jadendev/envault'

export const env = envault({
  DATABASE_URL: url(),
  REDIS_URL:    url({ protocols: ['redis', 'rediss'], optional: true }),
  PORT:         num({ default: 3000, integer: true }),
  JWT_SECRET:   secret({ minLength: 32 }),
  LOG_LEVEL:    enm(['debug', 'info', 'warn', 'error'], { default: 'info' }),
  CORS_ORIGINS: list({ separator: ',' }),
})

// server.ts
import { env } from './env'
app.listen(env.PORT)
```

<br />

---

<br />

## ◈ Presets

Drop-in schema blocks for popular platforms and services. Mix and match freely:

```ts
import { envault } from '@jadendev/envault'
import { presets } from '@jadendev/envault/presets'

const env = envault({
  ...presets.railway,
  ...presets.supabase,
  ...presets.stripe,
  ...presets.resend,
  APP_NAME: str({ default: 'My App' }),
})
```

<br />

<div align="center">

| Preset | Key Variables |
|:-------|:-------------|
| `node` | `NODE_ENV` · `PORT` · `HOST` · `LOG_LEVEL` |
| `railway` | `PORT` · `RAILWAY_ENVIRONMENT` · `RAILWAY_SERVICE_NAME` · `RAILWAY_PROJECT_NAME` |
| `vercel` | `VERCEL` · `VERCEL_ENV` · `VERCEL_URL` · `VERCEL_REGION` · `VERCEL_GIT_COMMIT_SHA` |
| `render` | `PORT` · `RENDER` · `RENDER_SERVICE_NAME` · `RENDER_EXTERNAL_URL` |
| `fly` | `PORT` · `FLY_APP_NAME` · `FLY_REGION` · `FLY_ALLOC_ID` |
| `netlify` | `NETLIFY` · `CONTEXT` · `DEPLOY_URL` · `URL` |
| `cloudflare` | `CF_PAGES` · `CF_PAGES_URL` · `CF_PAGES_BRANCH` · `CF_PAGES_COMMIT_SHA` |
| `supabase` | `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_JWT_SECRET` |
| `database` | `DATABASE_URL` · `DATABASE_POOL_MIN` · `DATABASE_POOL_MAX` · `DATABASE_SSL` |
| `planetscale` | `DATABASE_URL` *(mysql protocol enforced)* |
| `neon` | `DATABASE_URL` · `DATABASE_URL_UNPOOLED` *(postgresql enforced)* |
| `redis` | `REDIS_URL` · `REDIS_PASSWORD` · `REDIS_PORT` · `REDIS_DB` |
| `mongodb` | `MONGODB_URI` · `MONGODB_DB_NAME` |
| `kafka` | `KAFKA_BROKERS` · `KAFKA_CLIENT_ID` · `KAFKA_USERNAME` · `KAFKA_PASSWORD` |
| `upstash` | `UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN` |
| `stripe` | `STRIPE_SECRET_KEY` · `STRIPE_PUBLISHABLE_KEY` · `STRIPE_WEBHOOK_SECRET` |
| `lemonsqueezy` | `LEMON_SQUEEZY_API_KEY` · `LEMON_SQUEEZY_WEBHOOK_SECRET` · `LEMON_SQUEEZY_STORE_ID` |
| `paystack` | `PAYSTACK_SECRET_KEY` · `PAYSTACK_PUBLIC_KEY` |
| `aws` | `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` · `AWS_REGION` · `AWS_S3_BUCKET` |
| `resend` | `RESEND_API_KEY` · `EMAIL_FROM` · `EMAIL_REPLY_TO` |
| `sendgrid` | `SENDGRID_API_KEY` · `EMAIL_FROM` |
| `openai` | `OPENAI_API_KEY` · `OPENAI_MODEL` · `OPENAI_ORG_ID` · `OPENAI_BASE_URL` |
| `anthropic` | `ANTHROPIC_API_KEY` · `ANTHROPIC_MODEL` |
| `clerk` | `CLERK_SECRET_KEY` · `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` · sign-in/up URLs |
| `auth` | `JWT_SECRET` · `JWT_EXPIRES_IN` · `REFRESH_TOKEN_SECRET` · `SESSION_SECRET` |
| `oauth` | `GOOGLE_CLIENT_*` · `GITHUB_CLIENT_*` · `DISCORD_CLIENT_*` |
| `twilio` | `TWILIO_ACCOUNT_SID` · `TWILIO_AUTH_TOKEN` · `TWILIO_PHONE_NUMBER` |
| `pusher` | `PUSHER_APP_ID` · `PUSHER_KEY` · `PUSHER_SECRET` · `PUSHER_CLUSTER` |
| `sentry` | `SENTRY_DSN` · `SENTRY_ORG` · `SENTRY_PROJECT` · `SENTRY_AUTH_TOKEN` |
| `debug` | `DEBUG` · `VERBOSE` · `LOG_LEVEL` |

</div>

<br />

---

<br />

## ◈ CLI

The CLI no other env library ships. Run any command with `npx @jadendev/envault` or install globally.

<br />

```
envault — environment variable validation CLI

Usage:
  envault <command> [options]

Commands:
  check                Verify .env exists and report empty values
  doctor               Show all variables across all .env files (secrets masked)
  generate             Create .env.example from .env (secrets cleared)
  audit                Find missing vars, stale vars, and secret leaks in code
  diff [a] [b]         Compare two env files (default: .env vs .env.production)
  watch [file]         Watch an env file for live change reporting (default: .env)
  init                 Scaffold env.ts from your codebase — auto-detects types
  validate <file>      Parse and lint a specific env file
  export [file]        Print env file as JSON to stdout
  export [f] --shell   Print as shell export statements
  secrets              List all secrets across env files — masked with strength indicator
  copy <src> <dst>     Copy missing vars from one env file to another
```

<br />

### `envault audit`

Scans your entire codebase and cross-references it against your `.env` file. Detects:

- Variables used in code but missing from `.env`
- Variables defined in `.env` but never used in code
- Secrets being logged to the console (template literals, direct access, destructuring)

Understands `process.env.VAR`, `process.env['VAR']`, `import.meta.env.VAR`, destructured `const { VAR } = process.env`, and `env.VAR` patterns across `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.svelte`, `.vue` files.

<br />

### `envault init`

Scaffolds a typed `env.ts` file by scanning your codebase for all env var usage. Automatically:

- Groups vars by common prefix (`DB_HOST`, `DB_PORT`, `DB_NAME` → nested `db` group)
- Guesses validator types from key names (`SECRET`, `KEY`, `TOKEN` → `secret()`, `PORT` → `port()`, `URL` → `url()`, etc.)
- Generates a ready-to-edit starting point

<br />

### `envault secrets`

Lists every detected secret across all your env files, masked, with a colour-coded strength indicator — green for ≥ 32 chars, yellow for ≥ 16, red for weak.

<br />

### `envault diff`

```sh
envault diff .env .env.staging
```

Compares two env files line by line. Shows added, removed, and changed keys. Secret values are masked in the diff output.

<br />

### `envault watch`

```sh
envault watch           # watches .env
envault watch .env.local
```

Live-reports additions, removals, and changes as you edit any env file. Uses `fs.watch` with debounce — no polling.

<br />

### `envault copy`

```sh
envault copy .env.example .env
```

Copies any variables from the source that are missing in the destination, without overwriting existing values. Replaces the manual `cp .env.example .env` and edit workflow.

<br />

### `envault export`

```sh
envault export .env               # → JSON
envault export .env --shell       # → export KEY="value" lines
envault export .env | jq '.DATABASE_URL'
envault export .env --shell >> ~/.zshrc
```

<br />

---

<br />

## ◈ TypeScript

Everything is inferred at the type level. No generics to specify, no `as string`, no lying to the compiler:

```ts
const env = envault({
  PORT:        num(),
  API_KEY:     secret(),
  IS_PROD:     bool(),
  TAGS:        list(),
  CREATED_AT:  date(),
  VERSION:     semver(),
  SERVER_IP:   ip(),
  BRAND_COLOR: hex(),
  ROLE:        enm(['admin', 'user', 'viewer']),
})

env.PORT        // number
env.API_KEY     // string
env.IS_PROD     // boolean
env.TAGS        // string[]
env.CREATED_AT  // Date
env.VERSION     // string
env.SERVER_IP   // string
env.BRAND_COLOR // string (normalized to #rrggbb)
env.ROLE        // string

// Optional fields correctly infer as T | undefined
const env2 = envault({
  REDIS_URL: url({ optional: true }),
})
env2.REDIS_URL  // string | undefined
```

Full depth with nested schemas. Deeply frozen at runtime — mutations throw.

<br />

---

<br />

## ◈ Exports

```ts
// Core
import { envault, envaultSplit }              from '@jadendev/envault'

// Validators
import {
  str, num, bool, url, port, email,
  json, list, uuid, secret, date, phone,
  semver, ip, hex, enm,
}                                             from '@jadendev/envault'

// Helpers
import { envIsDev, envIsProd }               from '@jadendev/envault'
import { env_isTest, env_isStaging }         from '@jadendev/envault'

// Types
import type { InferEnv, EnvaultOptions,
  ValidationError, CrossFieldRule,
  ConditionalRule }                          from '@jadendev/envault'

// Presets
import { presets }                           from '@jadendev/envault/presets'

// Framework plugins
import { createNextEnv, createEnv }          from '@jadendev/envault/next'
import { createEnv, envaultPlugin }          from '@jadendev/envault/vite'
```

<br />

---

<br />

## ◈ Requirements

<br />

| | |
|:-|:-|
| **Runtime** | Node.js >= 18 |
| **Dependencies** | Zero |
| **TypeScript** | Full inference — no config needed |

<br />

---

<br />

<div align="center">

![MIT](https://img.shields.io/badge/MIT_License-09090b?style=for-the-badge)

<br /><br />

Built by <a href="https://github.com/jdn404"><strong>@jadendev</strong></a>

<br /><br />

<sub>If envault saved you from a bad deploy, give it a ⭐</sub>

</div>

---

<br />

## ◈ JavaScript Support

envault is written in TypeScript but **ships compiled JavaScript**. You get full validation, typed errors, CLI tooling and all features in plain `.js` projects — you just won't get editor autocomplete on the returned object.

<br />

### CommonJS (require)

```js
const { envault, str, num, bool, url, secret, list } = require('@jadendev/envault')

const env = envault({
  DATABASE_URL: url(),
  PORT:         num({ default: 3000 }),
  API_KEY:      secret({ minLength: 16 }),
  DEBUG:        bool({ default: false }),
  ALLOWED_IPS:  list({ separator: ',' }),
})

// Use it anywhere — fully validated at startup
const server = app.listen(env.PORT)
db.connect(env.DATABASE_URL)
```

<br />

### ES Modules (import)

```js
import { envault, str, num, bool, url, secret } from '@jadendev/envault'

export const env = envault({
  DATABASE_URL: url(),
  PORT:         num({ default: 3000 }),
  JWT_SECRET:   secret({ minLength: 32 }),
  NODE_ENV:     str({ choices: ['development', 'production', 'test'], default: 'development' }),
})
```

<br />

### With Presets

```js
const { envault } = require('@jadendev/envault')
const { presets } = require('@jadendev/envault/presets')

const env = envault({
  ...presets.node,
  ...presets.supabase,
  ...presets.stripe,
})
```

<br />

---

<br />

## ◈ Works With or Without a `.env` File

envault reads from **two places** and merges them automatically:

1. Your `.env` files (loaded by envault)
2. `process.env` — variables already set in the environment

This means it works exactly the same whether you're running locally with a `.env` file, on Railway/Render/Vercel where env vars are injected by the platform, or in CI/CD where they're set as secrets.

<br />

```
Local dev:        .env file → envault validates → typed env object
Production:       Platform sets process.env → envault validates → typed env object
Both work. No code changes needed between environments.
```

<br />

### `process.env` still works too

envault does **not** replace or modify `process.env`. It reads from it, validates it, and returns a typed object. Your existing `process.env.PORT` calls keep working — you can migrate gradually:

```js
// Before — raw, untyped, risky
const port = parseInt(process.env.PORT)        // could be NaN
const key = process.env.API_KEY                // string | undefined
const debug = process.env.DEBUG === 'true'     // manual coercion everywhere

// After — validated, typed, safe
const { PORT, API_KEY, DEBUG } = env
// PORT  → number,  guaranteed
// API_KEY → string, guaranteed (or process.exit before you get here)
// DEBUG → boolean, guaranteed
```

You don't have to rip out all your `process.env` calls on day one. Add envault at the entry point, validate what you care about, and migrate the rest over time.

<br />

### Deployment platforms — nothing changes

If your platform sets `DATABASE_URL` as an env var (Railway, Render, Fly, Vercel, Heroku, AWS, etc.), envault reads it from `process.env` automatically. No `.env` file needed in production:

```js
// This works in production with zero .env files
// because Railway/Render/etc inject these into process.env
const env = envault({
  DATABASE_URL: url(),
  PORT:         num({ default: 3000 }),
  NODE_ENV:     str({ default: 'production' }),
})
```

<br />

### Priority order

When the same variable exists in multiple places, envault follows this priority (highest wins):

```
process.env (deployment platform / shell exports)
  ↑ wins
.env.{environment}.local    (e.g. .env.production.local)
  ↑
.env.local
  ↑
.env.{environment}          (e.g. .env.production)
  ↑
.env
```

This matches the exact same convention as Next.js, Vite, and create-react-app — so if you're used to how those work, envault behaves identically.

<br />

---

<br />

## ◈ Migration From dotenv / process.env

If your codebase uses raw `process.env` everywhere, here's the fastest path to getting envault in:

<br />

**Step 1 — Install**

```sh
npm install @jadendev/envault
```

**Step 2 — Create `env.js` (or `env.ts`) at your project root**

```js
// env.js
const { envault, str, num, bool, url, secret } = require('@jadendev/envault')

const env = envault({
  // Add every var your app uses
  DATABASE_URL: url(),
  PORT:         num({ default: 3000 }),
  NODE_ENV:     str({ default: 'development' }),
  // Optional ones won't crash if missing
  REDIS_URL:    url({ optional: true }),
  DEBUG:        bool({ default: false }),
})

module.exports = { env }
```

**Step 3 — Import it at the top of your entry point**

```js
// index.js / server.js / app.js — FIRST import
const { env } = require('./env')

// Now use env.PORT instead of process.env.PORT anywhere you want
// Your old process.env calls still work in the meantime
const server = app.listen(env.PORT)
```

**Step 4 — Let the CLI find everything you missed**

```sh
npx @jadendev/envault audit
```

Done. Your app now crashes at startup with a clear error if any required env var is missing — instead of silently failing at runtime when the code path that uses it is hit.

<br />

