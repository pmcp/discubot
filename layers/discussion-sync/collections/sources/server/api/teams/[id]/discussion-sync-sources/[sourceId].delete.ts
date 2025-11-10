import { deleteDiscussionSyncSource } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'

export default defineEventHandler(async (event) => {
  const { sourceId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  return await deleteDiscussionSyncSource(sourceId, team.id, user.id)
})