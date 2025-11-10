import { z } from 'zod'

export const discussionsyncTaskSchema = z.object({
  discussionId: z.string().min(1, 'discussionId is required'),
  threadId: z.string().optional(),
  syncJobId: z.string().min(1, 'syncJobId is required'),
  notionPageId: z.string().min(1, 'notionPageId is required'),
  notionPageUrl: z.string().min(1, 'notionPageUrl is required'),
  title: z.string().min(1, 'title is required'),
  description: z.string().optional(),
  status: z.string().min(1, 'status is required'),
  priority: z.string().optional(),
  assignee: z.string().optional(),
  summary: z.string().optional(),
  sourceUrl: z.string().optional(),
  isMultiTaskChild: z.boolean(),
  taskIndex: z.number().optional(),
  metadata: z.object({}).optional()
})

export const discussionsyncTasksColumns = [
  { accessorKey: 'id', header: 'Id' },
  { accessorKey: 'discussionId', header: 'DiscussionId' },
  { accessorKey: 'threadId', header: 'ThreadId' },
  { accessorKey: 'syncJobId', header: 'SyncJobId' },
  { accessorKey: 'notionPageId', header: 'NotionPageId' },
  { accessorKey: 'notionPageUrl', header: 'NotionPageUrl' },
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'description', header: 'Description' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'priority', header: 'Priority' },
  { accessorKey: 'assignee', header: 'Assignee' },
  { accessorKey: 'summary', header: 'Summary' },
  { accessorKey: 'sourceUrl', header: 'SourceUrl' },
  { accessorKey: 'isMultiTaskChild', header: 'IsMultiTaskChild' },
  { accessorKey: 'taskIndex', header: 'TaskIndex' },
  { accessorKey: 'metadata', header: 'Metadata' }
]

export const discussionsyncTasksConfig = {
  name: 'discussionsyncTasks',
  layer: 'discussion-sync',
  apiPath: 'discussion-sync-tasks',
  componentName: 'DiscussionSyncTasksForm',
  schema: discussionsyncTaskSchema,
  defaultValues: {
    discussionId: '',
    threadId: '',
    syncJobId: '',
    notionPageId: '',
    notionPageUrl: '',
    title: '',
    description: '',
    status: '',
    priority: '',
    assignee: '',
    summary: '',
    sourceUrl: '',
    isMultiTaskChild: false,
    taskIndex: 0,
    metadata: {}
  },
  columns: discussionsyncTasksColumns,
}

export const useDiscussionSyncTasks = () => discussionsyncTasksConfig

// Default export for auto-import compatibility
export default function () {
  return {
    defaultValue: discussionsyncTasksConfig.defaultValues,
    schema: discussionsyncTasksConfig.schema,
    columns: discussionsyncTasksConfig.columns,
    collection: discussionsyncTasksConfig.name
  }
}