import { updateUserPassword } from '@@/server/database/queries/users'
import { updateUserPasswordSchema } from '@@/shared/validations/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { password } = await readValidatedBody(event, (body) =>
    updateUserPasswordSchema.parse(body),
  )
  const hashedPassword = await hashPassword(password)
  await updateUserPassword(user.id, hashedPassword)
  return { message: 'Password updated successfully' }
})
