import { nanoid } from 'nanoid'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { users } from './users'
import { relations } from 'drizzle-orm'

export const subscribers = sqliteTable('subscribers', {
  id: text('id')
    .primaryKey()
    .$default(() => nanoid()),
  email: text('email').notNull().unique(),
  referrer: text('referrer'),
  meta: text('meta', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(
    () => new Date(),
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdate(
    () => new Date(),
  ),
})

export const feedback = sqliteTable('feedback', {
  id: text('id')
    .primaryKey()
    .$default(() => nanoid()),
  user: text('user')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  status: text('status').notNull().default('pending'),
  reply: text('reply'),
  meta: text('meta', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(
    () => new Date(),
  ),
})

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, {
    fields: [feedback.user],
    references: [users.id],
  }),
}))
