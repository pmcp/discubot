export default defineAppConfig({
  ui: {
    icons: {
      loading: 'i-lucide-loader-circle',
    },
    button: {
      slots: {
        base: 'cursor-pointer',
      },
    },
    colors: {
      primary: 'emerald',
      neutral: 'neutral',
    },
  },
  seo: {
    title: 'Supersaas',
    description: 'The fullstack Nuxt 3 SaaS starter kit',
  },
})
