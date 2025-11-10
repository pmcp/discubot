import { z } from 'zod'
import { insertTeamSchema } from '@@/types/database'
import { UserRole } from '@@/constants'

export const createTeamSchema = insertTeamSchema.pick({
  name: true,
  logo: true,
  slug: true,
})

export const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z
    .enum([UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER])
    .default(UserRole.MEMBER),
})
