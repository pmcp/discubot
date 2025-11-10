<template>
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator color="#000000" />
  <UApp :toaster="{ position: 'top-center' }">
    <NuxtPage />
  </UApp>
</template>

<script lang="ts" setup>
useSeoMeta({
  title: 'Supersaas',
  description: 'The fullstack Nuxt 3 SaaS starter kit',
})
</script>
