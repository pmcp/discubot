<template>
  <CroutonCollection
    :layout="layout"
    collection="discussion-syncThreads"
    :columns="columns"
    :rows="threads || []"
    :loading="pending"
  >
    <template #header>
      <CroutonTableHeader
        title="DiscussionSyncThreads"
        :collection="'discussion-syncThreads'"
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
  </CroutonCollection>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  layout?: any
}>(), {
  layout: 'table'
})

const { columns } = useDiscussionSyncThreads()

const { items: threads, pending } = await useCollectionQuery(
  'discussion-syncThreads'
)
</script>