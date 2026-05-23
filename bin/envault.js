#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const command = process.argv[2]
const envPath = resolve(process.cwd(), '.env')

function readEnv() {
  if (!existsSync(envPath)) return {}
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  const result = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return result
}

if (command === 'check') {
  if (!existsSync(envPath)) {
    console.log('\x1b[31m❌ No .env file found\x1b[0m')
    process.exit(1)
  }
  const vars = readEnv()
  console.log(`\x1b[32m✅ Found ${Object.keys(vars).length} variables in .env\x1b[0m`)

} else if (command === 'doctor') {
  const vars = readEnv()
  console.log('\n\x1b[36menvault doctor\x1b[0m\n')
  for (const [key, val] of Object.entries(vars)) {
    const masked = val.length > 4 ? val.slice(0, 2) + '*'.repeat(val.length - 2) : '****'
    console.log(`  \x1b[33m${key.padEnd(25)}\x1b[0m ${masked}`)
  }
  console.log('')

} else if (command === 'generate') {
  const vars = readEnv()
  const example = Object.keys(vars).map(k => `${k}=`).join('\n')
  const outPath = resolve(process.cwd(), '.env.example')
  import('fs').then(({ writeFileSync }) => {
    writeFileSync(outPath, example)
    console.log(`\x1b[32m✅ Generated .env.example with ${Object.keys(vars).length} keys\x1b[0m`)
  })

} else {
  console.log('\nUsage: envault <command>\n')
  console.log('  check      validate .env file exists and is readable')
  console.log('  doctor     show all variables with masked values')
  console.log('  generate   create .env.example from current .env\n')
}
