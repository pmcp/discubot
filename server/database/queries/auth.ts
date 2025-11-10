import type {
  InsertEmailVerificationCodes,
  InsertOneTimePasswords,
} from '@@/types/database'
import { generateAlphaNumericCode } from '@@/server/utils/nanoid'

export const countEmailVerificationCodes = async (userId: string) => {
  try {
    const result = await useDB()
      .select({ count: count() })
      .from(tables.emailVerificationCodes)
      .where(eq(tables.emailVerificationCodes.userId, userId))
    return result[0].count
  } catch (error) {
    console.error(error)
    throw new Error('Failed to count verification codes')
  }
}

export const saveEmailVerificationCode = async (
  payload: InsertEmailVerificationCodes,
) => {
  try {
    const record = await useDB()
      .insert(tables.emailVerificationCodes)
      .values(payload)
      .returning()
      .get()
    return record
  } catch (error) {
    console.error(error)
    throw new Error('Failed to create verification code')
  }
}

export const saveOneTimePassword = async (payload: InsertOneTimePasswords) => {
  try {
    const record = await useDB()
      .insert(tables.oneTimePasswords)
      .values(payload)
      .returning()
      .get()
    return record
  } catch (error) {
    console.error(error)
    throw new Error('Failed to create one time password')
  }
}

export const findEmailVerificationCode = async (token: string) => {
  try {
    const [record] = await useDB()
      .select()
      .from(tables.emailVerificationCodes)
      .where(eq(tables.emailVerificationCodes.code, token))
    return record || null
  } catch (error) {
    console.error(error)
    throw new Error('Failed to find verification code')
  }
}

export const deleteExpiredEmailVerificationCodes = async (userId: string) => {
  try {
    // Calculate the timestamp for 30 minutes ago
    const thirtyMinutesAgo = new Date(Date.now() - 1000 * 60 * 30)

    await useDB()
      .delete(tables.emailVerificationCodes)
      .where(
        and(
          eq(tables.emailVerificationCodes.userId, userId),
          lt(tables.emailVerificationCodes.expiresAt, thirtyMinutesAgo),
        ),
      )
  } catch (error) {
    console.error(error)
    throw new Error('Failed to delete expired verification codes')
  }
}

export const deleteEmailVerificationCode = async (userId: string) => {
  try {
    await useDB()
      .delete(tables.emailVerificationCodes)
      .where(eq(tables.emailVerificationCodes.userId, userId))
  } catch (error) {
    console.error(error)
    throw new Error('Failed to delete verification code')
  }
}

export const findOneTimePassword = async (code: string) => {
  try {
    const [record] = await useDB()
      .select()
      .from(tables.oneTimePasswords)
      .where(eq(tables.oneTimePasswords.code, code))
    return record || null
  } catch (error) {
    console.error(error)
    throw new Error('Failed to find one time password')
  }
}

export const deleteOneTimePassword = async (code: string) => {
  try {
    await useDB()
      .delete(tables.oneTimePasswords)
      .where(eq(tables.oneTimePasswords.code, code))
  } catch (error) {
    console.error(error)
    throw new Error('Failed to delete one time password')
  }
}

export const createPasswordResetToken = async (userId: string) => {
  try {
    const token = generateAlphaNumericCode(32)
    const record = await useDB()
      .insert(tables.passwordResetTokens)
      .values({
        userId,
        code: token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes
      })
      .returning()
      .get()
    return record
  } catch (error) {
    console.error(error)
    throw new Error('Failed to create password reset token')
  }
}

export const findPasswordResetToken = async (token: string) => {
  try {
    const [record] = await useDB()
      .select()
      .from(tables.passwordResetTokens)
      .where(eq(tables.passwordResetTokens.code, token))
    return record || null
  } catch (error) {
    console.error(error)
    throw new Error('Failed to find password reset token')
  }
}

export const deletePasswordResetToken = async (token: string) => {
  try {
    await useDB()
      .delete(tables.passwordResetTokens)
      .where(eq(tables.passwordResetTokens.code, token))
  } catch (error) {
    console.error(error)
    throw new Error('Failed to delete password reset token')
  }
}
