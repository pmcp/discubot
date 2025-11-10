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
        <UFormField label="SourceType" name="sourceType" class="not-last:pb-4">
          <UInput v-model="state.sourceType" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="RootMessage" name="rootMessage" class="not-last:pb-4">
          <UInput v-model="state.rootMessage" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Replies" name="replies" class="not-last:pb-4">
          <UInput v-model="state.replies" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="TotalMessages" name="totalMessages" class="not-last:pb-4">
          <UInputNumber v-model="state.totalMessages" class="w-full" />
        </UFormField>
        <UFormField label="Participants" name="participants" class="not-last:pb-4">
          <UInput v-model="state.participants" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="AiSummary" name="aiSummary" class="not-last:pb-4">
          <UTextarea v-model="state.aiSummary" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="AiKeyPoints" name="aiKeyPoints" class="not-last:pb-4">
          <UInput v-model="state.aiKeyPoints" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="AiContext" name="aiContext" class="not-last:pb-4">
          <UTextarea v-model="state.aiContext" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="IsMultiTask" name="isMultiTask" class="not-last:pb-4">
          <UCheckbox v-model="state.isMultiTask" />
        </UFormField>
        <UFormField label="DetectedTasks" name="detectedTasks" class="not-last:pb-4">
          <UInput v-model="state.detectedTasks" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Status" name="status" class="not-last:pb-4">
          <UInput v-model="state.status" class="w-full" size="xl" />
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
import type { DiscussionSyncThreadFormProps, DiscussionSyncThreadFormData } from '../../types'

const props = defineProps<DiscussionSyncThreadFormProps>()
const { defaultValue, schema, collection } = useDiscussionSyncThreads()

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

const state = ref<DiscussionSyncThreadFormData & { id?: string | null }>(initialValues)

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