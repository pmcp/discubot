import type {
  Passkey,
  InsertPasskey,
  InsertWebAuthnChallenge,
} from '@@/types/database'

export const findCredentialByUserId = async (
  userId: string,
): Promise<Passkey[]> => {
  try {
    const record = await useDB()
      .select()
      .from(tables.webAuthnCredentials)
      .where(eq(tables.webAuthnCredentials.userId, userId))
    return record
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to find credential by user id: ${error}`)
  }
}

export const createCredential = async (
  credential: InsertPasskey,
): Promise<Passkey> => {
  try {
    const record = await useDB()
      .insert(tables.webAuthnCredentials)
      .values(credential)
      .returning()
      .get()
    return record
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to create credential: ${error}`)
  }
}

export const storeWebAuthnChallenge = async (
  attemptId: string,
  challenge: string,
): Promise<void> => {
  try {
    const challengeData: InsertWebAuthnChallenge = {
      id: attemptId,
      challenge,
      expiresAt: new Date(Date.now() + 60000),
    }
    await useDB().insert(tables.webAuthnChallenges).values(challengeData)
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to store challenge: ${error}`)
  }
}

export const getAndDeleteChallenge = async (
  attemptId: string,
): Promise<string | undefined> => {
  try {
    // First, clean up expired challenges
    await useDB()
      .delete(tables.webAuthnChallenges)
      .where(lt(tables.webAuthnChallenges.expiresAt, new Date()))

    // Get the challenge
    const record = await useDB()
      .select()
      .from(tables.webAuthnChallenges)
      .where(eq(tables.webAuthnChallenges.id, attemptId))
      .get()

    if (record) {
      // Delete the challenge
      await useDB()
        .delete(tables.webAuthnChallenges)
        .where(eq(tables.webAuthnChallenges.id, attemptId))
    }

    return record?.challenge
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to get challenge: ${error}`)
  }
}

export const findCredentialById = async (
  credentialId: string,
): Promise<Passkey | null> => {
  try {
    const [record] = await useDB()
      .select()
      .from(tables.webAuthnCredentials)
      .where(eq(tables.webAuthnCredentials.id, credentialId))
    return record || null
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to find credential by id: ${error}`)
  }
}

export const deleteCredential = async (
  userId: string,
  credentialId: string,
): Promise<void> => {
  try {
    await useDB()
      .delete(tables.webAuthnCredentials)
      .where(
        and(
          eq(tables.webAuthnCredentials.userId, userId),
          eq(tables.webAuthnCredentials.id, credentialId),
        ),
      )
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to delete credential: ${error}`)
  }
}
