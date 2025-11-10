import { updateDiscussionSyncDiscussion } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'
import type { DiscussionSyncDiscussion } from '../../../../../types'

export default defineEventHandler(async (event) => {
  const { discussionId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  const body = await readBody<Partial<DiscussionSyncDiscussion>>(event)

  return await updateDiscussionSyncDiscussion(discussionId, team.id, user.id, {
    id: body.id,
    sourceType: body.sourceType,
    sourceThreadId: body.sourceThreadId,
    sourceUrl: body.sourceUrl,
    sourceConfigId: body.sourceConfigId,
    title: body.title,
    content: body.content,
    authorHandle: body.authorHandle,
    participants: body.participants,
    status: body.status,
    threadId: body.threadId,
    syncJobId: body.syncJobId,
    rawPayload: body.rawPayload,
    metadata: body.metadata,
    processedAt: body.processedAt ? new Date(body.processedAt) : body.processedAt
  })
})