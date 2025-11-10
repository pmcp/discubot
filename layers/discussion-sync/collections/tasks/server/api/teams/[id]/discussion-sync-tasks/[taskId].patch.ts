import { updateDiscussionSyncTask } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'
import type { DiscussionSyncTask } from '../../../../../types'

export default defineEventHandler(async (event) => {
  const { taskId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  const body = await readBody<Partial<DiscussionSyncTask>>(event)

  return await updateDiscussionSyncTask(taskId, team.id, user.id, {
    id: body.id,
    discussionId: body.discussionId,
    threadId: body.threadId,
    syncJobId: body.syncJobId,
    notionPageId: body.notionPageId,
    notionPageUrl: body.notionPageUrl,
    title: body.title,
    description: body.description,
    status: body.status,
    priority: body.priority,
    assignee: body.assignee,
    summary: body.summary,
    sourceUrl: body.sourceUrl,
    isMultiTaskChild: body.isMultiTaskChild,
    taskIndex: body.taskIndex,
    metadata: body.metadata
  })
})