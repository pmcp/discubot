import { validateTeamOwnership } from '@@/server/utils/teamValidation.ts'
import { cancelInvite } from '@@/server/database/queries/teams'

export default defineEventHandler(async (event) => {
  const teamId = getRouterParam(event, 'id')
  const inviteId = getRouterParam(event, 'inviteId')
  if (!teamId || !inviteId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Team ID and invite ID are required',
    })
  }

  await validateTeamOwnership(event, teamId)
  await cancelInvite(inviteId)
  return 'Invite cancelled successfully'
})
