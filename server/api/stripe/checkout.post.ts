import { stripeService } from '@@/server/services/stripe'
import { validateTeamOwnership } from '@@/server/utils/teamValidation.ts'
import {
  getCustomerByTeamId,
  createCustomer,
} from '@@/server/database/queries/customers'

interface CheckoutBody {
  priceId: string
  teamId: string
  teamSlug: string
}

async function getOrCreateCustomer(
  teamId: string,
  user: { id: string, email: string },
) {
  try {
    const customerRecord = await getCustomerByTeamId(teamId)
    if (customerRecord) {
      return customerRecord.id
    }

    const newCustomerId = await stripeService.createCustomer(teamId, user.email)
    await createCustomer({
      id: newCustomerId,
      teamId,
      userId: user.id,
    })
    return newCustomerId
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get or create customer',
    })
  }
}

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireUserSession(event)
    const body = await readBody<CheckoutBody>(event)

    if (!body.priceId || !body.teamId || !body.teamSlug) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Price ID, team ID and team slug are required',
      })
    }

    await validateTeamOwnership(event, body.teamId)

    const customerId = await getOrCreateCustomer(body.teamId, user)

    const session = await stripeService.createCheckoutSession({
      customerId,
      priceId: body.priceId,
      teamSlug: body.teamSlug,
    })

    return session.url
  } catch (error) {
    // If it's already a handled error, rethrow it
    if (error instanceof Error) throw error

    // Otherwise, create a generic error
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create checkout session',
    })
  }
})
