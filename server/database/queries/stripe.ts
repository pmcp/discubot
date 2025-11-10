import type { InsertProduct, InsertPrice } from '@@/types/database'

export const clearStripeData = async () => {
  await useDB().delete(tables.prices)
  await useDB().delete(tables.products)
}

export const createStripeProduct = async (payload: InsertProduct) => {
  const product = await useDB()
    .insert(tables.products)
    .values(payload)
    .returning()
    .get()
  return product
}

export const createStripePrice = async (payload: InsertPrice) => {
  const price = await useDB()
    .insert(tables.prices)
    .values(payload)
    .returning()
    .get()
  return price
}

// These functions are used by the webhook handler
export const createOrUpdateStripeProduct = async (payload: InsertProduct) => {
  if (!payload.id) {
    throw new Error('Product ID is required')
  }

  // First delete the existing product and its prices
  await useDB()
    .delete(tables.prices)
    .where(eq(tables.prices.productId, payload.id))
    .run()
  await useDB()
    .delete(tables.products)
    .where(eq(tables.products.id, payload.id))
    .run()

  // Then create fresh
  return createStripeProduct(payload)
}

export const createOrUpdateStripePrice = async (payload: InsertPrice) => {
  if (!payload.id) {
    throw new Error('Price ID is required')
  }

  // First delete the existing price
  await useDB()
    .delete(tables.prices)
    .where(eq(tables.prices.id, payload.id))
    .run()

  // Then create fresh
  return createStripePrice(payload)
}

export const getAllPlans = async () => {
  const plans = await useDB().query.prices.findMany({
    with: {
      product: true,
    },
    orderBy: (prices, { asc }) => [asc(prices.unitAmount)],
  })
  return plans
}

export const deleteStripeProduct = async (id: string) => {
  await useDB().delete(tables.products).where(eq(tables.products.id, id)).run()
}

export const deleteStripePrice = async (id: string) => {
  await useDB().delete(tables.prices).where(eq(tables.prices.id, id)).run()
}
