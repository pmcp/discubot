import { updateDiscussionSyncSyncJob } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'
import type { DiscussionSyncSyncJob } from '../../../../../types'

export default defineEventHandler(async (event) => {
  const { syncjobId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  const body = await readBody<Partial<DiscussionSyncSyncJob>>(event)

  return await updateDiscussionSyncSyncJob(syncjobId, team.id, user.id, {
    id: body.id,
    discussionId: body.discussionId,
    sourceConfigId: body.sourceConfigId,
    status: body.status,
    stage: body.stage,
    attempts: body.attempts,
    maxAttempts: body.maxAttempts,
    error: body.error,
    errorStack: body.errorStack,
    startedAt: body.startedAt ? new Date(body.startedAt) : body.startedAt,
    completedAt: body.completedAt ? new Date(body.completedAt) : body.completedAt,
    processingTime: body.processingTime,
    taskIds: body.taskIds,
    metadata: body.metadata
  })
})