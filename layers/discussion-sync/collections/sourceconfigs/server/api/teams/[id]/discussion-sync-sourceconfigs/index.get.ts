import { getAllDiscussionSyncSourceConfigs, getDiscussionSyncSourceConfigsByIds } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'

export default defineEventHandler(async (event) => {
  const { team } = await resolveTeamAndCheckMembership(event)

  const query = getQuery(event)
  if (query.ids) {
    const ids = String(query.ids).split(',')
    return await getDiscussionSyncSourceConfigsByIds(team.id, ids)
  }

  return await getAllDiscussionSyncSourceConfigs(team.id)
})