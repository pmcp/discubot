import { z } from 'zod'

export const discussionsyncThreadSchema = z.object({
  discussionId: z.string().min(1, 'discussionId is required'),
  sourceType: z.string().min(1, 'sourceType is required'),
  rootMessage: z.object({}),
  replies: z.object({}).optional(),
  totalMessages: z.number().optional(),
  participants: z.array(z.string()).optional(),
  aiSummary: z.string().optional(),
  aiKeyPoints: z.array(z.string()).optional(),
  aiContext: z.string().optional(),
  isMultiTask: z.boolean().optional(),
  detectedTasks: z.object({}).optional(),
  status: z.string().min(1, 'status is required'),
  metadata: z.object({}).optional()
})

export const discussionsyncThreadsColumns = [
  { accessorKey: 'id', header: 'Id' },
  { accessorKey: 'discussionId', header: 'DiscussionId' },
  { accessorKey: 'sourceType', header: 'SourceType' },
  { accessorKey: 'rootMessage', header: 'RootMessage' },
  { accessorKey: 'replies', header: 'Replies' },
  { accessorKey: 'totalMessages', header: 'TotalMessages' },
  { accessorKey: 'participants', header: 'Participants' },
  { accessorKey: 'aiSummary', header: 'AiSummary' },
  { accessorKey: 'aiKeyPoints', header: 'AiKeyPoints' },
  { accessorKey: 'aiContext', header: 'AiContext' },
  { accessorKey: 'isMultiTask', header: 'IsMultiTask' },
  { accessorKey: 'detectedTasks', header: 'DetectedTasks' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'metadata', header: 'Metadata' }
]

export const discussionsyncThreadsConfig = {
  name: 'discussionsyncThreads',
  layer: 'discussion-sync',
  apiPath: 'discussion-sync-threads',
  componentName: 'DiscussionSyncThreadsForm',
  schema: discussionsyncThreadSchema,
  defaultValues: {
    discussionId: '',
    sourceType: '',
    rootMessage: {},
    replies: {},
    totalMessages: 0,
    participants: [],
    aiSummary: '',
    aiKeyPoints: [],
    aiContext: '',
    isMultiTask: false,
    detectedTasks: {},
    status: '',
    metadata: {}
  },
  columns: discussionsyncThreadsColumns,
}

export const useDiscussionSyncThreads = () => discussionsyncThreadsConfig

// Default export for auto-import compatibility
export default function () {
  return {
    defaultValue: discussionsyncThreadsConfig.defaultValues,
    schema: discussionsyncThreadsConfig.schema,
    columns: discussionsyncThreadsConfig.columns,
    collection: discussionsyncThreadsConfig.name
  }
}