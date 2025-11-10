import { z } from 'zod'

export const discussionsyncSourceConfigSchema = z.object({
  sourceId: z.string().min(1, 'sourceId is required'),
  name: z.string().min(1, 'name is required'),
  emailAddress: z.string().optional(),
  emailSlug: z.string().optional(),
  webhookUrl: z.string().optional(),
  webhookSecret: z.string().optional(),
  apiToken: z.string().optional(),
  notionToken: z.string().optional(),
  notionDatabaseId: z.string().min(1, 'notionDatabaseId is required'),
  notionFieldMapping: z.object({}).optional(),
  anthropicApiKey: z.string().optional(),
  aiEnabled: z.boolean(),
  aiSummaryPrompt: z.string().optional(),
  aiTaskPrompt: z.string().optional(),
  autoSync: z.boolean(),
  postConfirmation: z.boolean(),
  active: z.boolean(),
  onboardingComplete: z.boolean(),
  sourceMetadata: z.object({}).optional()
})

export const discussionsyncSourceConfigsColumns = [
  { accessorKey: 'id', header: 'Id' },
  { accessorKey: 'sourceId', header: 'SourceId' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'emailAddress', header: 'EmailAddress' },
  { accessorKey: 'emailSlug', header: 'EmailSlug' },
  { accessorKey: 'webhookUrl', header: 'WebhookUrl' },
  { accessorKey: 'webhookSecret', header: 'WebhookSecret' },
  { accessorKey: 'apiToken', header: 'ApiToken' },
  { accessorKey: 'notionToken', header: 'NotionToken' },
  { accessorKey: 'notionDatabaseId', header: 'NotionDatabaseId' },
  { accessorKey: 'notionFieldMapping', header: 'NotionFieldMapping' },
  { accessorKey: 'anthropicApiKey', header: 'AnthropicApiKey' },
  { accessorKey: 'aiEnabled', header: 'AiEnabled' },
  { accessorKey: 'aiSummaryPrompt', header: 'AiSummaryPrompt' },
  { accessorKey: 'aiTaskPrompt', header: 'AiTaskPrompt' },
  { accessorKey: 'autoSync', header: 'AutoSync' },
  { accessorKey: 'postConfirmation', header: 'PostConfirmation' },
  { accessorKey: 'active', header: 'Active' },
  { accessorKey: 'onboardingComplete', header: 'OnboardingComplete' },
  { accessorKey: 'sourceMetadata', header: 'SourceMetadata' }
]

export const discussionsyncSourceConfigsConfig = {
  name: 'discussionsyncSourceConfigs',
  layer: 'discussion-sync',
  apiPath: 'discussion-sync-sourceconfigs',
  componentName: 'DiscussionSyncSourceConfigsForm',
  schema: discussionsyncSourceConfigSchema,
  defaultValues: {
    sourceId: '',
    name: '',
    emailAddress: '',
    emailSlug: '',
    webhookUrl: '',
    webhookSecret: '',
    apiToken: '',
    notionToken: '',
    notionDatabaseId: '',
    notionFieldMapping: {},
    anthropicApiKey: '',
    aiEnabled: false,
    aiSummaryPrompt: '',
    aiTaskPrompt: '',
    autoSync: false,
    postConfirmation: false,
    active: false,
    onboardingComplete: false,
    sourceMetadata: {}
  },
  columns: discussionsyncSourceConfigsColumns,
}

export const useDiscussionSyncSourceConfigs = () => discussionsyncSourceConfigsConfig

// Default export for auto-import compatibility
export default function () {
  return {
    defaultValue: discussionsyncSourceConfigsConfig.defaultValues,
    schema: discussionsyncSourceConfigsConfig.schema,
    columns: discussionsyncSourceConfigsConfig.columns,
    collection: discussionsyncSourceConfigsConfig.name
  }
}