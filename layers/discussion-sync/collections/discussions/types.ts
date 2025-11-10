import type { z } from 'zod'
import type { discussionsyncDiscussionSchema } from './app/composables/useDiscussionSyncDiscussions'

export interface DiscussionSyncDiscussion {
  id: string
  teamId: string
  owner: string
  sourceType: string
  sourceThreadId: string
  sourceUrl: string
  sourceConfigId: string
  title: string
  content: string
  authorHandle: string
  participants?: string[]
  status: string
  threadId?: string
  syncJobId?: string
  rawPayload?: Record<string, any>
  metadata?: Record<string, any>
  processedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
  optimisticId?: string
  optimisticAction?: 'create' | 'update' | 'delete'
}

export type DiscussionSyncDiscussionFormData = z.infer<typeof discussionsyncDiscussionSchema>
export type NewDiscussionSyncDiscussion = Omit<DiscussionSyncDiscussion, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

// Props type for the Form component
export interface DiscussionSyncDiscussionFormProps {
  items: string[] // Array of IDs for delete action
  activeItem: DiscussionSyncDiscussion | Record<string, never> // DiscussionSyncDiscussion for update, empty object for create
  collection: string
  loading: string
  action: 'create' | 'update' | 'delete'
}