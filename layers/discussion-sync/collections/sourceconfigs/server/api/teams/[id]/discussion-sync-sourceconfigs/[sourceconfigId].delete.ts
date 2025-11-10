import { deleteDiscussionSyncSourceConfig } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'

export default defineEventHandler(async (event) => {
  const { sourceconfigId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  return await deleteDiscussionSyncSourceConfig(sourceconfigId, team.id, user.id)
})