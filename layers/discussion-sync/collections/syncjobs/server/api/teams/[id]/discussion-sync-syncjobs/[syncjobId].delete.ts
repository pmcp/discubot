import { deleteDiscussionSyncSyncJob } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'

export default defineEventHandler(async (event) => {
  const { syncjobId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  return await deleteDiscussionSyncSyncJob(syncjobId, team.id, user.id)
})