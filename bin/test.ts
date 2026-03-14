import 'reflect-metadata'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { configure, processCLIArgs, run } from '@japa/runner'
import { assert } from '@japa/assert'

// ── Load .env ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', '.env')

try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
} catch {
  // .env file not found, assume env vars are already set
}

// ── Configure Japa ─────────────────────────────────────────────────────────────
processCLIArgs(process.argv.splice(2))

configure({
  plugins: [assert()],
  files: ['tests/**/*.spec.ts'],
})

run()