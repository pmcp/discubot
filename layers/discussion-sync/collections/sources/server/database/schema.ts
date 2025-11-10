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

export const discussionSyncSources = sqliteTable('discussion_sync_sources', {
  id: text('id').primaryKey().$default(() => nanoid()),

  teamId: text('teamId').notNull(),
  owner: text('owner').notNull(),
  sourceType: text('sourceType').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  adapterClass: text('adapterClass').notNull(),
  icon: text('icon'),
  configSchema: jsonColumn('configSchema').$default(() => ({})),
  webhookPath: text('webhookPath'),
  requiresEmail: integer('requiresEmail', { mode: 'boolean' }).$default(() => false),
  requiresWebhook: integer('requiresWebhook', { mode: 'boolean' }).$default(() => false),
  requiresApiToken: integer('requiresApiToken', { mode: 'boolean' }).$default(() => false),
  active: integer('active', { mode: 'boolean' }).notNull().$default(() => false),
  metadata: jsonColumn('metadata').$default(() => ({})),

  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$default(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$onUpdate(() => new Date()),
  createdBy: text('createdBy').notNull(),
  updatedBy: text('updatedBy').notNull()
})