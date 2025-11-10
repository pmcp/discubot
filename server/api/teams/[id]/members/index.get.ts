import { validateTeamOwnership } from '@@/server/utils/teamValidation.ts'
import { getActiveTeamMembers } from '@@/server/database/queries/teams'

export default defineEventHandler(async (event) => {
  const teamId = getRouterParam(event, 'id')
  if (!teamId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Team ID is required',
    })
  }

  await validateTeamOwnership(event, teamId)
  const teamMembers = await getActiveTeamMembers(teamId)
  return teamMembers
})
