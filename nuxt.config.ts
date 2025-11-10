import './env'
import vue from '@vitejs/plugin-vue'

export default defineNuxtConfig({
  modules: [
    '@nuxthub/core',
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-auth-utils',
    'nuxthub-ratelimit',
    '@nuxt/eslint',
  ],
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  colorMode: {
    preference: 'system',
  },
  runtimeConfig: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    fromEmail: process.env.FROM_EMAIL,
    emailProvider: process.env.EMAIL_PROVIDER,
    // @ts-expect-error - We're just extending the type
    session: {
      maxAge: 60 * 60 * 24 * 7, // Session expires after 7 days - change it accordingly
    },
    public: {
      host: process.env.BASE_URL,
    },
  },
  future: { compatibilityVersion: 4 },
  compatibilityDate: '2024-07-30',
  nitro: {
    rollupConfig: {
      // @ts-expect-error - Rollup plugin type definitions are incomplete for vue plugin
      plugins: [vue()],
    },
    experimental: {
      tasks: true,
    },
  },
  hub: {
    database: true,
    blob: true,
    kv: true,
  },
  auth: {
    webAuthn: true,
  },
  eslint: {
    config: {
      standalone: true,
      typescript: {
        // Disables strict rules - recommended are still enabled
        strict: false,
        // Enables type-checking - this has a significant performance impact
        tsconfigPath: './tsconfig.json',
      },
      stylistic: {
        indent: 2,
        semi: false,
        quotes: 'single',
        commaDangle: 'always-multiline',
      },
    },
  },
  nuxtHubRateLimit: {
    routes: {
      '/api/auth/*': {
        maxRequests: 15,
        intervalSeconds: 60, // Minimum 60 seconds due to NuxtHub KV TTL limitation
      },
      '/api/**': {
        maxRequests: 150,
        intervalSeconds: 60, // Minimum 60 seconds due to NuxtHub KV TTL limitation
      },
    },
  },
})
