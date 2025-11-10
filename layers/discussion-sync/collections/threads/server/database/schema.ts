import { nanoid } from 'nanoid'
import { sqliteTable, text, integer, real, customType } from 'drizzle-orm/sqlite-core'

// Custom JSON column that handles NULL values gracefully during LEFT JOINs
const jsonColumn = customType<any>({
  dataType() {
    return 'text'
  },
  fromDriver(value: unknown): any {
    if (value === null || value === undefined || value === '') {
      return null
    }
    return JSON.parse(value as string)
  },
  toDriver(value: any): string {
    return JSON.stringify(value)
  },
})

export const discussionSyncThreads = sqliteTable('discussion_sync_threads', {
  id: text('id').primaryKey().$default(() => nanoid()),

  teamId: text('teamId').notNull(),
  owner: text('owner').notNull(),
  discussionId: text('discussionId').notNull(),
  sourceType: text('sourceType').notNull(),
  rootMessage: jsonColumn('rootMessage').notNull().$default(() => ({})),
  replies: jsonColumn('replies').$default(() => ({})),
  totalMessages: integer('totalMessages'),
  participants: jsonColumn('participants').$default(() => (null)),
  aiSummary: text('aiSummary'),
  aiKeyPoints: jsonColumn('aiKeyPoints').$default(() => (null)),
  aiContext: text('aiContext'),
  isMultiTask: integer('isMultiTask', { mode: 'boolean' }).$default(() => false),
  detectedTasks: jsonColumn('detectedTasks').$default(() => ({})),
  status: text('status').notNull(),
  metadata: jsonColumn('metadata').$default(() => ({})),

  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$default(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$onUpdate(() => new Date()),
  createdBy: text('createdBy').notNull(),
  updatedBy: text('updatedBy').notNull()
})