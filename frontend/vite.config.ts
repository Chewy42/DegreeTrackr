import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

const resolvePort = (value?: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const clientPort = resolvePort(process.env.CLIENT_PORT) ?? 3333

const parseAllowedHosts = (value?: string) =>
  value
    ?.split(',')
    .map((host) => host.trim())
    .filter(Boolean)

const allowedHosts =
  parseAllowedHosts(process.env.VITE_ALLOWED_HOSTS) ?? [
    'degreetrackr.replit.app',
    '3e1ce21b-d0b1-42c0-b0fd-b2842c65f6a3-00-u8x7u11n8arh.kirk.replit.dev'
  ]

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: clientPort,
    strictPort: true,
    allowedHosts
  },

})
