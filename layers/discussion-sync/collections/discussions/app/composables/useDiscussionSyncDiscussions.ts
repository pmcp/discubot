import { z } from 'zod'

export const discussionsyncDiscussionSchema = z.object({
  sourceType: z.string().min(1, 'sourceType is required'),
  sourceThreadId: z.string().min(1, 'sourceThreadId is required'),
  sourceUrl: z.string().min(1, 'sourceUrl is required'),
  sourceConfigId: z.string().min(1, 'sourceConfigId is required'),
  title: z.string().min(1, 'title is required'),
  content: z.string().min(1, 'content is required'),
  authorHandle: z.string().min(1, 'authorHandle is required'),
  participants: z.array(z.string()).optional(),
  status: z.string().min(1, 'status is required'),
  threadId: z.string().optional(),
  syncJobId: z.string().optional(),
  rawPayload: z.object({}).optional(),
  metadata: z.object({}).optional(),
  processedAt: z.date().optional()
})

export const discussionsyncDiscussionsColumns = [
  { accessorKey: 'id', header: 'Id' },
  { accessorKey: 'sourceType', header: 'SourceType' },
  { accessorKey: 'sourceThreadId', header: 'SourceThreadId' },
  { accessorKey: 'sourceUrl', header: 'SourceUrl' },
  { accessorKey: 'sourceConfigId', header: 'SourceConfigId' },
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'content', header: 'Content' },
  { accessorKey: 'authorHandle', header: 'AuthorHandle' },
  { accessorKey: 'participants', header: 'Participants' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'threadId', header: 'ThreadId' },
  { accessorKey: 'syncJobId', header: 'SyncJobId' },
  { accessorKey: 'rawPayload', header: 'RawPayload' },
  { accessorKey: 'metadata', header: 'Metadata' },
  { accessorKey: 'processedAt', header: 'ProcessedAt' }
]

export const discussionsyncDiscussionsConfig = {
  name: 'discussionsyncDiscussions',
  layer: 'discussion-sync',
  apiPath: 'discussion-sync-discussions',
  componentName: 'DiscussionSyncDiscussionsForm',
  schema: discussionsyncDiscussionSchema,
  defaultValues: {
    sourceType: '',
    sourceThreadId: '',
    sourceUrl: '',
    sourceConfigId: '',
    title: '',
    content: '',
    authorHandle: '',
    participants: [],
    status: '',
    threadId: '',
    syncJobId: '',
    rawPayload: {},
    metadata: {},
    processedAt: null
  },
  columns: discussionsyncDiscussionsColumns,
}

export const useDiscussionSyncDiscussions = () => discussionsyncDiscussionsConfig

// Default export for auto-import compatibility
export default function () {
  return {
    defaultValue: discussionsyncDiscussionsConfig.defaultValues,
    schema: discussionsyncDiscussionsConfig.schema,
    columns: discussionsyncDiscussionsConfig.columns,
    collection: discussionsyncDiscussionsConfig.name
  }
}