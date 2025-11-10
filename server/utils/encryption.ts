/**
 * Token Encryption Utility
 *
 * Provides secure encryption and decryption for API tokens and sensitive data
 * using AES-256-GCM (Galois/Counter Mode) which provides both confidentiality
 * and authenticity.
 *
 * Security Features:
 * - AES-256-GCM encryption (authenticated encryption)
 * - Random IV (Initialization Vector) for each encryption
 * - Authentication tag to prevent tampering
 * - Key derivation from master key using scrypt
 * - Constant-time comparison to prevent timing attacks
 *
 * @see https://nodejs.org/api/crypto.html
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

// Constants
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits
const SALT_LENGTH = 32 // 256 bits
const KEY_LENGTH = 32 // 256 bits
const AUTH_TAG_LENGTH = 16 // 128 bits
const ENCODING = 'hex'

/**
 * Encrypted data format: salt:iv:authTag:encryptedData
 * Each component is hex-encoded and separated by colons
 */
interface EncryptedToken {
  salt: string
  iv: string
  authTag: string
  encryptedData: string
}

/**
 * Derive encryption key from master key using scrypt
 *
 * This provides key stretching and makes brute-force attacks more difficult.
 */
async function deriveKey(masterKey: string, salt: Buffer): Promise<Buffer> {
  // scrypt parameters: N=16384, r=8, p=1
  // These are recommended values that provide good security
  return (await scryptAsync(masterKey, salt, KEY_LENGTH, {
    N: 16384,
    r: 8,
    p: 1,
  })) as Buffer
}

/**
 * Encrypt a token or sensitive string
 *
 * @param plaintext - The token/string to encrypt
 * @param masterKey - The master encryption key (from environment)
 * @returns Encrypted string in format: salt:iv:authTag:encryptedData
 *
 * @example
 * const encrypted = await encryptToken('my-secret-token', process.env.ENCRYPTION_KEY)
 * // Returns: "abc123...def456...ghi789...jkl012..."
 */
export async function encryptToken(
  plaintext: string,
  masterKey?: string
): Promise<string> {
  try {
    // Validate inputs
    if (!plaintext) {
      throw new Error('[Encryption] Cannot encrypt empty string')
    }

    if (!masterKey) {
      const config = useRuntimeConfig()
      masterKey = config.encryptionKey || config.public.encryptionKey
    }

    if (!masterKey) {
      throw new Error('[Encryption] No encryption key configured')
    }

    if (masterKey.length < 32) {
      throw new Error('[Encryption] Encryption key must be at least 32 characters')
    }

    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH)
    const iv = randomBytes(IV_LENGTH)

    // Derive encryption key from master key
    const key = await deriveKey(masterKey, salt)

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv)

    // Encrypt the plaintext
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])

    // Get authentication tag
    const authTag = cipher.getAuthTag()

    // Combine all components into a single string
    const result = [
      salt.toString(ENCODING),
      iv.toString(ENCODING),
      authTag.toString(ENCODING),
      encrypted.toString(ENCODING),
    ].join(':')

    return result
  }
  catch (error) {
    console.error('[Encryption] Failed to encrypt token:', error)
    throw new Error(
      `[Encryption] Encryption failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Decrypt an encrypted token
 *
 * @param encryptedString - The encrypted string (salt:iv:authTag:encryptedData)
 * @param masterKey - The master encryption key (from environment)
 * @returns Decrypted plaintext
 *
 * @example
 * const decrypted = await decryptToken(encrypted, process.env.ENCRYPTION_KEY)
 * // Returns: "my-secret-token"
 */
export async function decryptToken(
  encryptedString: string,
  masterKey?: string
): Promise<string> {
  try {
    // Validate inputs
    if (!encryptedString) {
      throw new Error('[Encryption] Cannot decrypt empty string')
    }

    if (!masterKey) {
      const config = useRuntimeConfig()
      masterKey = config.encryptionKey || config.public.encryptionKey
    }

    if (!masterKey) {
      throw new Error('[Encryption] No encryption key configured')
    }

    // Parse encrypted string
    const parts = encryptedString.split(':')
    if (parts.length !== 4) {
      throw new Error('[Encryption] Invalid encrypted string format')
    }

    const [saltHex, ivHex, authTagHex, encryptedDataHex] = parts

    if (!saltHex || !ivHex || !authTagHex || !encryptedDataHex) {
      throw new Error('[Encryption] Missing components in encrypted string')
    }

    // Convert from hex to buffers
    const salt = Buffer.from(saltHex, ENCODING)
    const iv = Buffer.from(ivHex, ENCODING)
    const authTag = Buffer.from(authTagHex, ENCODING)
    const encryptedData = Buffer.from(encryptedDataHex, ENCODING)

    // Validate lengths
    if (salt.length !== SALT_LENGTH) {
      throw new Error('[Encryption] Invalid salt length')
    }
    if (iv.length !== IV_LENGTH) {
      throw new Error('[Encryption] Invalid IV length')
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('[Encryption] Invalid auth tag length')
    }

    // Derive the same encryption key
    const key = await deriveKey(masterKey, salt)

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  }
  catch (error) {
    console.error('[Encryption] Failed to decrypt token:', error)
    throw new Error(
      `[Encryption] Decryption failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Check if a string appears to be encrypted
 *
 * @param value - String to check
 * @returns True if the string looks like an encrypted token
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }

  // Check format: should have 4 colon-separated hex strings
  const parts = value.split(':')
  if (parts.length !== 4) {
    return false
  }

  // Verify each part is valid hex
  const hexPattern = /^[0-9a-f]+$/i
  return parts.every(part => hexPattern.test(part))
}

/**
 * Rotate encryption for a token
 *
 * This decrypts with the old key and re-encrypts with the new key.
 * Useful when rotating encryption keys.
 *
 * @param encryptedString - Token encrypted with old key
 * @param oldMasterKey - Old encryption key
 * @param newMasterKey - New encryption key
 * @returns Token encrypted with new key
 */
export async function rotateTokenEncryption(
  encryptedString: string,
  oldMasterKey: string,
  newMasterKey: string
): Promise<string> {
  try {
    // Decrypt with old key
    const plaintext = await decryptToken(encryptedString, oldMasterKey)

    // Encrypt with new key
    const newEncrypted = await encryptToken(plaintext, newMasterKey)

    return newEncrypted
  }
  catch (error) {
    console.error('[Encryption] Failed to rotate encryption:', error)
    throw new Error(
      `[Encryption] Rotation failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Generate a secure random encryption key
 *
 * This generates a 256-bit (32-byte) random key suitable for use
 * as a master encryption key.
 *
 * @returns Hex-encoded random key (64 characters)
 *
 * @example
 * const key = generateEncryptionKey()
 * // Save this to your .env file as ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Encrypt multiple tokens in batch
 *
 * @param tokens - Array of tokens to encrypt
 * @param masterKey - Master encryption key
 * @returns Array of encrypted tokens
 */
export async function encryptTokensBatch(
  tokens: string[],
  masterKey?: string
): Promise<string[]> {
  return Promise.all(tokens.map(token => encryptToken(token, masterKey)))
}

/**
 * Decrypt multiple tokens in batch
 *
 * @param encryptedTokens - Array of encrypted tokens
 * @param masterKey - Master encryption key
 * @returns Array of decrypted tokens
 */
export async function decryptTokensBatch(
  encryptedTokens: string[],
  masterKey?: string
): Promise<string[]> {
  return Promise.all(encryptedTokens.map(token => decryptToken(token, masterKey)))
}
