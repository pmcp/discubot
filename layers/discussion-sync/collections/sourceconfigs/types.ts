import type { z } from 'zod'
import type { discussionsyncSourceConfigSchema } from './app/composables/useDiscussionSyncSourceConfigs'

export interface DiscussionSyncSourceConfig {
  id: string
  teamId: string
  owner: string
  sourceId: string
  name: string
  emailAddress?: string
  emailSlug?: string
  webhookUrl?: string
  webhookSecret?: string
  apiToken?: string
  notionToken?: string
  notionDatabaseId: string
  notionFieldMapping?: Record<string, any>
  anthropicApiKey?: string
  aiEnabled: boolean
  aiSummaryPrompt?: string
  aiTaskPrompt?: string
  autoSync: boolean
  postConfirmation: boolean
  active: boolean
  onboardingComplete: boolean
  sourceMetadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
  optimisticId?: string
  optimisticAction?: 'create' | 'update' | 'delete'
}

export type DiscussionSyncSourceConfigFormData = z.infer<typeof discussionsyncSourceConfigSchema>
export type NewDiscussionSyncSourceConfig = Omit<DiscussionSyncSourceConfig, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

// Props type for the Form component
export interface DiscussionSyncSourceConfigFormProps {
  items: string[] // Array of IDs for delete action
  activeItem: DiscussionSyncSourceConfig | Record<string, never> // DiscussionSyncSourceConfig for update, empty object for create
  collection: string
  loading: string
  action: 'create' | 'update' | 'delete'
}