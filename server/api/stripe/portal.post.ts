import { stripeService } from '@@/server/services/stripe'
import { validateTeamOwnership } from '@@/server/utils/teamValidation.ts'
import { getCustomerByTeamId } from '@@/server/database/queries/customers'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ teamId: string }>(event)

    if (!body.teamId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Team ID is required',
      })
    }

    await validateTeamOwnership(event, body.teamId)

    const customer = await getCustomerByTeamId(body.teamId)
    if (!customer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Customer not found',
      })
    }

    const session = await stripeService.createBillingPortalSession(customer.id)
    return session.url
  } catch (error) {
    if (error instanceof Error) throw error
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create billing portal session',
    })
  }
})
