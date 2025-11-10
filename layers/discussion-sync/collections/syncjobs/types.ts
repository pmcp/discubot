import type { z } from 'zod'
import type { discussionsyncSyncJobSchema } from './app/composables/useDiscussionSyncSyncJobs'

export interface DiscussionSyncSyncJob {
  id: string
  teamId: string
  owner: string
  discussionId: string
  sourceConfigId: string
  status: string
  stage?: string
  attempts: number
  maxAttempts: number
  error?: string
  errorStack?: string
  startedAt?: Date | null
  completedAt?: Date | null
  processingTime?: number
  taskIds?: string[]
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
  optimisticId?: string
  optimisticAction?: 'create' | 'update' | 'delete'
}

export type DiscussionSyncSyncJobFormData = z.infer<typeof discussionsyncSyncJobSchema>
export type NewDiscussionSyncSyncJob = Omit<DiscussionSyncSyncJob, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

// Props type for the Form component
export interface DiscussionSyncSyncJobFormProps {
  items: string[] // Array of IDs for delete action
  activeItem: DiscussionSyncSyncJob | Record<string, never> // DiscussionSyncSyncJob for update, empty object for create
  collection: string
  loading: string
  action: 'create' | 'update' | 'delete'
}