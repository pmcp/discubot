import type { z } from 'zod'
import type { discussionsyncThreadSchema } from './app/composables/useDiscussionSyncThreads'

export interface DiscussionSyncThread {
  id: string
  teamId: string
  owner: string
  discussionId: string
  sourceType: string
  rootMessage: Record<string, any>
  replies?: Record<string, any>
  totalMessages?: number
  participants?: string[]
  aiSummary?: string
  aiKeyPoints?: string[]
  aiContext?: string
  isMultiTask?: boolean
  detectedTasks?: Record<string, any>
  status: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
  optimisticId?: string
  optimisticAction?: 'create' | 'update' | 'delete'
}

export type DiscussionSyncThreadFormData = z.infer<typeof discussionsyncThreadSchema>
export type NewDiscussionSyncThread = Omit<DiscussionSyncThread, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

// Props type for the Form component
export interface DiscussionSyncThreadFormProps {
  items: string[] // Array of IDs for delete action
  activeItem: DiscussionSyncThread | Record<string, never> // DiscussionSyncThread for update, empty object for create
  collection: string
  loading: string
  action: 'create' | 'update' | 'delete'
}