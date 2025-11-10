import { getAllPlans } from '@@/server/database/queries/stripe'

export default defineEventHandler(async (_event) => {
  const plans = await getAllPlans()
  return plans
})
