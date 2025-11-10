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

export const discussionSyncSourceconfigs = sqliteTable('discussion_sync_sourceconfigs', {
  id: text('id').primaryKey().$default(() => nanoid()),

  teamId: text('teamId').notNull(),
  owner: text('owner').notNull(),
  sourceId: text('sourceId').notNull(),
  name: text('name').notNull(),
  emailAddress: text('emailAddress'),
  emailSlug: text('emailSlug'),
  webhookUrl: text('webhookUrl'),
  webhookSecret: text('webhookSecret'),
  apiToken: text('apiToken'),
  notionToken: text('notionToken'),
  notionDatabaseId: text('notionDatabaseId').notNull(),
  notionFieldMapping: jsonColumn('notionFieldMapping').$default(() => ({})),
  anthropicApiKey: text('anthropicApiKey'),
  aiEnabled: integer('aiEnabled', { mode: 'boolean' }).notNull().$default(() => false),
  aiSummaryPrompt: text('aiSummaryPrompt'),
  aiTaskPrompt: text('aiTaskPrompt'),
  autoSync: integer('autoSync', { mode: 'boolean' }).notNull().$default(() => false),
  postConfirmation: integer('postConfirmation', { mode: 'boolean' }).notNull().$default(() => false),
  active: integer('active', { mode: 'boolean' }).notNull().$default(() => false),
  onboardingComplete: integer('onboardingComplete', { mode: 'boolean' }).notNull().$default(() => false),
  sourceMetadata: jsonColumn('sourceMetadata').$default(() => ({})),

  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$default(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$onUpdate(() => new Date()),
  createdBy: text('createdBy').notNull(),
  updatedBy: text('updatedBy').notNull()
})