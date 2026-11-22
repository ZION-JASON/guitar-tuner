import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const resolveSiteOrigin = () => {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '')
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/+$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, '')
  }
  return 'https://guitar-tuner-ruby.vercel.app'
}

const openGraphOriginPlugin = () => ({
  name: 'chromatuner-og-origin',
  transformIndexHtml(html) {
    const origin = resolveSiteOrigin()
    return html.replaceAll('https://guitar-tuner-ruby.vercel.app', origin)
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), openGraphOriginPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    cors: false,
    fs: {
      strict: true,
    },
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()',
    },
  },
})