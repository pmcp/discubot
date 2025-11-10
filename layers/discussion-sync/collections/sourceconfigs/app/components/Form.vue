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
        <UFormField label="SourceId" name="sourceId" class="not-last:pb-4">
          <CroutonFormReferenceSelect
            v-model="state.sourceId"
            collection="discussionsyncSources"
            label="SourceId"
          />
        </UFormField>
        <UFormField label="Name" name="name" class="not-last:pb-4">
          <UInput v-model="state.name" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="EmailAddress" name="emailAddress" class="not-last:pb-4">
          <UInput v-model="state.emailAddress" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="EmailSlug" name="emailSlug" class="not-last:pb-4">
          <UInput v-model="state.emailSlug" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="WebhookUrl" name="webhookUrl" class="not-last:pb-4">
          <UInput v-model="state.webhookUrl" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="WebhookSecret" name="webhookSecret" class="not-last:pb-4">
          <UInput v-model="state.webhookSecret" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="ApiToken" name="apiToken" class="not-last:pb-4">
          <UInput v-model="state.apiToken" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="NotionToken" name="notionToken" class="not-last:pb-4">
          <UInput v-model="state.notionToken" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="NotionDatabaseId" name="notionDatabaseId" class="not-last:pb-4">
          <UInput v-model="state.notionDatabaseId" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="NotionFieldMapping" name="notionFieldMapping" class="not-last:pb-4">
          <UInput v-model="state.notionFieldMapping" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="AnthropicApiKey" name="anthropicApiKey" class="not-last:pb-4">
          <UInput v-model="state.anthropicApiKey" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="AiEnabled" name="aiEnabled" class="not-last:pb-4">
          <UCheckbox v-model="state.aiEnabled" />
        </UFormField>
        <UFormField label="AiSummaryPrompt" name="aiSummaryPrompt" class="not-last:pb-4">
          <UTextarea v-model="state.aiSummaryPrompt" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="AiTaskPrompt" name="aiTaskPrompt" class="not-last:pb-4">
          <UTextarea v-model="state.aiTaskPrompt" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="AutoSync" name="autoSync" class="not-last:pb-4">
          <UCheckbox v-model="state.autoSync" />
        </UFormField>
        <UFormField label="PostConfirmation" name="postConfirmation" class="not-last:pb-4">
          <UCheckbox v-model="state.postConfirmation" />
        </UFormField>
        <UFormField label="Active" name="active" class="not-last:pb-4">
          <UCheckbox v-model="state.active" />
        </UFormField>
        <UFormField label="OnboardingComplete" name="onboardingComplete" class="not-last:pb-4">
          <UCheckbox v-model="state.onboardingComplete" />
        </UFormField>
        <UFormField label="SourceMetadata" name="sourceMetadata" class="not-last:pb-4">
          <UInput v-model="state.sourceMetadata" class="w-full" size="xl" />
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
import type { DiscussionSyncSourceConfigFormProps, DiscussionSyncSourceConfigFormData } from '../../types'

const props = defineProps<DiscussionSyncSourceConfigFormProps>()
const { defaultValue, schema, collection } = useDiscussionSyncSourceConfigs()

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

const state = ref<DiscussionSyncSourceConfigFormData & { id?: string | null }>(initialValues)

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