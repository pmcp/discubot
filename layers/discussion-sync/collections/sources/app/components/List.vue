<template>
  <CroutonCollection
    :layout="layout"
    collection="discussion-syncSources"
    :columns="columns"
    :rows="sources || []"
    :loading="pending"
  >
    <template #header>
      <CroutonTableHeader
        title="DiscussionSyncSources"
        :collection="'discussion-syncSources'"
        createButton
      />
    </template>
  </CroutonCollection>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  layout?: any
}>(), {
  layout: 'table'
})

const { columns } = useDiscussionSyncSources()

const { items: sources, pending } = await useCollectionQuery(
  'discussion-syncSources'
)
</script>