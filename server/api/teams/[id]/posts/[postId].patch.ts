import { updatePost } from '@@/server/database/queries/posts'
import type { Post } from '@@/types/database'

export default defineEventHandler(async (event) => {
  const params = getRouterParams(event)
  const teamId = params.id
  const postId = params.postId
  const { user } = await requireUserSession(event)
  const body = await readBody<Partial<Post>>(event)
  const post = await updatePost(postId, teamId, user.id, {
    title: body.title,
    content: body.content,
    image: body.image,
  })
  return post
})
