<template>
  <CroutonCollection
    :layout="layout"
    collection="discussion-syncSourceConfigs"
    :columns="columns"
    :rows="sourceconfigs || []"
    :loading="pending"
  >
    <template #header>
      <CroutonTableHeader
        title="DiscussionSyncSourceConfigs"
        :collection="'discussion-syncSourceConfigs'"
        createButton
      />
    </template>
    <template #sourceId-cell="{ row }">
      <CroutonItemCardMini
        v-if="row.original.sourceId"
        :id="row.original.sourceId"
        collection="discussionsyncSources"
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

const { columns } = useDiscussionSyncSourceConfigs()

const { items: sourceconfigs, pending } = await useCollectionQuery(
  'discussion-syncSourceConfigs'
)
</script>