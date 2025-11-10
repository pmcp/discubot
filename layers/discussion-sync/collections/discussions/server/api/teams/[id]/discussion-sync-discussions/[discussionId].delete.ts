import { deleteDiscussionSyncDiscussion } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'

export default defineEventHandler(async (event) => {
  const { discussionId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  return await deleteDiscussionSyncDiscussion(discussionId, team.id, user.id)
})