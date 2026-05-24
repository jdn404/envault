#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, watch } from 'fs'
import { resolve, join, extname, relative } from 'path'

const command = process.argv[2]
const cwd = process.cwd()

const c = (code, text) => `\x1b[${code}m${text}\x1b[0m`

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {}
  const lines = readFileSync(filePath, 'utf-8').split('\n')
  const result = {}
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    i++

    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    let raw = trimmed.slice(eq + 1)

    if (raw.startsWith('"')) {
      let inner = raw.slice(1)
      while (!inner.endsWith('"') && i < lines.length) { inner += '\n' + lines[i]; i++ }
      raw = inner.endsWith('"') ? inner.slice(0, -1) : inner
      raw = raw.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    } else if (raw.startsWith("'")) {
      let inner = raw.slice(1)
      while (!inner.endsWith("'") && i < lines.length) { inner += '\n' + lines[i]; i++ }
      raw = inner.endsWith("'") ? inner.slice(0, -1) : inner
    } else if (raw.startsWith('`')) {
      let inner = raw.slice(1)
      while (!inner.endsWith('`') && i < lines.length) { inner += '\n' + lines[i]; i++ }
      raw = inner.endsWith('`') ? inner.slice(0, -1) : inner
    } else {
      const ci = raw.indexOf(' #')
      if (ci !== -1) raw = raw.slice(0, ci)
      raw = raw.trim()
    }

    result[key] = raw
  }
  return result
}

function maskValue(val) {
  if (!val || val.length === 0) return c(90, '(empty)')
  if (val.length <= 4) return '****'
  return val.slice(0, 2) + '*'.repeat(Math.min(val.length - 2, 20))
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', '.next', 'build', 'coverage',
  '.turbo', 'out', '.cache', '.vercel', '.svelte-kit', '.nuxt', 'storybook-static',
])
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.svelte', '.vue'])

function walkDir(dir) {
  const results = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    try {
      const stat = statSync(full)
      if (stat.isDirectory()) results.push(...walkDir(full))
      else if (CODE_EXTS.has(extname(entry))) results.push(full)
    } catch {}
  }
  return results
}

function findEnvUsageInCode() {
  const files = walkDir(cwd)
  const found = new Map()

  const patterns = [
    /process\.env\.([A-Z_][A-Z0-9_]*)/g,
    /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
    /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
    /import\.meta\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
    /env\.([A-Z_][A-Z0-9_]*)/g,
  ]

  const destructurePattern = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(?:process\.env|env)/g

  for (const file of files) {
    let content
    try { content = readFileSync(file, 'utf-8') } catch { continue }
    const rel = relative(cwd, file)

    for (const pattern of patterns) {
      pattern.lastIndex = 0
      for (const match of content.matchAll(pattern)) {
        const key = match[1]
        if (!found.has(key)) found.set(key, new Set())
        found.get(key).add(rel)
      }
    }

    destructurePattern.lastIndex = 0
    for (const match of content.matchAll(destructurePattern)) {
      const keys = match[1].split(',').map(k => {
        const part = k.trim().split(/\s*:\s*/)[0].trim()
        return part.replace(/\s*=.*$/, '').trim()
      })
      for (const key of keys) {
        if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
          if (!found.has(key)) found.set(key, new Set())
          found.get(key).add(rel)
        }
      }
    }
  }

  return new Map([...found.entries()].map(([k, v]) => [k, [...v]]))
}

const SECRET_KEYWORDS = ['SECRET', 'KEY', 'TOKEN', 'PASSWORD', 'PASS', 'PWD', 'PRIVATE', 'CREDENTIAL', 'AUTH', 'HASH', 'SALT', 'SIGNING', 'CIPHER', 'WEBHOOK']
const URL_KEYWORDS    = ['URL', 'URI', 'ENDPOINT', 'DSN', 'CONNECTION_STRING']
const BOOL_KEYWORDS   = ['ENABLE', 'DISABLE', 'DEBUG', 'VERBOSE', 'FLAG', 'ACTIVE', 'FEATURE', 'MOCK', 'ENABLED', 'DISABLED']
const NUM_KEYWORDS    = ['PORT', 'TIMEOUT', 'LIMIT', 'MAX', 'MIN', 'COUNT', 'SIZE', 'TTL', 'RETRY', 'DELAY', 'INTERVAL', 'CONCURRENCY', 'WORKERS', 'CONNECTIONS', 'THRESHOLD']

