/**
 * Encrypted Config Helpers
 *
 * Utilities for working with encrypted source configurations.
 * Handles automatic encryption/decryption of sensitive fields.
 */

import { encryptToken, decryptToken, isEncrypted } from '~/server/utils/encryption'
import type { SourceConfig } from '../adapters/base'

/**
 * Fields that should be encrypted in source configs
 */
const ENCRYPTED_FIELDS = [
  'apiToken',
  'notionToken',
  'anthropicApiKey',
] as const

type EncryptedField = typeof ENCRYPTED_FIELDS[number]

/**
 * Encrypt sensitive fields in a source config
 *
 * @param config - Source config with plaintext tokens
 * @returns Config with encrypted tokens
 */
export async function encryptSourceConfig(
  config: Partial<SourceConfig>
): Promise<Partial<SourceConfig>> {
  const encrypted = { ...config }

  for (const field of ENCRYPTED_FIELDS) {
    const value = encrypted[field]

    if (value && typeof value === 'string' && !isEncrypted(value)) {
      try {
        encrypted[field] = await encryptToken(value)
        console.log(`[Encrypted Config] Encrypted field: ${field}`)
      }
      catch (error) {
        console.error(`[Encrypted Config] Failed to encrypt ${field}:`, error)
        throw error
      }
    }
  }

  return encrypted
}

/**
 * Decrypt sensitive fields in a source config
 *
 * @param config - Source config with encrypted tokens
 * @returns Config with plaintext tokens
 */
export async function decryptSourceConfig(
  config: Partial<SourceConfig>
): Promise<Partial<SourceConfig>> {
  const decrypted = { ...config }

  for (const field of ENCRYPTED_FIELDS) {
    const value = decrypted[field]

    if (value && typeof value === 'string' && isEncrypted(value)) {
      try {
        decrypted[field] = await decryptToken(value)
        console.log(`[Encrypted Config] Decrypted field: ${field}`)
      }
      catch (error) {
        console.error(`[Encrypted Config] Failed to decrypt ${field}:`, error)
        // Don't throw - return encrypted value so app doesn't crash
        // The adapter will fail gracefully when trying to use invalid token
      }
    }
  }

  return decrypted
}

/**
 * Decrypt only the API token from a config
 *
 * This is useful when you only need the API token and want to avoid
 * unnecessary decryption operations.
 *
 * @param config - Source config
 * @returns Decrypted API token or undefined
 */
export async function getDecryptedApiToken(
  config: Partial<SourceConfig>
): Promise<string | undefined> {
  const token = config.apiToken

  if (!token) {
    return undefined
  }

  if (isEncrypted(token)) {
    try {
      return await decryptToken(token)
    }
    catch (error) {
      console.error('[Encrypted Config] Failed to decrypt API token:', error)
      return undefined
    }
  }

  return token
}

/**
 * Decrypt only the Notion token from a config
 *
 * @param config - Source config
 * @returns Decrypted Notion token or undefined
 */
export async function getDecryptedNotionToken(
  config: Partial<SourceConfig>
): Promise<string | undefined> {
  const token = config.notionToken

  if (!token) {
    return undefined
  }

  if (isEncrypted(token)) {
    try {
      return await decryptToken(token)
    }
    catch (error) {
      console.error('[Encrypted Config] Failed to decrypt Notion token:', error)
      return undefined
    }
  }

  return token
}

/**
 * Check if a config has all required encrypted fields
 *
 * @param config - Source config to check
 * @returns True if all sensitive fields are encrypted
 */
export function isConfigEncrypted(config: Partial<SourceConfig>): boolean {
  for (const field of ENCRYPTED_FIELDS) {
    const value = config[field]
    if (value && typeof value === 'string' && !isEncrypted(value)) {
      return false
    }
  }
  return true
}

/**
 * Prepare config for database storage (encrypt tokens)
 *
 * Use this before saving a config to the database.
 *
 * @param config - Config with plaintext tokens
 * @returns Config ready for database storage
 */
export async function prepareConfigForStorage(
  config: Partial<SourceConfig>
): Promise<Partial<SourceConfig>> {
  console.log('[Encrypted Config] Preparing config for storage')
  return encryptSourceConfig(config)
}

/**
 * Prepare config for use (decrypt tokens)
 *
 * Use this after retrieving a config from the database.
 *
 * @param config - Config from database
 * @returns Config ready to use with services
 */
export async function prepareConfigForUse(
  config: Partial<SourceConfig>
): Promise<Partial<SourceConfig>> {
  console.log('[Encrypted Config] Preparing config for use')
  return decryptSourceConfig(config)
}

/**
 * Migration helper: Encrypt plaintext tokens in existing configs
 *
 * This can be used in a migration script to encrypt existing plaintext tokens.
 *
 * @param configs - Array of configs from database
 * @returns Array of configs with encrypted tokens
 */
export async function migrateConfigsToEncrypted(
  configs: Partial<SourceConfig>[]
): Promise<Partial<SourceConfig>[]> {
  console.log(`[Encrypted Config] Migrating ${configs.length} configs to encrypted format`)

  const migrated: Partial<SourceConfig>[] = []

  for (const config of configs) {
    try {
      const encrypted = await encryptSourceConfig(config)
      migrated.push(encrypted)
    }
    catch (error) {
      console.error('[Encrypted Config] Failed to migrate config:', config.id, error)
      // Skip this config but continue with others
      migrated.push(config)
    }
  }

  console.log(`[Encrypted Config] Successfully migrated ${migrated.length} configs`)
  return migrated
}
