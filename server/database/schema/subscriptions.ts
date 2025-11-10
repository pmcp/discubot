import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { customers } from './customers'
import { prices } from './prices'
import { teams } from './teams'
import { users } from './users'
import { relations } from 'drizzle-orm'

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').references(() => customers.id),
  priceId: text('price_id').references(() => prices.id),
  teamId: text('team_id').references(() => teams.id),
  userId: text('user_id').references(() => users.id),
  status: text('status').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  quantity: integer('quantity').notNull(),
  cancelAtPeriodEnd: integer('cancel_at_period_end', {
    mode: 'boolean',
  }).notNull(),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),
  currentPeriodStart: integer('current_period_start', { mode: 'timestamp' }),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  cancelAt: integer('cancel_at', { mode: 'timestamp' }),
  trialStart: integer('trial_start', { mode: 'timestamp' }),
  trialEnd: integer('trial_end', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(
    () => new Date(),
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdate(
    () => new Date(),
  ),
})

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  customer: one(customers, {
    fields: [subscriptions.customerId],
    references: [customers.id],
  }),
  price: one(prices, {
    fields: [subscriptions.priceId],
    references: [prices.id],
  }),
  team: one(teams, {
    fields: [subscriptions.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}))
