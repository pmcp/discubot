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
        <UFormField label="SourceConfigId" name="sourceConfigId" class="not-last:pb-4">
          <CroutonFormReferenceSelect
            v-model="state.sourceConfigId"
            collection="discussionsyncSourceConfigs"
            label="SourceConfigId"
          />
        </UFormField>
        <UFormField label="Status" name="status" class="not-last:pb-4">
          <UInput v-model="state.status" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Stage" name="stage" class="not-last:pb-4">
          <UInput v-model="state.stage" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Attempts" name="attempts" class="not-last:pb-4">
          <UInputNumber v-model="state.attempts" class="w-full" />
        </UFormField>
        <UFormField label="MaxAttempts" name="maxAttempts" class="not-last:pb-4">
          <UInputNumber v-model="state.maxAttempts" class="w-full" />
        </UFormField>
        <UFormField label="Error" name="error" class="not-last:pb-4">
          <UTextarea v-model="state.error" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="ErrorStack" name="errorStack" class="not-last:pb-4">
          <UTextarea v-model="state.errorStack" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="StartedAt" name="startedAt" class="not-last:pb-4">
          <CroutonCalendar v-model:date="state.startedAt" />
        </UFormField>
        <UFormField label="CompletedAt" name="completedAt" class="not-last:pb-4">
          <CroutonCalendar v-model:date="state.completedAt" />
        </UFormField>
        <UFormField label="ProcessingTime" name="processingTime" class="not-last:pb-4">
          <UInputNumber v-model="state.processingTime" class="w-full" />
        </UFormField>
        <UFormField label="TaskIds" name="taskIds" class="not-last:pb-4">
          <UInput v-model="state.taskIds" class="w-full" size="xl" />
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
import type { DiscussionSyncSyncJobFormProps, DiscussionSyncSyncJobFormData } from '../../types'

const props = defineProps<DiscussionSyncSyncJobFormProps>()
const { defaultValue, schema, collection } = useDiscussionSyncSyncJobs()

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
  if (initialValues.startedAt) {
    initialValues.startedAt = new Date(initialValues.startedAt)
  }
  if (initialValues.completedAt) {
    initialValues.completedAt = new Date(initialValues.completedAt)
  }
}

const state = ref<DiscussionSyncSyncJobFormData & { id?: string | null }>(initialValues)

const handleSubmit = async () => {
  try {
    // Serialize Date objects to ISO strings for API submission
    const serializedData = { ...state.value }
    if (serializedData.startedAt instanceof Date) {
      serializedData.startedAt = serializedData.startedAt.toISOString()
    }
    if (serializedData.completedAt instanceof Date) {
      serializedData.completedAt = serializedData.completedAt.toISOString()
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