import { getAllSubscribers } from '@@/server/database/queries/admin'

export default defineEventHandler(async (_event) => {
  const subscribers = await getAllSubscribers()
  return subscribers
})