const ALWAYS_SET_KEYS = new Set([
  'NODE_ENV', 'CI', 'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG',
  'npm_lifecycle_event', 'npm_package_version', 'npm_package_name',
  'NEXT_RUNTIME', 'VERCEL', 'VERCEL_ENV', 'RAILWAY_ENVIRONMENT',
])

function guessType(key) {
  const u = key.toUpperCase()
  if (SECRET_KEYWORDS.some(k => u.includes(k))) return 'secret()'
  if (u === 'PORT' || u.endsWith('_PORT')) return 'port()'
  if (URL_KEYWORDS.some(k => u.includes(k))) return 'url()'
  if (BOOL_KEYWORDS.some(k => u === k || u.endsWith('_' + k) || u.startsWith(k + '_'))) return 'bool()'
  if (NUM_KEYWORDS.some(k => u.includes(k))) return 'num()'
  return 'str()'
}

function findSecretLeaks() {
  const files = walkDir(cwd)
  const seen = new Set()
  const leaks = []

  const logPatterns = [
    /console\.\w+\([^)]*process\.env\.([A-Z_][A-Z0-9_]*)/g,
    /console\.\w+\([^)]*env\.([A-Z_][A-Z0-9_]*)/g,
    /console\.\w+\(`[^`]*\$\{(?:process\.env|env)\.([A-Z_][A-Z0-9_]*)\}/g,
  ]

  for (const file of files) {
    let content
    try { content = readFileSync(file, 'utf-8') } catch { continue }
    const rel = relative(cwd, file)

    for (const pattern of logPatterns) {
      pattern.lastIndex = 0
      for (const match of content.matchAll(pattern)) {
        const key = match[1]
        const id = `${key}::${rel}`
        if (!seen.has(id) && SECRET_KEYWORDS.some(k => key.includes(k))) {
          seen.add(id)
          leaks.push({ key, file: rel })
        }
      }
    }
  }

  return leaks
}

