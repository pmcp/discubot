import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import type { H3Event } from 'h3'

// Mock dependencies
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  get: vi.fn(),
  all: vi.fn(),
}

const mockGetAdapter = vi.fn()
const mockVerifySlackSignature = vi.fn()
const mockFetch = vi.fn()

vi.mock('~/server/database', () => ({
  db: mockDb,
}))

vi.mock('../../../../adapters/base', () => ({
  getAdapter: mockGetAdapter,
}))

vi.mock('../../../../utils/slackSignature', () => ({
  verifySlackSignature: mockVerifySlackSignature,
}))

// Mock Nuxt/H3 functions
vi.stubGlobal('defineEventHandler', (handler: any) => handler)
vi.stubGlobal('createError', (error: any) => error)

describe('Slack Events Webhook', () => {
  const TEST_SECRET = 'test-signing-secret'

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset all mock functions
    mockDb.get.mockReset()
    mockDb.all.mockReset()
    mockDb.insert.mockReturnValue(mockDb)
    mockDb.values.mockReturnValue(mockDb)
    mockDb.returning.mockReturnValue(mockDb)
    mockGetAdapter.mockReset()
    mockVerifySlackSignature.mockReset()
    mockFetch.mockReset()

    // Mock runtime config
    vi.stubGlobal('useRuntimeConfig', () => ({
      slackSigningSecret: TEST_SECRET,
    }))

    // Mock global $fetch
    vi.stubGlobal('$fetch', mockFetch)
  })

  describe('URL verification challenge', () => {
    it('should respond to URL verification challenge', async () => {
      const challengePayload = {
        type: 'url_verification',
        token: 'test-token',
        challenge: 'test-challenge-string',
      }

      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-slack-signature': 'v0=somehash',
        },
        _rawBody: JSON.stringify(challengePayload),
      }

      mockVerifySlackSignature.mockReturnValue(true)
      vi.stubGlobal('readRawBody', vi.fn().mockResolvedValue(JSON.stringify(challengePayload)))
      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      // Mock the handler
      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        challenge: 'test-challenge-string',
      })
    })
  })

  describe('Signature verification', () => {
    it('should reject request with missing timestamp header', async () => {
      const mockEvent = {
        headers: {
          'x-slack-signature': 'v0=somehash',
        },
      }

      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      expect(result).toMatchObject({
        statusCode: 401,
      })
    })

    it('should reject request with missing signature header', async () => {
      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
        },
      }

      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      expect(result).toMatchObject({
        statusCode: 401,
      })
    })

    it('should reject request with missing body', async () => {
      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-slack-signature': 'v0=somehash',
        },
      }

      // Mock readRawBody to return null
      vi.stubGlobal('readRawBody', vi.fn().mockResolvedValue(null))
      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      expect(result).toMatchObject({
        statusCode: 400,
      })
    })

    it('should reject request with invalid signature in production', async () => {
      process.env.NODE_ENV = 'production'

      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-slack-signature': 'v0=invalid',
        },
        _rawBody: JSON.stringify({ type: 'event_callback' }),
      }

      mockVerifySlackSignature.mockReturnValue(false)
      vi.stubGlobal('readRawBody', vi.fn().mockResolvedValue(JSON.stringify({ type: 'event_callback' })))
      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      expect(result).toMatchObject({
        statusCode: 401,
      })

      process.env.NODE_ENV = 'test'
    })

    it('should skip signature verification in development', async () => {
      process.env.NODE_ENV = 'development'

      const challengePayload = {
        type: 'url_verification',
        challenge: 'test',
      }

      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-slack-signature': 'v0=anything',
        },
        _rawBody: JSON.stringify(challengePayload),
      }

      vi.stubGlobal('readRawBody', vi.fn().mockResolvedValue(JSON.stringify(challengePayload)))
      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      // Should process without checking signature
      expect(result.challenge).toBe('test')
      expect(mockVerifySlackSignature).not.toHaveBeenCalled()

      process.env.NODE_ENV = 'test'
    })
  })

  describe('app_mention event processing', () => {
    const mockAppMentionPayload = {
      type: 'event_callback',
      token: 'test-token',
      team_id: 'T123ABC',
      api_app_id: 'A123',
      event: {
        type: 'app_mention',
        user: 'U123USER',
        text: '<@U123BOT> help with this',
        ts: '1234567890.123456',
        channel: 'C123CHANNEL',
        event_ts: '1234567890.123456',
      },
      event_id: 'Ev123EVENT',
      event_time: 1234567890,
    }

    it('should process app_mention event successfully', async () => {
      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue({
          sourceType: 'slack',
          sourceThreadId: '1234567890.123456',
          sourceUrl: 'https://slack.com/...',
          teamId: 'T123ABC',
          authorHandle: 'U123USER',
          title: 'Slack message',
          content: 'help with this',
          participants: ['U123USER'],
          metadata: {
            channelId: 'C123CHANNEL',
            messageTs: '1234567890.123456',
          },
        }),
      }

      mockGetAdapter.mockReturnValue(mockAdapter)
      mockVerifySlackSignature.mockReturnValue(true)

      // Mock database queries
      mockDb.get.mockResolvedValueOnce(null) // checkDuplicateEvent returns false
      mockDb.all.mockResolvedValueOnce([
        {
          id: 'config-1',
          sourceId: 'slack',
          teamId: 'team-1',
          owner: 'owner-1',
          metadata: { workspaceId: 'T123ABC' },
        },
      ])
      mockDb.get.mockResolvedValueOnce({
        id: 'discussion-1',
        sourceThreadId: '1234567890.123456',
      })

      // Mock $fetch for processing trigger
      mockFetch.mockResolvedValue({ ok: true })
      vi.stubGlobal('readRawBody', vi.fn().mockResolvedValue(JSON.stringify(mockAppMentionPayload)))
      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-slack-signature': 'v0=valid',
        },
      }

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      expect(result).toMatchObject({
        ok: true,
        discussionId: 'discussion-1',
      })
      expect(mockAdapter.parseIncoming).toHaveBeenCalled()
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should ignore non-app_mention events', async () => {
      const messagePayload = {
        type: 'event_callback',
        event: {
          type: 'message',
          text: 'Regular message',
        },
      }

      mockVerifySlackSignature.mockReturnValue(true)
      vi.stubGlobal('readRawBody', vi.fn().mockResolvedValue(JSON.stringify(messagePayload)))
      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-slack-signature': 'v0=valid',
        },
      }

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      expect(result).toEqual({ ok: true })
      expect(mockGetAdapter).not.toHaveBeenCalled()
    })

    it('should skip duplicate events', async () => {
      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-slack-signature': 'v0=valid',
        },
      }

      mockVerifySlackSignature.mockReturnValue(true)
      vi.stubGlobal('readRawBody', vi.fn().mockResolvedValue(JSON.stringify(mockAppMentionPayload)))
      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      // Mock duplicate detection
      mockDb.get.mockResolvedValueOnce({ id: 'existing-discussion' })

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      expect(result).toEqual({ ok: true })
      expect(mockGetAdapter).not.toHaveBeenCalled()
    })

    it('should return 404 if no matching source config found', async () => {
      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue({
          sourceType: 'slack',
          teamId: 'T123ABC',
          sourceThreadId: '1234567890.123456',
          sourceUrl: 'https://slack.com/...',
          authorHandle: 'U123USER',
          title: 'Slack message',
          content: 'help',
          participants: ['U123USER'],
          metadata: {},
        }),
      }

      mockGetAdapter.mockReturnValue(mockAdapter)
      mockVerifySlackSignature.mockReturnValue(true)
      vi.stubGlobal('readRawBody', vi.fn().mockResolvedValue(JSON.stringify(mockAppMentionPayload)))
      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      // Mock database queries
      mockDb.get.mockResolvedValueOnce(null) // No duplicate
      mockDb.all.mockResolvedValueOnce([]) // No matching configs

      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-slack-signature': 'v0=valid',
        },
      }

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      expect(result).toMatchObject({
        statusCode: 404,
      })
    })

    it('should handle processing trigger errors gracefully', async () => {
      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue({
          sourceType: 'slack',
          sourceThreadId: '1234567890.123456',
          teamId: 'T123ABC',
          sourceUrl: 'https://slack.com/...',
          authorHandle: 'U123USER',
          title: 'Slack message',
          content: 'help',
          participants: ['U123USER'],
          metadata: {},
        }),
      }

      mockGetAdapter.mockReturnValue(mockAdapter)
      mockVerifySlackSignature.mockReturnValue(true)
      vi.stubGlobal('readRawBody', vi.fn().mockResolvedValue(JSON.stringify(mockAppMentionPayload)))
      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      // Mock database queries
      mockDb.get.mockResolvedValueOnce(null) // No duplicate
      mockDb.all.mockResolvedValueOnce([
        {
          id: 'config-1',
          metadata: { workspaceId: 'T123ABC' },
          teamId: 'team-1',
          owner: 'owner-1',
        },
      ])
      mockDb.get.mockResolvedValueOnce({
        id: 'discussion-1',
      })

      // Mock $fetch to fail
      mockFetch.mockRejectedValue(new Error('Processing failed'))

      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-slack-signature': 'v0=valid',
        },
      }

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      // Should still return success even if processing fails
      expect(result).toMatchObject({
        ok: true,
        discussionId: 'discussion-1',
      })
    })
  })

  describe('Error handling', () => {
    it('should return 500 if signing secret not configured', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        slackSigningSecret: null,
      }))
      vi.stubGlobal('getHeader', vi.fn(() => undefined))

      const mockEvent = {
        headers: {},
      }

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      expect(result).toMatchObject({
        statusCode: 500,
      })
    })

    it('should handle unknown event types', async () => {
      const unknownPayload = {
        type: 'unknown_type',
      }

      mockVerifySlackSignature.mockReturnValue(true)
      vi.stubGlobal('readRawBody', vi.fn().mockResolvedValue(JSON.stringify(unknownPayload)))
      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-slack-signature': 'v0=valid',
        },
      }

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      expect(result).toEqual({ ok: true })
    })

    it('should handle general errors', async () => {
      const mockEvent = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-slack-signature': 'v0=valid',
        },
      }

      mockVerifySlackSignature.mockReturnValue(true)
      vi.stubGlobal('readRawBody', vi.fn().mockResolvedValue('invalid json'))
      vi.stubGlobal('getHeader', vi.fn((e, name) => mockEvent.headers[name]))

      const handler = (await import('../events.post')).default
      const result = await handler(mockEvent as any)

      expect(result).toMatchObject({
        statusCode: 500,
      })
    })
  })
})
