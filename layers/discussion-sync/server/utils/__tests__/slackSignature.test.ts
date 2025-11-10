import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifySlackSignature, verifySlackRequest, allowInDevelopment } from '../slackSignature'
import { createHmac } from 'node:crypto'

describe('slackSignature', () => {
  const TEST_SECRET = 'test-signing-secret-123'
  const TEST_BODY = JSON.stringify({ type: 'url_verification', challenge: 'test' })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('verifySlackSignature', () => {
    it('should verify valid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const baseString = `v0:${timestamp}:${TEST_BODY}`
      const hmac = createHmac('sha256', TEST_SECRET)
      hmac.update(baseString)
      const validSignature = `v0=${hmac.digest('hex')}`

      const result = verifySlackSignature(TEST_BODY, timestamp, validSignature, TEST_SECRET)

      expect(result).toBe(true)
    })

    it('should reject invalid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const invalidSignature = 'v0=invalid_signature_hash'

      const result = verifySlackSignature(TEST_BODY, timestamp, invalidSignature, TEST_SECRET)

      expect(result).toBe(false)
    })

    it('should reject tampered body', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const baseString = `v0:${timestamp}:${TEST_BODY}`
      const hmac = createHmac('sha256', TEST_SECRET)
      hmac.update(baseString)
      const validSignature = `v0=${hmac.digest('hex')}`

      // Try to verify with different body
      const tamperedBody = JSON.stringify({ type: 'event_callback' })
      const result = verifySlackSignature(tamperedBody, timestamp, validSignature, TEST_SECRET)

      expect(result).toBe(false)
    })

    it('should reject tampered timestamp', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const baseString = `v0:${timestamp}:${TEST_BODY}`
      const hmac = createHmac('sha256', TEST_SECRET)
      hmac.update(baseString)
      const validSignature = `v0=${hmac.digest('hex')}`

      // Try to verify with different timestamp
      const tamperedTimestamp = (Number.parseInt(timestamp) + 100).toString()
      const result = verifySlackSignature(TEST_BODY, tamperedTimestamp, validSignature, TEST_SECRET)

      expect(result).toBe(false)
    })

    it('should reject old timestamps (replay protection)', () => {
      // Create signature with timestamp from 10 minutes ago
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString()
      const baseString = `v0:${oldTimestamp}:${TEST_BODY}`
      const hmac = createHmac('sha256', TEST_SECRET)
      hmac.update(baseString)
      const validSignature = `v0=${hmac.digest('hex')}`

      const result = verifySlackSignature(TEST_BODY, oldTimestamp, validSignature, TEST_SECRET)

      expect(result).toBe(false)
    })

    it('should reject future timestamps', () => {
      // Create signature with timestamp from 10 minutes in the future
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 600).toString()
      const baseString = `v0:${futureTimestamp}:${TEST_BODY}`
      const hmac = createHmac('sha256', TEST_SECRET)
      hmac.update(baseString)
      const validSignature = `v0=${hmac.digest('hex')}`

      const result = verifySlackSignature(TEST_BODY, futureTimestamp, validSignature, TEST_SECRET)

      expect(result).toBe(false)
    })

    it('should accept timestamps within 5 minute window', () => {
      // Create signature with timestamp from 4 minutes ago (within window)
      const recentTimestamp = (Math.floor(Date.now() / 1000) - 240).toString()
      const baseString = `v0:${recentTimestamp}:${TEST_BODY}`
      const hmac = createHmac('sha256', TEST_SECRET)
      hmac.update(baseString)
      const validSignature = `v0=${hmac.digest('hex')}`

      const result = verifySlackSignature(TEST_BODY, recentTimestamp, validSignature, TEST_SECRET)

      expect(result).toBe(true)
    })

    it('should reject invalid timestamp format', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const baseString = `v0:${timestamp}:${TEST_BODY}`
      const hmac = createHmac('sha256', TEST_SECRET)
      hmac.update(baseString)
      const validSignature = `v0=${hmac.digest('hex')}`

      const result = verifySlackSignature(TEST_BODY, 'not-a-number', validSignature, TEST_SECRET)

      expect(result).toBe(false)
    })

    it('should reject mismatched signature lengths', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const shortSignature = 'v0=short'

      const result = verifySlackSignature(TEST_BODY, timestamp, shortSignature, TEST_SECRET)

      expect(result).toBe(false)
    })

    it('should handle errors gracefully', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const validSignature = 'v0=somehash'

      // Pass null as secret to trigger error
      const result = verifySlackSignature(TEST_BODY, timestamp, validSignature, null as any)

      expect(result).toBe(false)
    })
  })

  describe('verifySlackRequest', () => {
    it('should verify valid H3 event request', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const baseString = `v0:${timestamp}:${TEST_BODY}`
      const hmac = createHmac('sha256', TEST_SECRET)
      hmac.update(baseString)
      const validSignature = `v0=${hmac.digest('hex')}`

      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': timestamp,
          'x-slack-signature': validSignature,
        },
        _rawBody: TEST_BODY,
      }

      const result = await verifySlackRequest(mockEvent, TEST_SECRET)

      expect(result).toBe(true)
    })

    it('should reject request with missing timestamp header', async () => {
      const mockEvent = {
        headers: {
          'x-slack-signature': 'v0=somehash',
        },
        _rawBody: TEST_BODY,
      }

      const result = await verifySlackRequest(mockEvent, TEST_SECRET)

      expect(result).toBe(false)
    })

    it('should reject request with missing signature header', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()

      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': timestamp,
        },
        _rawBody: TEST_BODY,
      }

      const result = await verifySlackRequest(mockEvent, TEST_SECRET)

      expect(result).toBe(false)
    })

    it('should reject request with missing body', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const baseString = `v0:${timestamp}:${TEST_BODY}`
      const hmac = createHmac('sha256', TEST_SECRET)
      hmac.update(baseString)
      const validSignature = `v0=${hmac.digest('hex')}`

      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': timestamp,
          'x-slack-signature': validSignature,
        },
        _rawBody: null,
      }

      const result = await verifySlackRequest(mockEvent, TEST_SECRET)

      expect(result).toBe(false)
    })

    it('should handle errors gracefully', async () => {
      const mockEvent = {
        headers: null, // Will cause an error
      }

      const result = await verifySlackRequest(mockEvent, TEST_SECRET)

      expect(result).toBe(false)
    })
  })

  describe('allowInDevelopment', () => {
    it('should return true in development mode', () => {
      const result = allowInDevelopment(false)

      expect(result).toBe(true)
    })

    it('should return false in production mode', () => {
      const result = allowInDevelopment(true)

      expect(result).toBe(false)
    })
  })
})