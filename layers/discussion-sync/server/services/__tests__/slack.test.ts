import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SlackService } from '../slack'

// Mock fetch
global.fetch = vi.fn()

describe('SlackService', () => {
  const TEST_TOKEN = 'xoxb-test-token-123'
  let service: SlackService

  beforeEach(() => {
    service = new SlackService(TEST_TOKEN)
    vi.clearAllMocks()
  })

  afterEach(() => {
    service.clearCache()
  })

  describe('getThread', () => {
    const channelId = 'C123ABC'
    const threadTs = '1234567890.123456'

    it('should fetch thread messages successfully', async () => {
      // Mock API response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [
            {
              type: 'message',
              user: 'U123',
              text: 'Test message',
              ts: '1234567890.123456',
            },
          ],
        }),
      } as Response)

      // Mock channel info
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channel: {
            id: channelId,
            name: 'general',
            is_private: false,
          },
        }),
      } as Response)

      const thread = await service.getThread(channelId, threadTs)

      expect(thread).toBeDefined()
      expect(thread.messages).toHaveLength(1)
      expect(thread.channelId).toBe(channelId)
      expect(thread.threadTs).toBe(threadTs)
      expect(thread.metadata.channelName).toBe('general')
    })

    it('should throw error if API returns error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'channel_not_found',
        }),
      } as Response)

      await expect(service.getThread(channelId, threadTs)).rejects.toThrow(
        'Failed to fetch thread'
      )
    })

    it('should cache thread results', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [
            { type: 'message', user: 'U123', text: 'Test', ts: threadTs },
          ],
        }),
      } as Response)

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channel: { id: channelId, name: 'general', is_private: false },
        }),
      } as Response)

      // First call
      await service.getThread(channelId, threadTs)

      // Second call should use cache
      const thread2 = await service.getThread(channelId, threadTs)

      expect(thread2).toBeDefined()
      // Should only be called twice (once for thread, once for channel info)
      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('postMessage', () => {
    const channelId = 'C123ABC'
    const text = 'Test message'
    const threadTs = '1234567890.123456'

    it('should post message successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          ts: '1234567890.123457',
        }),
      } as Response)

      const messageTs = await service.postMessage(channelId, text, threadTs)

      expect(messageTs).toBe('1234567890.123457')
      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${TEST_TOKEN}`,
          }),
        })
      )
    })

    it('should throw error if post fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'channel_not_found',
        }),
      } as Response)

      await expect(service.postMessage(channelId, text)).rejects.toThrow(
        'Failed to post message'
      )
    })
  })

  describe('addReaction', () => {
    const channelId = 'C123ABC'
    const timestamp = '1234567890.123456'
    const emoji = 'white_check_mark'

    it('should add reaction successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
        }),
      } as Response)

      await expect(
        service.addReaction(channelId, timestamp, emoji)
      ).resolves.not.toThrow()

      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/reactions.add',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should not throw if reaction already exists', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'already_reacted',
        }),
      } as Response)

      await expect(
        service.addReaction(channelId, timestamp, emoji)
      ).resolves.not.toThrow()
    })

    it('should remove colons from emoji', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
        }),
      } as Response)

      await service.addReaction(channelId, timestamp, ':thumbsup:')

      const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
      expect(callBody.name).toBe('thumbsup')
    })
  })

  describe('removeReaction', () => {
    const channelId = 'C123ABC'
    const timestamp = '1234567890.123456'
    const emoji = 'x'

    it('should remove reaction successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
        }),
      } as Response)

      await expect(
        service.removeReaction(channelId, timestamp, emoji)
      ).resolves.not.toThrow()
    })

    it('should not throw if reaction doesn\'t exist', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'no_reaction',
        }),
      } as Response)

      await expect(
        service.removeReaction(channelId, timestamp, emoji)
      ).resolves.not.toThrow()
    })
  })

  describe('getUserInfo', () => {
    const userId = 'U123ABC'

    it('should fetch user info successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user: {
            id: userId,
            name: 'testuser',
            real_name: 'Test User',
            profile: {
              display_name: 'Test',
              real_name: 'Test User',
              email: 'test@example.com',
            },
          },
        }),
      } as Response)

      const user = await service.getUserInfo(userId)

      expect(user.id).toBe(userId)
      expect(user.name).toBe('testuser')
      expect(user.real_name).toBe('Test User')
    })

    it('should cache user info', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user: {
            id: userId,
            name: 'testuser',
            real_name: 'Test User',
            profile: {
              display_name: 'Test',
              real_name: 'Test User',
            },
          },
        }),
      } as Response)

      // First call
      await service.getUserInfo(userId)

      // Second call should use cache
      await service.getUserInfo(userId)

      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getChannelInfo', () => {
    const channelId = 'C123ABC'

    it('should fetch channel info successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channel: {
            id: channelId,
            name: 'general',
            is_private: false,
            is_archived: false,
            topic: { value: 'General discussion' },
            purpose: { value: 'For general stuff' },
          },
        }),
      } as Response)

      const channel = await service.getChannelInfo(channelId)

      expect(channel.id).toBe(channelId)
      expect(channel.name).toBe('general')
      expect(channel.is_private).toBe(false)
    })

    it('should cache channel info', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channel: {
            id: channelId,
            name: 'general',
            is_private: false,
            is_archived: false,
            topic: { value: '' },
            purpose: { value: '' },
          },
        }),
      } as Response)

      await service.getChannelInfo(channelId)
      await service.getChannelInfo(channelId)

      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('testConnection', () => {
    it('should return true if connection succeeds', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
        }),
      } as Response)

      const result = await service.testConnection()

      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/auth.test',
        expect.anything()
      )
    })

    it('should return false if connection fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'invalid_auth',
        }),
      } as Response)

      const result = await service.testConnection()

      expect(result).toBe(false)
    })

    it('should return false on network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await service.testConnection()

      expect(result).toBe(false)
    })
  })

  describe('circuit breaker', () => {
    it('should trip after threshold failures', async () => {
      // Mock 5 failures
      for (let i = 0; i < 5; i++) {
        vi.mocked(fetch).mockRejectedValueOnce(new Error('API error'))
      }

      // Try to fetch 5 times
      for (let i = 0; i < 5; i++) {
        try {
          await service.getThread('C123', '123.456')
        }
        catch {
          // Expected to fail
        }
      }

      // Circuit should be open
      expect(service.getCircuitState()).toBe('OPEN')

      // Next call should fail immediately without making request
      const fetchCountBefore = vi.mocked(fetch).mock.calls.length
      try {
        await service.getThread('C123', '123.456')
      }
      catch {
        // Expected
      }
      const fetchCountAfter = vi.mocked(fetch).mock.calls.length

      expect(fetchCountAfter).toBe(fetchCountBefore)
    })
  })

  describe('rate limiting', () => {
    it('should wait between requests', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response)

      const start = Date.now()

      // Make multiple requests
      await service.testConnection()
      await service.testConnection()

      const elapsed = Date.now() - start

      // Should have some delay (rate limited)
      expect(elapsed).toBeGreaterThan(0)
    })
  })

  describe('cache management', () => {
    it('should clear cache', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user: {
            id: 'U123',
            name: 'test',
            real_name: 'Test',
            profile: {},
          },
        }),
      } as Response)

      // Cache user info
      await service.getUserInfo('U123')

      // Clear cache
      service.clearCache()

      // Should make new request
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user: {
            id: 'U123',
            name: 'test',
            real_name: 'Test',
            profile: {},
          },
        }),
      } as Response)

      await service.getUserInfo('U123')

      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })
})
