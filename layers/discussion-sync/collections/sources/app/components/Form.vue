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
        <UFormField label="Name" name="name" class="not-last:pb-4">
          <UInput v-model="state.name" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Description" name="description" class="not-last:pb-4">
          <UTextarea v-model="state.description" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="AdapterClass" name="adapterClass" class="not-last:pb-4">
          <UInput v-model="state.adapterClass" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Icon" name="icon" class="not-last:pb-4">
          <UInput v-model="state.icon" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="ConfigSchema" name="configSchema" class="not-last:pb-4">
          <UInput v-model="state.configSchema" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="WebhookPath" name="webhookPath" class="not-last:pb-4">
          <UInput v-model="state.webhookPath" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="RequiresEmail" name="requiresEmail" class="not-last:pb-4">
          <UCheckbox v-model="state.requiresEmail" />
        </UFormField>
        <UFormField label="RequiresWebhook" name="requiresWebhook" class="not-last:pb-4">
          <UCheckbox v-model="state.requiresWebhook" />
        </UFormField>
        <UFormField label="RequiresApiToken" name="requiresApiToken" class="not-last:pb-4">
          <UCheckbox v-model="state.requiresApiToken" />
        </UFormField>
        <UFormField label="Active" name="active" class="not-last:pb-4">
          <UCheckbox v-model="state.active" />
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
import type { DiscussionSyncSourceFormProps, DiscussionSyncSourceFormData } from '../../types'

const props = defineProps<DiscussionSyncSourceFormProps>()
const { defaultValue, schema, collection } = useDiscussionSyncSources()

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

const state = ref<DiscussionSyncSourceFormData & { id?: string | null }>(initialValues)

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