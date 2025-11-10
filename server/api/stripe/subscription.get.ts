import { getSubscriptionByTeamId } from '@@/server/database/queries/subscriptions'

export default defineEventHandler(async (event) => {
  const { teamId } = getQuery(event)
  const subscription = await getSubscriptionByTeamId(teamId as string)
  return subscription
})
