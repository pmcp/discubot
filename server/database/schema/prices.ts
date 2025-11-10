import { nanoid } from 'nanoid'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { products } from './products'
import { relations } from 'drizzle-orm'

export const prices = sqliteTable('prices', {
  id: text('id')
    .primaryKey()
    .$default(() => nanoid()),
  description: text('description'),
  currency: text('currency').notNull(),
  unitAmount: integer('unit_amount').notNull(),
  type: text('type').notNull(),
  interval: text('interval').notNull(),
  intervalCount: integer('interval_count').notNull(),
  trialPeriodDays: integer('trial_period_days'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  metadata: text('metadata', { mode: 'json' }),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(
    () => new Date(),
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdate(
    () => new Date(),
  ),
})

export const pricesRelations = relations(prices, ({ one }) => ({
  product: one(products, {
    fields: [prices.productId],
    references: [products.id],
  }),
}))
