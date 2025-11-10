<template>
  <div
    class="relative mx-auto w-full max-w-7xl border-x border-b border-neutral-100 p-4 dark:border-white/10"
  >
    <slot />
    <div
      class="absolute -bottom-2.5 -left-2.5 z-40 flex h-5 w-5 items-center justify-center bg-white dark:bg-neutral-900"
    >
      <UIcon
        name="i-lucide-plus"
        class="size-4 text-neutral-400 dark:text-neutral-500"
      />
    </div>
    <div
      class="absolute -right-2.5 -bottom-2.5 z-40 flex h-5 w-5 items-center justify-center bg-white dark:bg-neutral-900"
    >
      <UIcon
        name="i-lucide-plus"
        class="size-4 text-neutral-400 dark:text-neutral-500"
      />
    </div>
  </div>
</template>
