import type { z } from 'zod'
import type { discussionsyncSourceSchema } from './app/composables/useDiscussionSyncSources'

export interface DiscussionSyncSource {
  id: string
  teamId: string
  owner: string
  sourceType: string
  name: string
  description?: string
  adapterClass: string
  icon?: string
  configSchema?: Record<string, any>
  webhookPath?: string
  requiresEmail?: boolean
  requiresWebhook?: boolean
  requiresApiToken?: boolean
  active: boolean
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
  optimisticId?: string
  optimisticAction?: 'create' | 'update' | 'delete'
}

export type DiscussionSyncSourceFormData = z.infer<typeof discussionsyncSourceSchema>
export type NewDiscussionSyncSource = Omit<DiscussionSyncSource, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

// Props type for the Form component
export interface DiscussionSyncSourceFormProps {
  items: string[] // Array of IDs for delete action
  activeItem: DiscussionSyncSource | Record<string, never> // DiscussionSyncSource for update, empty object for create
  collection: string
  loading: string
  action: 'create' | 'update' | 'delete'
}