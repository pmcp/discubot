<template>
  <CroutonCollection
    :layout="layout"
    collection="discussion-syncDiscussions"
    :columns="columns"
    :rows="discussions || []"
    :loading="pending"
  >
    <template #header>
      <CroutonTableHeader
        title="DiscussionSyncDiscussions"
        :collection="'discussion-syncDiscussions'"
        createButton
      />
    </template>
    <template #sourceConfigId-cell="{ row }">
      <CroutonItemCardMini
        v-if="row.original.sourceConfigId"
        :id="row.original.sourceConfigId"
        collection="discussionsyncSourceConfigs"
      />
    </template>
    <template #threadId-cell="{ row }">
      <CroutonItemCardMini
        v-if="row.original.threadId"
        :id="row.original.threadId"
        collection="discussionsyncThreads"
      />
    </template>
    <template #syncJobId-cell="{ row }">
      <CroutonItemCardMini
        v-if="row.original.syncJobId"
        :id="row.original.syncJobId"
        collection="discussionsyncSyncJobs"
      />
    </template>
    <template #processedAt-cell="{ row }">
      <CroutonDate :date="row.original.processedAt"></CroutonDate>
    </template>
  </CroutonCollection>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  layout?: any
}>(), {
  layout: 'table'
})

const { columns } = useDiscussionSyncDiscussions()

const { items: discussions, pending } = await useCollectionQuery(
  'discussion-syncDiscussions'
)
</script>