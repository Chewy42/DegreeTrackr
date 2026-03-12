import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8')
}

const wranglerToml = read('wrangler.toml')
assert(wranglerToml.includes('pages_build_output_dir = "frontend/dist"'), 'wrangler.toml must point Pages at frontend/dist')

const distRedirects = path.join(repoRoot, 'frontend/dist/_redirects')
assert(fs.existsSync(distRedirects), 'frontend/dist/_redirects must exist after build for SPA routing')

const rootEnv = read('.env.example')
const frontendEnv = read('frontend/.env.example')
for (const key of ['VITE_CLERK_PUBLISHABLE_KEY', 'VITE_CONVEX_URL', 'VITE_API_BASE_URL']) {
  assert(rootEnv.includes(key), `.env.example missing ${key}`)
  assert(frontendEnv.includes(key), `frontend/.env.example missing ${key}`)
}

console.log('Cloudflare Pages release check passed:')
console.log('- wrangler.toml points at frontend/dist')
console.log('- frontend/dist/_redirects exists')
console.log('- required env keys are documented in both env examples')
