<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script lang="ts" setup>
definePageMeta({
  middleware: ['super-admin'],
})
</script>
