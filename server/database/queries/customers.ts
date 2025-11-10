import type { InsertCustomer, Customer } from '@@/types/database'
import { createError } from 'h3'

export const getCustomerByTeamId = async (teamId: string) => {
  try {
    const customer = await useDB().query.customers.findFirst({
      where: eq(tables.customers.teamId, teamId),
    })
    return customer
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to find customer by team ID',
    })
  }
}

export const createCustomer = async (
  payload: InsertCustomer,
): Promise<Customer> => {
  try {
    const customer = await useDB()
      .insert(tables.customers)
      .values(payload)
      .returning()
      .get()
    return customer
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create customer',
    })
  }
}

export const getCustomerById = async (id: string) => {
  try {
    const customer = await useDB().query.customers.findFirst({
      where: eq(tables.customers.id, id),
    })
    return customer
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to find customer by ID',
    })
  }
}
