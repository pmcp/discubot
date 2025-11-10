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
        <UFormField label="SourceType" name="sourceType" class="not-last:pb-4">
          <UInput v-model="state.sourceType" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="SourceThreadId" name="sourceThreadId" class="not-last:pb-4">
          <UInput v-model="state.sourceThreadId" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="SourceUrl" name="sourceUrl" class="not-last:pb-4">
          <UInput v-model="state.sourceUrl" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="SourceConfigId" name="sourceConfigId" class="not-last:pb-4">
          <CroutonFormReferenceSelect
            v-model="state.sourceConfigId"
            collection="discussionsyncSourceConfigs"
            label="SourceConfigId"
          />
        </UFormField>
        <UFormField label="Title" name="title" class="not-last:pb-4">
          <UInput v-model="state.title" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Content" name="content" class="not-last:pb-4">
          <UTextarea v-model="state.content" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="AuthorHandle" name="authorHandle" class="not-last:pb-4">
          <UInput v-model="state.authorHandle" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Participants" name="participants" class="not-last:pb-4">
          <UInput v-model="state.participants" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Status" name="status" class="not-last:pb-4">
          <UInput v-model="state.status" class="w-full" size="xl" />
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
        <UFormField label="RawPayload" name="rawPayload" class="not-last:pb-4">
          <UInput v-model="state.rawPayload" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Metadata" name="metadata" class="not-last:pb-4">
          <UInput v-model="state.metadata" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="ProcessedAt" name="processedAt" class="not-last:pb-4">
          <CroutonCalendar v-model:date="state.processedAt" />
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
import type { DiscussionSyncDiscussionFormProps, DiscussionSyncDiscussionFormData } from '../../types'

const props = defineProps<DiscussionSyncDiscussionFormProps>()
const { defaultValue, schema, collection } = useDiscussionSyncDiscussions()

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

// Convert date strings to Date objects for date fields during editing
if (props.action === 'update' && props.activeItem?.id) {
  if (initialValues.processedAt) {
    initialValues.processedAt = new Date(initialValues.processedAt)
  }
}

const state = ref<DiscussionSyncDiscussionFormData & { id?: string | null }>(initialValues)

const handleSubmit = async () => {
  try {
    // Serialize Date objects to ISO strings for API submission
    const serializedData = { ...state.value }
    if (serializedData.processedAt instanceof Date) {
      serializedData.processedAt = serializedData.processedAt.toISOString()
    }

    if (props.action === 'create') {
      await create(serializedData)
    } else if (props.action === 'update' && state.value.id) {
      await update(state.value.id, serializedData)
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