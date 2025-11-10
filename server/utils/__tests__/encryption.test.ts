import { describe, it, expect, beforeEach } from 'vitest'
import {
  encryptToken,
  decryptToken,
  isEncrypted,
  rotateTokenEncryption,
  generateEncryptionKey,
  encryptTokensBatch,
  decryptTokensBatch,
} from '../encryption'

describe('Token Encryption', () => {
  const TEST_KEY = 'a'.repeat(64) // 64 character hex key (256 bits)
  const TEST_TOKEN = 'secret-api-token-12345'

  describe('encryptToken', () => {
    it('should encrypt a plaintext token', async () => {
      const encrypted = await encryptToken(TEST_TOKEN, TEST_KEY)

      expect(encrypted).toBeDefined()
      expect(encrypted).not.toBe(TEST_TOKEN)
      expect(typeof encrypted).toBe('string')
    })

    it('should produce different ciphertexts for same plaintext', async () => {
      const encrypted1 = await encryptToken(TEST_TOKEN, TEST_KEY)
      const encrypted2 = await encryptToken(TEST_TOKEN, TEST_KEY)

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should include all required components (salt:iv:authTag:data)', async () => {
      const encrypted = await encryptToken(TEST_TOKEN, TEST_KEY)
      const parts = encrypted.split(':')

      expect(parts.length).toBe(4)
      expect(parts[0]).toBeTruthy() // salt
      expect(parts[1]).toBeTruthy() // iv
      expect(parts[2]).toBeTruthy() // authTag
      expect(parts[3]).toBeTruthy() // encrypted data
    })

    it('should throw error for empty plaintext', async () => {
      await expect(encryptToken('', TEST_KEY)).rejects.toThrow('empty string')
    })

    it('should throw error if no encryption key provided', async () => {
      await expect(encryptToken(TEST_TOKEN, '')).rejects.toThrow()
    })

    it('should throw error for short encryption key', async () => {
      await expect(encryptToken(TEST_TOKEN, 'too-short')).rejects.toThrow('at least 32 characters')
    })
  })

  describe('decryptToken', () => {
    it('should decrypt an encrypted token', async () => {
      const encrypted = await encryptToken(TEST_TOKEN, TEST_KEY)
      const decrypted = await decryptToken(encrypted, TEST_KEY)

      expect(decrypted).toBe(TEST_TOKEN)
    })

    it('should handle long tokens', async () => {
      const longToken = 'x'.repeat(1000)
      const encrypted = await encryptToken(longToken, TEST_KEY)
      const decrypted = await decryptToken(encrypted, TEST_KEY)

      expect(decrypted).toBe(longToken)
    })

    it('should handle special characters', async () => {
      const specialToken = 'token!@#$%^&*()_+-={}[]|:";\'<>?,./`~'
      const encrypted = await encryptToken(specialToken, TEST_KEY)
      const decrypted = await decryptToken(encrypted, TEST_KEY)

      expect(decrypted).toBe(specialToken)
    })

    it('should throw error for empty encrypted string', async () => {
      await expect(decryptToken('', TEST_KEY)).rejects.toThrow('empty string')
    })

    it('should throw error for invalid format', async () => {
      await expect(decryptToken('invalid-format', TEST_KEY)).rejects.toThrow('Invalid encrypted string format')
    })

    it('should throw error for wrong encryption key', async () => {
      const encrypted = await encryptToken(TEST_TOKEN, TEST_KEY)
      const wrongKey = 'b'.repeat(64)

      await expect(decryptToken(encrypted, wrongKey)).rejects.toThrow()
    })

    it('should throw error for tampered ciphertext', async () => {
      const encrypted = await encryptToken(TEST_TOKEN, TEST_KEY)
      const parts = encrypted.split(':')
      // Tamper with encrypted data
      parts[3] = parts[3]?.substring(0, parts[3].length - 2) + 'ff'
      const tampered = parts.join(':')

      await expect(decryptToken(tampered, TEST_KEY)).rejects.toThrow()
    })

    it('should throw error for missing components', async () => {
      const encrypted = await encryptToken(TEST_TOKEN, TEST_KEY)
      const parts = encrypted.split(':')
      const incomplete = parts.slice(0, 3).join(':')

      await expect(decryptToken(incomplete, TEST_KEY)).rejects.toThrow()
    })
  })

  describe('isEncrypted', () => {
    it('should return true for encrypted tokens', async () => {
      const encrypted = await encryptToken(TEST_TOKEN, TEST_KEY)
      expect(isEncrypted(encrypted)).toBe(true)
    })

    it('should return false for plaintext tokens', () => {
      expect(isEncrypted('plain-token-123')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false)
    })

    it('should return false for null or undefined', () => {
      expect(isEncrypted(null as any)).toBe(false)
      expect(isEncrypted(undefined as any)).toBe(false)
    })

    it('should return false for invalid format', () => {
      expect(isEncrypted('not:enough:parts')).toBe(false)
    })

    it('should return false for non-hex components', () => {
      expect(isEncrypted('abcd:efgh:ijkl:mnop')).toBe(false)
      expect(isEncrypted('zzz:yyy:xxx:www')).toBe(false)
    })
  })

  describe('rotateTokenEncryption', () => {
    it('should re-encrypt with new key', async () => {
      const oldKey = 'a'.repeat(64)
      const newKey = 'b'.repeat(64)

      const encrypted = await encryptToken(TEST_TOKEN, oldKey)
      const rotated = await rotateTokenEncryption(encrypted, oldKey, newKey)

      // Should be able to decrypt with new key
      const decrypted = await decryptToken(rotated, newKey)
      expect(decrypted).toBe(TEST_TOKEN)

      // Should NOT be able to decrypt with old key
      await expect(decryptToken(rotated, oldKey)).rejects.toThrow()
    })

    it('should throw error if old key is wrong', async () => {
      const oldKey = 'a'.repeat(64)
      const newKey = 'b'.repeat(64)
      const wrongOldKey = 'c'.repeat(64)

      const encrypted = await encryptToken(TEST_TOKEN, oldKey)

      await expect(
        rotateTokenEncryption(encrypted, wrongOldKey, newKey)
      ).rejects.toThrow()
    })
  })

  describe('generateEncryptionKey', () => {
    it('should generate a valid key', () => {
      const key = generateEncryptionKey()

      expect(key).toBeDefined()
      expect(typeof key).toBe('string')
      expect(key.length).toBe(64) // 32 bytes in hex = 64 characters
    })

    it('should generate different keys each time', () => {
      const key1 = generateEncryptionKey()
      const key2 = generateEncryptionKey()

      expect(key1).not.toBe(key2)
    })

    it('should generate keys that work for encryption', async () => {
      const key = generateEncryptionKey()
      const encrypted = await encryptToken(TEST_TOKEN, key)
      const decrypted = await decryptToken(encrypted, key)

      expect(decrypted).toBe(TEST_TOKEN)
    })
  })

  describe('batch operations', () => {
    const tokens = ['token1', 'token2', 'token3']

    describe('encryptTokensBatch', () => {
      it('should encrypt multiple tokens', async () => {
        const encrypted = await encryptTokensBatch(tokens, TEST_KEY)

        expect(encrypted).toHaveLength(3)
        encrypted.forEach(token => {
          expect(isEncrypted(token)).toBe(true)
        })
      })

      it('should handle empty array', async () => {
        const encrypted = await encryptTokensBatch([], TEST_KEY)
        expect(encrypted).toEqual([])
      })
    })

    describe('decryptTokensBatch', () => {
      it('should decrypt multiple tokens', async () => {
        const encrypted = await encryptTokensBatch(tokens, TEST_KEY)
        const decrypted = await decryptTokensBatch(encrypted, TEST_KEY)

        expect(decrypted).toEqual(tokens)
      })

      it('should handle empty array', async () => {
        const decrypted = await decryptTokensBatch([], TEST_KEY)
        expect(decrypted).toEqual([])
      })
    })
  })

  describe('end-to-end encryption flow', () => {
    it('should encrypt, store, retrieve, and decrypt', async () => {
      // Simulate storing in database
      const originalToken = 'my-api-token-secret'
      const encryptedForStorage = await encryptToken(originalToken, TEST_KEY)

      // Verify it's encrypted
      expect(isEncrypted(encryptedForStorage)).toBe(true)
      expect(encryptedForStorage).not.toBe(originalToken)

      // Simulate retrieving from database
      const retrievedFromDb = encryptedForStorage

      // Decrypt for use
      const decryptedForUse = await decryptToken(retrievedFromDb, TEST_KEY)

      expect(decryptedForUse).toBe(originalToken)
    })
  })
})
