import { z } from 'zod'

export const discussionsyncSourceSchema = z.object({
  sourceType: z.string().min(1, 'sourceType is required'),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  adapterClass: z.string().min(1, 'adapterClass is required'),
  icon: z.string().optional(),
  configSchema: z.object({}).optional(),
  webhookPath: z.string().optional(),
  requiresEmail: z.boolean().optional(),
  requiresWebhook: z.boolean().optional(),
  requiresApiToken: z.boolean().optional(),
  active: z.boolean(),
  metadata: z.object({}).optional()
})

export const discussionsyncSourcesColumns = [
  { accessorKey: 'id', header: 'Id' },
  { accessorKey: 'sourceType', header: 'SourceType' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'description', header: 'Description' },
  { accessorKey: 'adapterClass', header: 'AdapterClass' },
  { accessorKey: 'icon', header: 'Icon' },
  { accessorKey: 'configSchema', header: 'ConfigSchema' },
  { accessorKey: 'webhookPath', header: 'WebhookPath' },
  { accessorKey: 'requiresEmail', header: 'RequiresEmail' },
  { accessorKey: 'requiresWebhook', header: 'RequiresWebhook' },
  { accessorKey: 'requiresApiToken', header: 'RequiresApiToken' },
  { accessorKey: 'active', header: 'Active' },
  { accessorKey: 'metadata', header: 'Metadata' }
]

export const discussionsyncSourcesConfig = {
  name: 'discussionsyncSources',
  layer: 'discussion-sync',
  apiPath: 'discussion-sync-sources',
  componentName: 'DiscussionSyncSourcesForm',
  schema: discussionsyncSourceSchema,
  defaultValues: {
    sourceType: '',
    name: '',
    description: '',
    adapterClass: '',
    icon: '',
    configSchema: {},
    webhookPath: '',
    requiresEmail: false,
    requiresWebhook: false,
    requiresApiToken: false,
    active: false,
    metadata: {}
  },
  columns: discussionsyncSourcesColumns,
}

export const useDiscussionSyncSources = () => discussionsyncSourcesConfig

// Default export for auto-import compatibility
export default function () {
  return {
    defaultValue: discussionsyncSourcesConfig.defaultValues,
    schema: discussionsyncSourcesConfig.schema,
    columns: discussionsyncSourcesConfig.columns,
    collection: discussionsyncSourcesConfig.name
  }
}