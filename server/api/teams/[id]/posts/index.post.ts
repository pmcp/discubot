import { createPost } from '@@/server/database/queries/posts'
import type { InsertPost } from '@@/types/database'
import { isTeamMember } from '@@/server/database/queries/teams'

export default defineEventHandler(async (event) => {
  const { id: teamId } = getRouterParams(event)
  const { user } = await requireUserSession(event)
  const hasAccess = await isTeamMember(teamId, user.id)
  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Unauthorized Access',
    })
  }
  const { title, content, image } = await readBody<InsertPost>(event)
  const payload = {
    title,
    content,
    image,
    teamId,
    userId: user.id,
  }
  const post = await createPost(payload)
  return post
})
