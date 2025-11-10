<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['team-owner'],
})
</script>
