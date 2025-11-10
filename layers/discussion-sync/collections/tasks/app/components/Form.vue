<template>
  <CroutonFormActionButton
    v-if="action === 'delete'"
    :action="action"
    :collection="collection"
    :items="items"
    :loading="loading"
    @click="handleSubmit"
  />

  <UForm
    v-else
    :schema="schema"
    :state="state"
    @submit="handleSubmit"
  >
    <CroutonFormLayout>
      <template #main>
      <div class="flex flex-col gap-4 p-1">
        <UFormField label="DiscussionId" name="discussionId" class="not-last:pb-4">
          <CroutonFormReferenceSelect
            v-model="state.discussionId"
            collection="discussionsyncDiscussions"
            label="DiscussionId"
          />
        </UFormField>
        <UFormField label="ThreadId" name="threadId" class="not-last:pb-4">
          <CroutonFormReferenceSelect
            v-model="state.threadId"
            collection="discussionsyncThreads"
            label="ThreadId"
          />
        </UFormField>
        <UFormField label="SyncJobId" name="syncJobId" class="not-last:pb-4">
          <CroutonFormReferenceSelect
            v-model="state.syncJobId"
            collection="discussionsyncSyncJobs"
            label="SyncJobId"
          />
        </UFormField>
        <UFormField label="NotionPageId" name="notionPageId" class="not-last:pb-4">
          <UInput v-model="state.notionPageId" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="NotionPageUrl" name="notionPageUrl" class="not-last:pb-4">
          <UInput v-model="state.notionPageUrl" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Title" name="title" class="not-last:pb-4">
          <UInput v-model="state.title" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Description" name="description" class="not-last:pb-4">
          <UTextarea v-model="state.description" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Status" name="status" class="not-last:pb-4">
          <UInput v-model="state.status" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Priority" name="priority" class="not-last:pb-4">
          <UInput v-model="state.priority" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Assignee" name="assignee" class="not-last:pb-4">
          <UInput v-model="state.assignee" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Summary" name="summary" class="not-last:pb-4">
          <UTextarea v-model="state.summary" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="SourceUrl" name="sourceUrl" class="not-last:pb-4">
          <UInput v-model="state.sourceUrl" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="IsMultiTaskChild" name="isMultiTaskChild" class="not-last:pb-4">
          <UCheckbox v-model="state.isMultiTaskChild" />
        </UFormField>
        <UFormField label="TaskIndex" name="taskIndex" class="not-last:pb-4">
          <UInputNumber v-model="state.taskIndex" class="w-full" />
        </UFormField>
        <UFormField label="Metadata" name="metadata" class="not-last:pb-4">
          <UInput v-model="state.metadata" class="w-full" size="xl" />
        </UFormField>
      </div>
      </template>

      <template #footer>
        <CroutonFormActionButton
          :action="action"
          :collection="collection"
          :items="items"
          :loading="loading"
        />
      </template>
    </CroutonFormLayout>
  </UForm>
</template>

<script setup lang="ts">
import type { DiscussionSyncTaskFormProps, DiscussionSyncTaskFormData } from '../../types'

const props = defineProps<DiscussionSyncTaskFormProps>()
const { defaultValue, schema, collection } = useDiscussionSyncTasks()

// Form layout configuration
const tabs = ref(false)



// Use new mutation composable for data operations
const { create, update, deleteItems } = useCollectionMutation(collection)

// useCrouton still manages modal state
const { close } = useCrouton()

// Initialize form state with proper values (no watch needed!)
const initialValues = props.action === 'update' && props.activeItem?.id
  ? { ...defaultValue, ...props.activeItem }
  : { ...defaultValue }

const state = ref<DiscussionSyncTaskFormData & { id?: string | null }>(initialValues)

const handleSubmit = async () => {
  try {
    if (props.action === 'create') {
      await create(state.value)
    } else if (props.action === 'update' && state.value.id) {
      await update(state.value.id, state.value)
    } else if (props.action === 'delete') {
      await deleteItems(props.items)
    }

    close()

  } catch (error) {
    console.error('Form submission failed:', error)
    // You can add toast notification here if available
    // toast.add({ title: 'Error', description: 'Failed to submit form', color: 'red' })
  }
}
</script>