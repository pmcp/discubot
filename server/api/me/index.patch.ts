import { updateUser } from '@@/server/database/queries/users'
import { validateBody } from '@@/server/utils/bodyValidation'
import { updateUserSchema } from '@@/shared/validations/user'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await validateBody(event, updateUserSchema)
  const updatedUser = await updateUser(user.id, {
    name: body.name,
    avatarUrl: body.avatarUrl,
  })
  const sanitizedUser = sanitizeUser(updatedUser)
  await setUserSession(event, { user: sanitizedUser })
  return sanitizedUser
})
