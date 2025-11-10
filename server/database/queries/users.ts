import type { User, InsertUser } from '@@/types/database'
import { H3Error } from 'h3'

export const findUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const [existingUser] = await useDB()
      .select()
      .from(tables.users)
      .where(eq(tables.users.email, email))
    return existingUser || null
  } catch (error) {
    console.error(error)
    return null
  }
}

export const createUserWithPassword = async (payload: InsertUser) => {
  try {
    const record = await useDB()
      .insert(tables.users)
      .values(payload)
      .onConflictDoUpdate({
        target: tables.users.email,
        set: {
          name: payload.name,
          hashedPassword: payload.hashedPassword,
        },
      })
      .returning()
      .get()
    return record
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to upsert user',
    })
  }
}

export const findLinkedAccountsByUserId = async (userId: string) => {
  try {
    const linkedAccounts = await useDB()
      .select()
      .from(tables.oauthAccounts)
      .where(eq(tables.oauthAccounts.userId, userId))
    return linkedAccounts
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to find linked accounts by user ID',
    })
  }
}

export const updateLastActiveTimestamp = async (
  userId: string,
): Promise<InsertUser> => {
  try {
    const record = await useDB()
      .update(tables.users)
      .set({ lastActive: new Date() })
      .where(eq(tables.users.id, userId))
      .returning()
      .get()
    return record
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update last active',
    })
  }
}

export const findUserById = async (id: string) => {
  try {
    const [user] = await useDB()
      .select()
      .from(tables.users)
      .where(eq(tables.users.id, id))
    return user || null
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to find user by ID',
    })
  }
}

export const verifyUser = async (userId: string) => {
  try {
    const record = await useDB()
      .update(tables.users)
      .set({ emailVerified: true })
      .where(eq(tables.users.id, userId))
      .returning()
      .get()
    return record
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to verify user',
    })
  }
}

export const createUserWithOAuth = async (payload: InsertUser) => {
  try {
    const record = await useDB()
      .insert(tables.users)
      .values(payload)
      .onConflictDoUpdate({
        target: tables.users.email,
        set: {
          name: payload.name,
          avatarUrl: payload.avatarUrl,
          emailVerified: true,
        },
      })
      .returning()
      .get()
    return record
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create user with OAuth',
    })
  }
}

export const updateUser = async (userId: string, payload: Partial<User>) => {
  try {
    // Super admin cannot be updated - Makes sure no super admin can be created
    // Only way to create a super admin is either through the CLI or directly in the database
    if (payload.superAdmin) {
      delete payload.superAdmin
    }
    const record = await useDB()
      .update(tables.users)
      .set(payload)
      .where(eq(tables.users.id, userId))
      .returning()
      .get()
    return record
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update user',
    })
  }
}

export const updateUserPassword = async (
  userId: string,
  hashedPassword: string,
) => {
  try {
    const record = await useDB()
      .update(tables.users)
      .set({ hashedPassword })
      .where(eq(tables.users.id, userId))
      .returning()
      .get()
    return record
  } catch (error) {
    console.error(error)
    throw new Error('Failed to update user password')
  }
}

export const linkOAuthAccount = async (
  userId: string,
  provider: string,
  providerUserId: string,
) => {
  try {
    // First check if the record exists
    const [existingAccount] = await useDB()
      .select()
      .from(tables.oauthAccounts)
      .where(
        and(
          eq(tables.oauthAccounts.provider, provider),
          eq(tables.oauthAccounts.providerUserId, providerUserId),
        ),
      )

    if (existingAccount) {
      // Update if it exists
      return await useDB()
        .update(tables.oauthAccounts)
        .set({ userId })
        .where(eq(tables.oauthAccounts.id, existingAccount.id))
        .returning()
        .get()
    } else {
      // Insert if it doesn't exist
      return await useDB()
        .insert(tables.oauthAccounts)
        .values({
          userId,
          provider,
          providerUserId,
        })
        .returning()
        .get()
    }
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to link OAuth account',
    })
  }
}

export const findUserByPhoneNumber = async (phoneNumber: string) => {
  try {
    const [user] = await useDB()
      .select()
      .from(tables.users)
      .where(eq(tables.users.phoneNumber, phoneNumber))
    return user || null
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to find user by phone number',
    })
  }
}

export const unlinkAccount = async (userId: string, providerId: string) => {
  try {
    // Get user to check if they have a password set
    const user = await findUserById(userId)
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found',
      })
    }

    // Get all linked accounts for the user
    const linkedAccounts = await findLinkedAccountsByUserId(userId)

    // If user has no password and only one linked account, prevent unlinking
    if (!user.hashedPassword && linkedAccounts.length <= 1) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Cannot unlink the only authentication method. Please set a password first.',
      })
    }

    // Proceed with unlinking if checks pass
    await useDB()
      .delete(tables.oauthAccounts)
      .where(
        and(
          eq(tables.oauthAccounts.userId, userId),
          eq(tables.oauthAccounts.id, providerId),
        ),
      )
  } catch (error) {
    console.error(error)
    if (error instanceof H3Error && error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to unlink account',
    })
  }
}

export const deleteUser = async (userId: string) => {
  await useDB().delete(tables.users).where(eq(tables.users.id, userId))
}
