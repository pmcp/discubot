export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!user.superAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You are not authorized to access this resource',
    })
  }
  const teams = await useDB().query.teams.findMany({
    with: {
      owner: true,
      subscription: {
        columns: {
          id: true,
          status: true,
        },
        with: {
          price: true,
        },
      },
      members: {
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
    orderBy: (teams, { desc }) => [desc(teams.createdAt)],
    limit: 20,
    offset: 0,
  })
  return teams
})
