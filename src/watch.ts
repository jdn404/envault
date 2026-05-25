import { watch, existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { WatchEvent } from './types.js'

export interface WatchHandle {
  stop: () => void
  on: (event: 'change', handler: (events: WatchEvent[]) => void) => WatchHandle
  on: (event: 'error', handler: (err: Error) => void) => WatchHandle
  on: (event: 'ready', handler: () => void) => WatchHandle
}

export type WatchHandler = (events: WatchEvent[], current: Record<string, string>) => void
export type ErrorHandler = (err: Error) => void

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let val = trimmed.slice(eq + 1)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    result[key] = val
  }
  return result
}

function diffEnvMaps(
  prev: Record<string, string>,
  curr: Record<string, string>
): WatchEvent[] {
  const events: WatchEvent[] = []
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)])

  for (const key of allKeys) {
    if (!(key in prev) && key in curr) {
      events.push({ type: 'added', key, newValue: curr[key] })
    } else if (key in prev && !(key in curr)) {
      events.push({ type: 'removed', key, oldValue: prev[key] })
    } else if (prev[key] !== curr[key]) {
      events.push({ type: 'changed', key, oldValue: prev[key], newValue: curr[key] })
    }
  }

  return events
}

export function watchEnvFile(
  filePath: string,
  handler: WatchHandler,
  options: { debounce?: number; onError?: ErrorHandler } = {}
): WatchHandle {
  const { debounce = 100, onError } = options
  const absPath = resolve(process.cwd(), filePath)

  if (!existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`)
  }

  let prev = parseEnvFile(readFileSync(absPath, 'utf-8'))
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const watcher = watch(absPath, { persistent: false }, () => {
    if (stopped) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      try {
        const content = readFileSync(absPath, 'utf-8')
        const curr = parseEnvFile(content)
        const events = diffEnvMaps(prev, curr)
        if (events.length > 0) {
          prev = curr
          handler(events, curr)
        }
      } catch (e) {
        if (onError) onError(e as Error)
      }
    }, debounce)
  })

  const handle: WatchHandle = {
    stop: () => {
      stopped = true
      if (debounceTimer) clearTimeout(debounceTimer)
      watcher.close()
    },
    on: (event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'error') watcher.on('error', cb as (err: Error) => void)
      return handle
    },
  }

  return handle
}

export function watchMultipleFiles(
  filePaths: string[],
  handler: WatchHandler,
  options: { debounce?: number; onError?: ErrorHandler } = {}
): WatchHandle {
  const handles: WatchHandle[] = []
  const allVars: Record<string, Record<string, string>> = {}

  const merged = (): Record<string, string> => {
    const result: Record<string, string> = {}
    for (const vars of Object.values(allVars)) Object.assign(result, vars)
    return result
  }

  for (const filePath of filePaths) {
    const absPath = resolve(process.cwd(), filePath)
    if (!existsSync(absPath)) continue

    allVars[filePath] = parseEnvFile(readFileSync(absPath, 'utf-8'))

    const handle = watchEnvFile(filePath, (events) => {
      const prevMerged = merged()
      for (const event of events) {
        if (event.type === 'added' || event.type === 'changed') {
          allVars[filePath][event.key] = event.newValue!
        } else {
          delete allVars[filePath][event.key]
        }
      }
      const currMerged = merged()
      const mergedEvents = diffEnvMaps(prevMerged, currMerged)
      if (mergedEvents.length > 0) handler(mergedEvents, currMerged)
    }, options)

    handles.push(handle)
  }

  return {
    stop: () => { for (const h of handles) h.stop() },
    on: (event: string, cb: (...args: unknown[]) => void) => {
      for (const h of handles) h.on(event as 'change', cb as WatchHandler)
      return { stop: () => {}, on: () => ({ stop: () => {}, on: () => ({} as WatchHandle) }) } as WatchHandle
    },
  }
}

export function createLiveEnv<T extends Record<string, unknown>>(
  initialEnv: T,
  filePath: string,
  options: { debounce?: number } = {}
): { env: T; stop: () => void } {
  const env = { ...initialEnv }

  const handle = watchEnvFile(filePath, (events) => {
    for (const event of events) {
      if (event.type === 'removed') {
        delete (env as Record<string, unknown>)[event.key]
      } else {
        ;(env as Record<string, unknown>)[event.key] = event.newValue
      }
    }
  }, options)

  return { env: env as T, stop: handle.stop }
}
