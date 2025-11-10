import type { z } from 'zod'
import type { discussionsyncTaskSchema } from './app/composables/useDiscussionSyncTasks'

export interface DiscussionSyncTask {
  id: string
  teamId: string
  owner: string
  discussionId: string
  threadId?: string
  syncJobId: string
  notionPageId: string
  notionPageUrl: string
  title: string
  description?: string
  status: string
  priority?: string
  assignee?: string
  summary?: string
  sourceUrl?: string
  isMultiTaskChild: boolean
  taskIndex?: number
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
  optimisticId?: string
  optimisticAction?: 'create' | 'update' | 'delete'
}

export type DiscussionSyncTaskFormData = z.infer<typeof discussionsyncTaskSchema>
export type NewDiscussionSyncTask = Omit<DiscussionSyncTask, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

// Props type for the Form component
export interface DiscussionSyncTaskFormProps {
  items: string[] // Array of IDs for delete action
  activeItem: DiscussionSyncTask | Record<string, never> // DiscussionSyncTask for update, empty object for create
  collection: string
  loading: string
  action: 'create' | 'update' | 'delete'
}