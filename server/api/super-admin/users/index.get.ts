export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!user.superAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You are not authorized to access this resource',
    })
  }
  const users = await useDB().query.users.findMany({
    with: {
      oauthAccounts: true,
      teamMembers: {
        with: {
          team: true,
        },
      },
    },
    columns: {
      hashedPassword: false,
    },
    orderBy: (users, { desc }) => [desc(users.createdAt)],
    limit: 50,
    offset: 0,
  })
  return users
})
