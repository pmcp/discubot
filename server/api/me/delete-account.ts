import { deleteUser } from '@@/server/database/queries/users'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  await deleteUser(user.id)
  sendNoContent(event)
})
