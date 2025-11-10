import { nanoid } from 'nanoid'
import { sqliteTable, text, integer, real, customType, index } from 'drizzle-orm/sqlite-core'

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

export const discussionSyncDiscussions = sqliteTable('discussion_sync_discussions', {
  id: text('id').primaryKey().$default(() => nanoid()),

  teamId: text('teamId').notNull(),
  owner: text('owner').notNull(),
  sourceType: text('sourceType').notNull(),
  sourceThreadId: text('sourceThreadId').notNull(),
  sourceUrl: text('sourceUrl').notNull(),
  sourceConfigId: text('sourceConfigId').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorHandle: text('authorHandle').notNull(),
  participants: jsonColumn('participants').$default(() => (null)),
  status: text('status').notNull(),
  threadId: text('threadId'),
  syncJobId: text('syncJobId'),
  rawPayload: jsonColumn('rawPayload').$default(() => ({})),
  metadata: jsonColumn('metadata').$default(() => ({})),
  processedAt: integer('processedAt', { mode: 'timestamp' }).$default(() => new Date()),

  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$default(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$onUpdate(() => new Date()),
  createdBy: text('createdBy').notNull(),
  updatedBy: text('updatedBy').notNull()
}, (table) => ({
  // Composite index for filtering discussions by team and status
  teamStatusIdx: index('idx_discussions_team_status').on(table.teamId, table.status),
  // Composite index for looking up discussions by source type and thread ID
  sourceThreadIdx: index('idx_discussions_source_thread').on(table.sourceType, table.sourceThreadId),
  // Index for filtering by source config
  sourceConfigIdx: index('idx_discussions_source_config').on(table.sourceConfigId),
  // Index for timestamp-based queries
  createdAtIdx: index('idx_discussions_created_at').on(table.createdAt),
}))