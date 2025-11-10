import { deleteDiscussionSyncThread } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'

export default defineEventHandler(async (event) => {
  const { threadId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  return await deleteDiscussionSyncThread(threadId, team.id, user.id)
})