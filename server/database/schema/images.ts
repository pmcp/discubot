import { nanoid } from 'nanoid'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { users } from './users'

export const images = sqliteTable('images', {
  id: text('id')
    .primaryKey()
    .$default(() => nanoid()),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  contentType: text('contentType'),
  pathname: text('pathname').notNull(),
  size: integer('size'),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(
    () => new Date(),
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdate(
    () => new Date(),
  ),
})
