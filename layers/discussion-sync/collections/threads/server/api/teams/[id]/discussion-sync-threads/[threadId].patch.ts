import { updateDiscussionSyncThread } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'
import type { DiscussionSyncThread } from '../../../../../types'

export default defineEventHandler(async (event) => {
  const { threadId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  const body = await readBody<Partial<DiscussionSyncThread>>(event)

  return await updateDiscussionSyncThread(threadId, team.id, user.id, {
    id: body.id,
    discussionId: body.discussionId,
    sourceType: body.sourceType,
    rootMessage: body.rootMessage,
    replies: body.replies,
    totalMessages: body.totalMessages,
    participants: body.participants,
    aiSummary: body.aiSummary,
    aiKeyPoints: body.aiKeyPoints,
    aiContext: body.aiContext,
    isMultiTask: body.isMultiTask,
    detectedTasks: body.detectedTasks,
    status: body.status,
    metadata: body.metadata
  })
})