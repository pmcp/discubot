import { createTeam } from '@@/server/database/queries/teams'
import { createTeamSchema } from '@@/shared/validations/team'
import { validateBody } from '@@/server/utils/bodyValidation'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await validateBody(event, createTeamSchema)
  const team = await createTeam({
    name: body.name,
    ownerId: user.id,
    slug: body.slug,
    logo: body.logo,
  })
  return team
})