const commands = {
  check() {
    const envPath = resolve(cwd, '.env')
    if (!existsSync(envPath)) {
      console.log(c(31, '\n  ✖ No .env file found\n'))
      process.exit(1)
    }
    const vars = parseEnvFile(envPath)
    const count = Object.keys(vars).length
    const empty = Object.values(vars).filter(v => !v).length
    console.log('')
    console.log(c(32, `  ✔ Found ${count} variable${count !== 1 ? 's' : ''} in .env`))
    if (empty > 0) console.log(c(33, `  ⚠  ${empty} variable${empty !== 1 ? 's are' : ' is'} empty`))
    console.log('')
  },

  doctor() {
    const envFiles = [
      '.env', '.env.local',
      '.env.development', '.env.development.local',
      '.env.production', '.env.production.local',
      '.env.test', '.env.test.local',
      '.env.staging',
    ]
      .map(f => resolve(cwd, f))
      .filter(f => existsSync(f))

    if (envFiles.length === 0) {
      console.log(c(33, '\n  No .env files found\n'))
      return
    }

    console.log('')
    console.log(c(36, '  envault doctor'))
    console.log('')

    for (const filePath of envFiles) {
      const label = relative(cwd, filePath)
      const vars = parseEnvFile(filePath)
      const keys = Object.keys(vars)

      console.log(c(90, `  ── ${label} (${keys.length} vars)`))

      if (keys.length === 0) {
        console.log(c(90, '     (empty)'))
      } else {
        for (const [key, val] of Object.entries(vars)) {
          const isSecret = SECRET_KEYWORDS.some(k => key.toUpperCase().includes(k))
          const display = isSecret ? maskValue(val) : (val || c(90, '(empty)'))
          const dot = val ? c(32, '●') : c(31, '○')
          console.log(`  ${dot}  ${c(33, key.padEnd(32))}${display}`)
        }
      }
      console.log('')
    }
  },

  generate() {
    const envPath = resolve(cwd, '.env')
    if (!existsSync(envPath)) {
      console.log(c(31, '\n  ✖ No .env file found\n'))
      process.exit(1)
    }

    const vars = parseEnvFile(envPath)
    const outPath = resolve(cwd, '.env.example')
    const lines = []

    for (const [key, val] of Object.entries(vars)) {
      const isSecret = SECRET_KEYWORDS.some(k => key.toUpperCase().includes(k))
      lines.push(`${key}=${isSecret ? '' : val}`)
    }

    writeFileSync(outPath, lines.join('\n') + '\n')
    console.log('')
    console.log(c(32, `  ✔ Generated .env.example with ${lines.length} key${lines.length !== 1 ? 's' : ''}`))
    console.log(c(90, `     Secrets cleared, non-sensitive values preserved`))
    console.log('')
  },

  audit() {
    const envPath = resolve(cwd, '.env')
    const envVars = parseEnvFile(envPath)
    const envKeys = new Set(Object.keys(envVars))

    console.log('')
    console.log(c(36, '  envault audit'))
    console.log('')

    const codeUsage = findEnvUsageInCode()
    const leaks = findSecretLeaks()
    let issues = 0

    for (const [key, files] of codeUsage) {
      if (ALWAYS_SET_KEYS.has(key)) continue
      if (!envKeys.has(key)) {
        console.log(`  ${c(31, '✖')}  ${c(33, key.padEnd(32))}used in code but missing from .env`)
        const preview = files.slice(0, 2).join(', ') + (files.length > 2 ? ` +${files.length - 2} more` : '')
        console.log(c(90, `       ${preview}`))
        issues++
      }
    }

    for (const key of Object.keys(envVars)) {
      if (!codeUsage.has(key) && !ALWAYS_SET_KEYS.has(key)) {
        console.log(`  ${c(33, '⚠')}  ${c(33, key.padEnd(32))}defined in .env but not found in code`)
        issues++
      }
    }

    if (leaks.length > 0) {
      console.log('')
      console.log(c(31, '  Potential secret leaks:'))
      for (const { key, file } of leaks) {
        console.log(`  ${c(31, '✖')}  ${c(33, key.padEnd(32))}logged to console in ${c(90, file)}`)
        issues++
      }
    }

    console.log('')
    if (issues === 0) {
      console.log(c(32, '  ✔ All clear — no issues found'))
    } else {
      console.log(c(33, `  ${issues} issue${issues !== 1 ? 's' : ''} found`))
    }
    console.log('')
  },

  diff() {
    const fileA = process.argv[3] ? resolve(cwd, process.argv[3]) : resolve(cwd, '.env')
    const fileB = process.argv[4] ? resolve(cwd, process.argv[4]) : resolve(cwd, '.env.production')

    if (!existsSync(fileA)) { console.log(c(31, `\n  ✖ Not found: ${fileA}\n`)); process.exit(1) }
    if (!existsSync(fileB)) { console.log(c(31, `\n  ✖ Not found: ${fileB}\n`)); process.exit(1) }

    const a = parseEnvFile(fileA)
    const b = parseEnvFile(fileB)
    const allKeys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()

    console.log('')
    console.log(c(36, '  envault diff'))
    console.log(c(90, `  ${relative(cwd, fileA)}  →  ${relative(cwd, fileB)}`))
    console.log('')

    let diffs = 0
    for (const key of allKeys) {
      const inA = key in a
      const inB = key in b
      if (!inA) {
        console.log(`  ${c(32, '+')}  ${c(33, key.padEnd(32))}${c(90, `only in ${relative(cwd, fileB)}`)}`)
        diffs++
      } else if (!inB) {
        console.log(`  ${c(31, '-')}  ${c(33, key.padEnd(32))}${c(90, `only in ${relative(cwd, fileA)}`)}`)
        diffs++
      } else if (a[key] !== b[key]) {
        const isSecret = SECRET_KEYWORDS.some(k => key.toUpperCase().includes(k))
        const displayA = isSecret ? maskValue(a[key]) : a[key]
        const displayB = isSecret ? maskValue(b[key]) : b[key]
        console.log(`  ${c(33, '~')}  ${c(33, key.padEnd(32))}${displayA}  →  ${displayB}`)
        diffs++
      }
    }

    console.log('')
    if (diffs === 0) {
      console.log(c(32, '  ✔ Files are identical'))
    } else {
      console.log(c(90, `  ${diffs} difference${diffs !== 1 ? 's' : ''}`))
    }
    console.log('')
  },

  watch() {
    const targetFile = process.argv[3] ? resolve(cwd, process.argv[3]) : resolve(cwd, '.env')
    if (!existsSync(targetFile)) {
      console.log(c(31, `\n  ✖ Not found: ${targetFile}\n`))
      process.exit(1)
    }

    const label = relative(cwd, targetFile)
    console.log('')
    console.log(c(36, '  envault watch'))
    console.log(c(90, `  Watching ${label} for changes... (Ctrl+C to stop)`))
    console.log('')

    let prev = parseEnvFile(targetFile)
    let debounce = null

    watch(targetFile, () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        const curr = parseEnvFile(targetFile)
        const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)])
        const changes = []

        for (const key of allKeys) {
          if (!(key in prev)) changes.push({ type: 'added', key })
          else if (!(key in curr)) changes.push({ type: 'removed', key })
          else if (prev[key] !== curr[key]) changes.push({ type: 'changed', key })
        }

        if (changes.length > 0) {
          console.log(c(90, `  [${new Date().toLocaleTimeString()}]`))
          for (const ch of changes) {
            if (ch.type === 'added')   console.log(`  ${c(32, '+')}  ${c(33, ch.key)} added`)
            else if (ch.type === 'removed') console.log(`  ${c(31, '-')}  ${c(33, ch.key)} removed`)
            else                           console.log(`  ${c(33, '~')}  ${c(33, ch.key)} changed`)
          }
          console.log('')
          prev = curr
        }
      }, 80)
    })
  },

  init() {
    const outPath = resolve(cwd, 'env.ts')
    if (existsSync(outPath)) {
      console.log(c(33, '\n  ⚠  env.ts already exists — delete it first to reinitialise\n'))
      process.exit(0)
    }

    const codeUsage = findEnvUsageInCode()
    const envVars = parseEnvFile(resolve(cwd, '.env'))
    const allKeys = [...new Set([...codeUsage.keys(), ...Object.keys(envVars)])].sort()

    const prefixGroups = new Map()

    for (const key of allKeys) {
      const parts = key.split('_')
      if (parts.length >= 3) {
        const prefix = parts[0]
        if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, [])
        prefixGroups.get(prefix).push(key)
      }
    }

    const groupedKeys = new Set()
    for (const [, keys] of prefixGroups) {
      if (keys.length >= 2) for (const k of keys) groupedKeys.add(k)
    }

    const lines = [
      `import { envault, str, num, bool, url, port, email, json, list, uuid, secret, date, phone, semver, ip, hex, enm } from '@jadendev/envault'`,
      ``,
      `export const env = envault({`,
    ]

    const writtenPrefixes = new Set()

    for (const [prefix, keys] of prefixGroups) {
      if (keys.length < 2 || writtenPrefixes.has(prefix)) continue
      writtenPrefixes.add(prefix)

      lines.push(`  ${prefix.toLowerCase()}: {`)
      for (const key of keys.sort()) {
        const suffix = key.slice(prefix.length + 1)
        lines.push(`    ${suffix}: ${guessType(key)},`)
      }
      lines.push(`  },`)
    }

    for (const key of allKeys) {
      if (groupedKeys.has(key)) continue
      lines.push(`  ${key}: ${guessType(key)},`)
    }

    lines.push(`})`)
    lines.push(``)

    writeFileSync(outPath, lines.join('\n'))
    console.log('')
    console.log(c(32, `  ✔ Generated env.ts with ${allKeys.length} variable${allKeys.length !== 1 ? 's' : ''}`))
    console.log(c(90, `     Review types and add options (optional, default, etc.) as needed`))
    console.log('')
  },

  validate() {
    const targetFile = process.argv[3]
    if (!targetFile) { console.log(c(31, '\n  Usage: envault validate <file>\n')); process.exit(1) }

    const filePath = resolve(cwd, targetFile)
    if (!existsSync(filePath)) { console.log(c(31, `\n  ✖ File not found: ${filePath}\n`)); process.exit(1) }

    const vars = parseEnvFile(filePath)
    const count = Object.keys(vars).length
    const empty = Object.values(vars).filter(v => !v).length
    const dupes = []

    const seen = new Map()
    for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      if (!key || key.startsWith('#')) continue
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    for (const [k, n] of seen) {
      if (n > 1) dupes.push(k)
    }

    const hasIssues = empty > 0 || dupes.length > 0

    console.log('')
    console.log(c(36, `  envault validate  ${c(90, relative(cwd, filePath))}`))
    console.log('')
    console.log(`  ${c(32, '✔')}  ${count} variable${count !== 1 ? 's' : ''} parsed`)
    if (empty > 0) console.log(`  ${c(33, '⚠')}  ${empty} empty value${empty !== 1 ? 's' : ''}`)
    for (const k of dupes) {
      console.log(`  ${c(31, '✖')}  ${c(33, k)} is defined more than once`)
    }
    if (!hasIssues) console.log(c(32, '  ✔ File is clean'))
    console.log('')
  },

  export() {
    const envPath = resolve(cwd, process.argv[3] ?? '.env')
    if (!existsSync(envPath)) {
      console.log(c(31, `\n  ✖ Not found: ${envPath}\n`))
      process.exit(1)
    }
    const format = process.argv[4]
    const vars = parseEnvFile(envPath)

    if (format === '--shell') {
      for (const [k, v] of Object.entries(vars)) {
        process.stdout.write(`export ${k}="${v.replace(/"/g, '\\"')}"\n`)
      }
    } else if (format === '--dotenv') {
      for (const [k, v] of Object.entries(vars)) {
        process.stdout.write(`${k}=${v}\n`)
      }
    } else {
      process.stdout.write(JSON.stringify(vars, null, 2) + '\n')
    }
  },

  secrets() {
    const envFiles = ['.env', '.env.local', '.env.production', '.env.staging']
      .map(f => resolve(cwd, f))
      .filter(f => existsSync(f))

    if (envFiles.length === 0) {
      console.log(c(33, '\n  No .env files found\n'))
      return
    }

    console.log('')
    console.log(c(36, '  envault secrets'))
    console.log(c(90, '  All detected secrets across your env files\n'))

    for (const filePath of envFiles) {
      const vars = parseEnvFile(filePath)
      const secrets = Object.entries(vars).filter(([key]) =>
        SECRET_KEYWORDS.some(k => key.toUpperCase().includes(k))
      )

      if (secrets.length === 0) continue

      console.log(c(90, `  ── ${relative(cwd, filePath)}`))
      for (const [key, val] of secrets) {
        const strength = val.length >= 32 ? c(32, '●') : val.length >= 16 ? c(33, '●') : c(31, '●')
        console.log(`  ${strength}  ${c(33, key.padEnd(32))}${maskValue(val)}  ${c(90, `(${val.length} chars)`)}`)
      }
      console.log('')
    }
  },

  copy() {
    const srcFile = process.argv[3]
    const dstFile = process.argv[4]
    if (!srcFile || !dstFile) {
      console.log(c(31, '\n  Usage: envault copy <source> <destination>\n'))
      process.exit(1)
    }
    const src = resolve(cwd, srcFile)
    const dst = resolve(cwd, dstFile)
    if (!existsSync(src)) { console.log(c(31, `\n  ✖ Not found: ${src}\n`)); process.exit(1) }

    const srcVars = parseEnvFile(src)
    const dstVars = existsSync(dst) ? parseEnvFile(dst) : {}

    const added = []
    for (const [k, v] of Object.entries(srcVars)) {
      if (!(k in dstVars)) {
        dstVars[k] = v
        added.push(k)
      }
    }

    const lines = Object.entries(dstVars).map(([k, v]) => `${k}=${v}`)
    writeFileSync(dst, lines.join('\n') + '\n')

    console.log('')
    console.log(c(32, `  ✔ Copied ${added.length} new variable${added.length !== 1 ? 's' : ''} from ${srcFile} → ${dstFile}`))
    if (added.length > 0) {
      for (const k of added) console.log(c(90, `     + ${k}`))
    }
    console.log('')
  },
}

