export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!user.superAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You are not authorized to access this resource',
    })
  }
  const { userId } = await readBody(event)
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required',
    })
  }
  const userRecord = await useDB()
    .delete(tables.users)
    .where(eq(tables.users.id, userId))
    .returning()
    .get()
  return userRecord
})
