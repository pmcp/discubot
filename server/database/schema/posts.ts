import { nanoid } from 'nanoid'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { users } from './users'
import { teams } from './teams'
import { relations } from 'drizzle-orm'

export const posts = sqliteTable('posts', {
  id: text('id')
    .primaryKey()
    .$default(() => nanoid()),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  image: text('image'),
  teamId: text('teamId')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(
    () => new Date(),
  ).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdate(
    () => new Date(),
  ).notNull(),
})

export const postsRelations = relations(posts, ({ one }) => ({
  userId: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  teamId: one(teams, {
    fields: [posts.teamId],
    references: [teams.id],
  }),
}))
