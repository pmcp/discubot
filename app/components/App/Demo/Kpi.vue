<template>
  <AppDemoCard :title="title" :description="description">
    <div class="flex items-end gap-3">
      <p class="text-2xl font-bold sm:text-4xl">{{ value }}</p>
      <span v-if="down" class="flex items-center gap-1 text-rose-500">
        <UIcon name="i-lucide-arrow-down" />
        <span>{{ down }}</span>
      </span>
      <span v-if="up" class="flex items-center gap-1 text-emerald-500">
        <UIcon name="i-lucide-arrow-up" />
        <span>{{ up }}</span>
      </span>
    </div>
  </AppDemoCard>
</template>

<script lang="ts" setup>
defineProps<{
  title: string
  value: string
  down?: string
  up?: string
  description?: string
}>()
</script>