const help = `
${c(36, 'envault')} — environment variable validation CLI

${c(33, 'Usage:')}
  envault <command> [options]

${c(33, 'Commands:')}
  ${c(32, 'check')}               Verify .env exists and report empty values
  ${c(32, 'doctor')}              Show all variables across all .env files (secrets masked)
  ${c(32, 'generate')}            Create .env.example from .env (secrets cleared)
  ${c(32, 'audit')}               Find missing vars, stale vars, and secret leaks in code
  ${c(32, 'diff')} [a] [b]        Compare two env files (default: .env vs .env.production)
  ${c(32, 'watch')} [file]        Watch an env file for changes (default: .env)
  ${c(32, 'init')}                Scaffold env.ts from your codebase
  ${c(32, 'validate')} <file>     Parse and lint a specific env file
  ${c(32, 'export')} [file]       Print env file as JSON to stdout
  ${c(32, 'export')} [f] --shell  Print as shell export statements
  ${c(32, 'secrets')}             List all secrets across env files (masked)
  ${c(32, 'copy')} <src> <dst>    Copy missing vars from one env file to another

${c(33, 'Examples:')}
  envault check
  envault diff .env .env.staging
  envault validate .env.production
  envault export .env | jq '.DATABASE_URL'
  envault export .env --shell >> ~/.zshrc
  envault copy .env.example .env
  envault watch .env.local
`

if (commands[command]) {
  commands[command]()
} else {
  process.stdout.write(help)
  if (command) process.exit(1)
}
