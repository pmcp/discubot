import Stripe from 'stripe'
import { env } from '@@/env'
import {
  createOrUpdateStripeProduct,
  createOrUpdateStripePrice,
} from '@@/server/database/queries/stripe'
import { consola } from 'consola'

export default defineTask({
  meta: {
    name: 'sync-stripe-data',
    description: 'Sync Stripe products and prices with local database',
  },
  async run() {
    const stripe = new Stripe(env.NUXT_STRIPE_SECRET_KEY)
    consola.start('Syncing Stripe products and prices...')
    try {
      // Sync Products
      const products = await stripe.products.list({ active: true })
      consola.info(`Found ${products.data.length} active products`)
      for (const product of products.data) {
        await createOrUpdateStripeProduct({
          id: product.id,
          name: product.name,
          description: product.description,
          active: product.active,
          metadata: product.metadata,
          features: product.marketing_features,
        })
      }

      // Sync Prices
      consola.info('💰 Fetching prices...')
      const prices = await stripe.prices.list({ active: true })
      consola.info(`Found ${prices.data.length} active prices`)
      for (const price of prices.data) {
        await createOrUpdateStripePrice({
          id: price.id,
          type: price.type,
          currency: price.currency,
          unitAmount: price.unit_amount ?? 0,
          interval: price.recurring?.interval ?? 'month',
          intervalCount: price.recurring?.interval_count ?? 1,
          productId:
            typeof price.product === 'string'
              ? price.product
              : price.product.id,
          description: price.nickname,
          active: price.active,
          metadata: price.metadata,
          trialPeriodDays: price.recurring?.trial_period_days,
        })
      }

      return {
        result: { success: true, message: 'Stripe data synced successfully' },
      }
    } catch (error) {
      consola.error('Error syncing products:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Error syncing products',
      })
    }
  },
})
