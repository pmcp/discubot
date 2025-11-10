import { nanoid } from 'nanoid'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { OneTimePasswordTypes } from '../../../constants'
import { users } from './users'
import { relations } from 'drizzle-orm'

export const oauthAccounts = sqliteTable('oauth_accounts', {
  id: text('id')
    .primaryKey()
    .$default(() => nanoid()),
  provider: text('provider').notNull(),
  providerUserId: text('providerUserId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(
    () => new Date(),
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdate(
    () => new Date(),
  ),
})

export const emailVerificationCodes = sqliteTable('email_verification_codes', {
  id: integer('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  code: text('code', { length: 32 }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
})

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: integer('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  code: text('code', { length: 32 }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
})

export const oneTimePasswords = sqliteTable('one_time_passwords', {
  id: text('id')
    .primaryKey()
    .$default(() => nanoid()),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  identifier: text('identifier').notNull(),
  code: text('code', { length: 6 }).notNull(),
  type: text('type').notNull().default(OneTimePasswordTypes.signup),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
})

export const webAuthnCredentials = sqliteTable('webauthn_credentials', {
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  id: text('id').notNull().unique(),
  name: text('name').notNull(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull(),
  backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
  transports: text('transports', { mode: 'json' })
    .notNull()
    .$type<WebAuthnCredential['transports']>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(
    () => new Date(),
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdate(
    () => new Date(),
  ),
})

export const webAuthnChallenges = sqliteTable('webauthn_challenges', {
  id: text('id').primaryKey(),
  challenge: text('challenge').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
})

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}))
