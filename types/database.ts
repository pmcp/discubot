import { tables } from '@@/server/utils/database'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

export type User = typeof tables.users.$inferSelect
export type InsertUser = typeof tables.users.$inferInsert

export type Subscriber = typeof tables.subscribers.$inferSelect
export type InsertSubscriber = typeof tables.subscribers.$inferInsert
export type OAuthAccounts = typeof tables.oauthAccounts.$inferSelect
export type InsertOAuthAccounts = typeof tables.oauthAccounts.$inferInsert
export type Post = typeof tables.posts.$inferSelect
export type InsertPost = typeof tables.posts.$inferInsert
export type Feedback = typeof tables.feedback.$inferSelect
export type InsertFeedback = typeof tables.feedback.$inferInsert
export type EmailVerificationCodes =
  typeof tables.emailVerificationCodes.$inferSelect
export type InsertEmailVerificationCodes =
  typeof tables.emailVerificationCodes.$inferInsert
export type PasswordResetTokens = typeof tables.passwordResetTokens.$inferSelect
export type InsertPasswordResetTokens =
  typeof tables.passwordResetTokens.$inferInsert
export type OneTimePasswords = typeof tables.oneTimePasswords.$inferSelect
export type InsertOneTimePasswords = typeof tables.oneTimePasswords.$inferInsert
export type Image = typeof tables.images.$inferSelect
export type InsertImage = typeof tables.images.$inferInsert
export type Team = typeof tables.teams.$inferSelect
export type InsertTeam = typeof tables.teams.$inferInsert
export type TeamMember = typeof tables.teamMembers.$inferSelect
export type InsertTeamMember = typeof tables.teamMembers.$inferInsert
export type Passkey = typeof tables.webAuthnCredentials.$inferSelect
export type InsertPasskey = typeof tables.webAuthnCredentials.$inferInsert
export type WebAuthnChallenge = typeof tables.webAuthnChallenges.$inferSelect
export type InsertWebAuthnChallenge =
  typeof tables.webAuthnChallenges.$inferInsert
export type TeamInvite = typeof tables.teamInvites.$inferSelect
export type InsertTeamInvite = typeof tables.teamInvites.$inferInsert
export type Product = typeof tables.products.$inferSelect
export type InsertProduct = typeof tables.products.$inferInsert
export type Price = typeof tables.prices.$inferSelect
export type InsertPrice = typeof tables.prices.$inferInsert
export type Customer = typeof tables.customers.$inferSelect
export type InsertCustomer = typeof tables.customers.$inferInsert
export type Subscription = typeof tables.subscriptions.$inferSelect
export type InsertSubscription = typeof tables.subscriptions.$inferInsert

// Zod schemas
export const insertUserSchema = createInsertSchema(tables.users)
export const selectUserSchema = createSelectSchema(tables.users)

export const insertSubscriberSchema = createInsertSchema(tables.subscribers)
export const selectSubscriberSchema = createSelectSchema(tables.subscribers)

export const insertOAuthAccountsSchema = createInsertSchema(
  tables.oauthAccounts,
)
export const selectOAuthAccountsSchema = createSelectSchema(
  tables.oauthAccounts,
)

export const insertPostSchema = createInsertSchema(tables.posts)
export const selectPostSchema = createSelectSchema(tables.posts)

export const insertFeedbackSchema = createInsertSchema(tables.feedback)
export const selectFeedbackSchema = createSelectSchema(tables.feedback)

export const insertEmailVerificationCodesSchema = createInsertSchema(
  tables.emailVerificationCodes,
)
export const selectEmailVerificationCodesSchema = createSelectSchema(
  tables.emailVerificationCodes,
)

export const insertPasswordResetTokensSchema = createInsertSchema(
  tables.passwordResetTokens,
)
export const selectPasswordResetTokensSchema = createSelectSchema(
  tables.passwordResetTokens,
)

export const insertOneTimePasswordsSchema = createInsertSchema(
  tables.oneTimePasswords,
)
export const selectOneTimePasswordsSchema = createSelectSchema(
  tables.oneTimePasswords,
)

export const insertImageSchema = createInsertSchema(tables.images)
export const selectImageSchema = createSelectSchema(tables.images)

export const insertTeamSchema = createInsertSchema(tables.teams)
export const selectTeamSchema = createSelectSchema(tables.teams)

export const insertTeamInviteSchema = createInsertSchema(tables.teamInvites)
export const selectTeamInviteSchema = createSelectSchema(tables.teamInvites)

export const insertPasskeySchema = createInsertSchema(
  tables.webAuthnCredentials,
)
export const selectPasskeySchema = createSelectSchema(
  tables.webAuthnCredentials,
)

export const insertWebAuthnChallengeSchema = createInsertSchema(
  tables.webAuthnChallenges,
)
export const selectWebAuthnChallengeSchema = createSelectSchema(
  tables.webAuthnChallenges,
)

export const insertProductSchema = createInsertSchema(tables.products)
export const selectProductSchema = createSelectSchema(tables.products)

export const insertPriceSchema = createInsertSchema(tables.prices)
export const selectPriceSchema = createSelectSchema(tables.prices)

export const insertCustomerSchema = createInsertSchema(tables.customers)
export const selectCustomerSchema = createSelectSchema(tables.customers)

export const insertSubscriptionSchema = createInsertSchema(tables.subscriptions)
export const selectSubscriptionSchema = createSelectSchema(tables.subscriptions)

export const insertTeamMemberSchema = createInsertSchema(tables.teamMembers)
export const selectTeamMemberSchema = createSelectSchema(tables.teamMembers)
