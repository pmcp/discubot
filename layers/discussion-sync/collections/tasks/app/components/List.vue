<template>
  <CroutonCollection
    :layout="layout"
    collection="discussion-syncTasks"
    :columns="columns"
    :rows="tasks || []"
    :loading="pending"
  >
    <template #header>
      <CroutonTableHeader
        title="DiscussionSyncTasks"
        :collection="'discussion-syncTasks'"
        createButton
      />
    </template>
    <template #discussionId-cell="{ row }">
      <CroutonItemCardMini
        v-if="row.original.discussionId"
        :id="row.original.discussionId"
        collection="discussionsyncDiscussions"
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
  </CroutonCollection>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  layout?: any
}>(), {
  layout: 'table'
})

const { columns } = useDiscussionSyncTasks()

const { items: tasks, pending } = await useCollectionQuery(
  'discussion-syncTasks'
)
</script>