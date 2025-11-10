import type { InsertSubscription, Subscription } from '@@/types/database'
import { createError } from 'h3'

export const upsertSubscription = async (
  subscription: InsertSubscription,
): Promise<Subscription> => {
  try {
    const upsertedSubscription = await useDB()
      .insert(tables.subscriptions)
      .values(subscription)
      .onConflictDoUpdate({
        target: [tables.subscriptions.id],
        set: subscription,
      })
      .returning()
      .get()

    return upsertedSubscription
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to upsert subscription',
    })
  }
}

export const getSubscriptionByTeamId = async (
  teamId: string,
): Promise<Subscription | null> => {
  try {
    const subscription = await useDB().query.subscriptions.findFirst({
      where: and(eq(tables.subscriptions.teamId, teamId)),
      with: {
        price: true,
      },
    })
    return subscription ?? null
  } catch (error) {
    console.log('getSubscriptionByTeamId', teamId)
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get subscription by team ID',
    })
  }
}
