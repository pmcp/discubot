import type {
  Team,
  InsertTeam,
  InsertTeamInvite,
  TeamInvite,
} from '@@/types/database'

// Define invite status types for better type safety
type InviteStatus = (typeof INVALID_STATUSES)[number]
const INVALID_STATUSES = ['accepted', 'rejected', 'cancelled'] as const

export const findUserTeams = async (userId: string) => {
  try {
    const teams = await useDB()
      .select({
        id: tables.teams.id,
        name: tables.teams.name,
        ownerId: tables.teams.ownerId,
        logo: tables.teams.logo,
        createdAt: tables.teams.createdAt,
        updatedAt: tables.teams.updatedAt,
        role: tables.teamMembers.role,
        slug: tables.teams.slug,
      })
      .from(tables.teams)
      .leftJoin(
        tables.teamMembers,
        and(
          eq(tables.teams.id, tables.teamMembers.teamId),
          eq(tables.teamMembers.userId, userId),
        ),
      )
      .where(
        or(
          eq(tables.teams.ownerId, userId),
          eq(tables.teamMembers.userId, userId),
        ),
      )
      .groupBy(tables.teams.id)
    return teams
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to find user teams',
    })
  }
}

export const getTeam = async (teamId: string) => {
  const team = await useDB()
    .select()
    .from(tables.teams)
    .where(eq(tables.teams.id, teamId))
    .get()
  return team
}

export const createTeam = async (payload: InsertTeam) => {
  try {
    const team = await useDB()
      .insert(tables.teams)
      .values(payload)
      .returning()
      .get()

    await useDB().insert(tables.teamMembers).values({
      teamId: team.id,
      userId: payload.ownerId,
      role: 'owner',
    })

    return team
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message)
    }
    throw new Error('Failed to create team')
  }
}

export const updateTeam = async (teamId: string, payload: Partial<Team>) => {
  try {
    const record = await useDB()
      .update(tables.teams)
      .set(payload)
      .where(eq(tables.teams.id, teamId))
      .returning()
      .get()
    return record
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update team',
    })
  }
}

export const deleteTeam = async (teamId: string) => {
  try {
    await useDB().delete(tables.teams).where(eq(tables.teams.id, teamId))
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete team',
    })
  }
}

export const inviteTeamMember = async (payload: InsertTeamInvite) => {
  try {
    const invite = await useDB()
      .insert(tables.teamInvites)
      .values(payload)
      .returning()
      .get()
    return invite
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to invite team member',
    })
  }
}

export const getActiveTeamMembers = async (teamId: string) => {
  const members = await useDB()
    .select({
      id: tables.teamMembers.id,
      teamId: tables.teamMembers.teamId,
      userId: tables.teamMembers.userId,
      role: tables.teamMembers.role,
      email: tables.users.email,
      name: tables.users.name,
      avatarUrl: tables.users.avatarUrl,
      lastLoginAt: tables.users.lastActive,
      createdAt: tables.teamMembers.createdAt,
    })
    .from(tables.teamMembers)
    .leftJoin(tables.users, eq(tables.teamMembers.userId, tables.users.id))
    .where(eq(tables.teamMembers.teamId, teamId))
  return members
}

export const getTeamInvites = async (teamId: string) => {
  const invites = await useDB()
    .select({
      id: tables.teamInvites.id,
      teamId: tables.teamInvites.teamId,
      email: tables.teamInvites.email,
      role: tables.teamInvites.role,
      status: tables.teamInvites.status,
      expiresAt: tables.teamInvites.expiresAt,
      acceptedAt: tables.teamInvites.acceptedAt,
      acceptedBy: tables.teamInvites.acceptedBy,
      createdAt: tables.teamInvites.createdAt,
      acceptedByEmail: tables.users.email,
    })
    .from(tables.teamInvites)
    .leftJoin(
      tables.users,
      eq(tables.teamInvites.acceptedBy, tables.users.id),
    )
    .where(eq(tables.teamInvites.teamId, teamId))
  return invites
}

export const cancelInvite = async (inviteId: string) => {
  await useDB()
    .delete(tables.teamInvites)
    .where(eq(tables.teamInvites.id, inviteId))
}

/**
 * @throws {H3Error}
 */
export const getInvite = async (token: string): Promise<TeamInvite> => {
  const invite = await useDB()
    .select()
    .from(tables.teamInvites)
    .where(eq(tables.teamInvites.token, token))
    .get()

  if (!invite) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invite not found or invalid',
    })
  }

  if (invite.expiresAt < new Date()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invite expired',
    })
  }

  if (INVALID_STATUSES.includes(invite.status as InviteStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invite already ${invite.status}`,
    })
  }
  return invite
}

export const updateInviteStatus = async (inviteId: string, status: string, userId?: string) => {
  const updateData: { status: string, acceptedAt?: Date, acceptedBy?: string } = { status }

  // If the status is 'accepted', set the acceptedAt timestamp and acceptedBy user ID
  if (status === 'accepted' && userId) {
    updateData.acceptedAt = new Date()
    updateData.acceptedBy = userId
  }

  await useDB()
    .update(tables.teamInvites)
    .set(updateData)
    .where(eq(tables.teamInvites.id, inviteId))
}

export const acceptTeamInvite = async (invite: TeamInvite, userId: string) => {
  try {
    await useDB()
      .insert(tables.teamMembers)
      .values({ teamId: invite.teamId, userId, role: invite.role })
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add user to team',
    })
  }
}

export const isTeamMember = async (teamId: string, userId: string) => {
  try {
    const member = await useDB()
      .select({ id: tables.teamMembers.id })
      .from(tables.teamMembers)
      .where(
        and(
          eq(tables.teamMembers.teamId, teamId),
          eq(tables.teamMembers.userId, userId),
        ),
      )
      .get()

    return !!member
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check if user is already in team',
    })
  }
}

export const findTeamInvite = async (inviteId: string) => {
  const invite = await useDB()
    .select()
    .from(tables.teamInvites)
    .where(eq(tables.teamInvites.id, inviteId))
    .get()
  return invite
}

export const updateTeamInvite = async (
  inviteId: string,
  payload: Partial<TeamInvite>,
) => {
  await useDB()
    .update(tables.teamInvites)
    .set(payload)
    .where(eq(tables.teamInvites.id, inviteId))
}

export const deleteTeamMember = async (teamId: string, memberId: string) => {
  try {
    await useDB()
      .delete(tables.teamMembers)
      .where(
        and(
          eq(tables.teamMembers.teamId, teamId),
          eq(tables.teamMembers.id, memberId),
        ),
      )
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete team member',
    })
  }
}

export const checkSlugConflict = async (userId: string, slug: string) => {
  try {
    const existingTeam = await useDB()
      .select({
        id: tables.teams.id,
        name: tables.teams.name,
        slug: tables.teams.slug,
      })
      .from(tables.teams)
      .leftJoin(
        tables.teamMembers,
        and(
          eq(tables.teams.id, tables.teamMembers.teamId),
          eq(tables.teamMembers.userId, userId),
        ),
      )
      .where(
        and(
          eq(tables.teams.slug, slug),
          or(
            eq(tables.teams.ownerId, userId),
            eq(tables.teamMembers.userId, userId),
          ),
        ),
      )
      .get()

    return existingTeam
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check slug conflict',
    })
  }
}
