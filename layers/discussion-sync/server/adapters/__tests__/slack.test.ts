import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SlackAdapter } from '../slack'
import type { SourceConfig } from '../base'

// Mock the SlackService
const mockGetThread = vi.fn()
const mockPostMessage = vi.fn()
const mockAddReaction = vi.fn()
const mockRemoveReaction = vi.fn()
const mockTestConnection = vi.fn()

vi.mock('../../services/slack', () => {
  return {
    SlackService: class MockSlackService {
      getThread = mockGetThread
      postMessage = mockPostMessage
      addReaction = mockAddReaction
      removeReaction = mockRemoveReaction
      testConnection = mockTestConnection
    },
  }
})

// Mock the encrypted config helper
vi.mock('../../utils/encryptedConfig', () => {
  return {
    getDecryptedApiToken: vi.fn().mockResolvedValue('xoxb-test-token-123'),
  }
})

describe('SlackAdapter', () => {
  let adapter: SlackAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new SlackAdapter()
  })

  describe('parseIncoming', () => {
    const mockSlackPayload = {
      token: 'test-token',
      team_id: 'T123ABC',
      api_app_id: 'A123',
      event: {
        type: 'app_mention',
        user: 'U123USER',
        text: '<@U123BOT> please help with this issue',
        ts: '1234567890.123456',
        channel: 'C123CHANNEL',
        event_ts: '1234567890.123456',
      },
      type: 'event_callback' as const,
      event_id: 'Ev123EVENT',
      event_time: 1234567890,
    }

    it('should parse app_mention event successfully', async () => {
      const result = await adapter.parseIncoming(mockSlackPayload)

      expect(result).toMatchObject({
        sourceType: 'slack',
        sourceThreadId: '1234567890.123456',
        teamId: 'T123ABC',
        authorHandle: 'U123USER',
        title: 'Slack message from <@U123USER>',
        content: 'please help with this issue',
      })

      expect(result.participants).toEqual(['U123USER'])
      expect(result.metadata.channelId).toBe('C123CHANNEL')
      expect(result.metadata.messageTs).toBe('1234567890.123456')
      expect(result.metadata.workspaceId).toBe('T123ABC')
    })

    it('should handle threaded messages', async () => {
      const threadedPayload = {
        ...mockSlackPayload,
        event: {
          ...mockSlackPayload.event,
          thread_ts: '1234567890.000000', // Parent message timestamp
          ts: '1234567891.123456', // Reply timestamp
        },
      }

      const result = await adapter.parseIncoming(threadedPayload)

      // Should use thread_ts as the sourceThreadId
      expect(result.sourceThreadId).toBe('1234567890.000000')
      expect(result.metadata.threadTs).toBe('1234567890.000000')
    })

    it('should clean bot mentions from message text', async () => {
      const payloadWithMention = {
        ...mockSlackPayload,
        event: {
          ...mockSlackPayload.event,
          text: '<@U123BOT> <@U456BOT> please review this',
        },
      }

      const result = await adapter.parseIncoming(payloadWithMention)

      expect(result.content).toBe('please review this')
    })

    it('should build correct Slack URL', async () => {
      const result = await adapter.parseIncoming(mockSlackPayload)

      expect(result.sourceUrl).toContain('slack.com/app_redirect')
      expect(result.sourceUrl).toContain('team=T123ABC')
      expect(result.sourceUrl).toContain('channel=C123CHANNEL')
    })

    it('should throw error for invalid event type', async () => {
      const invalidPayload = {
        ...mockSlackPayload,
        event: {
          ...mockSlackPayload.event,
          type: 'message' as any,
        },
      }

      await expect(adapter.parseIncoming(invalidPayload)).rejects.toThrow(
        'Invalid event type, expected app_mention'
      )
    })

    it('should throw error for missing channel', async () => {
      const invalidPayload = {
        ...mockSlackPayload,
        event: {
          ...mockSlackPayload.event,
          channel: '',
        },
      }

      await expect(adapter.parseIncoming(invalidPayload)).rejects.toThrow(
        'Missing required event fields'
      )
    })

    it('should throw error for missing timestamp', async () => {
      const invalidPayload = {
        ...mockSlackPayload,
        event: {
          ...mockSlackPayload.event,
          ts: '',
        },
      }

      await expect(adapter.parseIncoming(invalidPayload)).rejects.toThrow(
        'Missing required event fields'
      )
    })

    it('should throw error for missing team_id', async () => {
      const invalidPayload = {
        ...mockSlackPayload,
        team_id: '',
      }

      await expect(adapter.parseIncoming(invalidPayload)).rejects.toThrow(
        'No team_id found in payload'
      )
    })
  })

  describe('fetchThread', () => {
    const mockConfig: SourceConfig = {
      id: 'config-1',
      sourceId: 'slack',
      name: 'Test Slack',
      apiToken: 'encrypted-token',
      notionToken: 'notion-token',
      notionDatabaseId: 'db-123',
      aiEnabled: true,
      autoSync: true,
      postConfirmation: true,
      active: true,
      metadata: {
        channelId: 'C123CHANNEL',
      },
    }

    it('should fetch thread successfully', async () => {
      mockGetThread.mockResolvedValueOnce({
        channelId: 'C123CHANNEL',
        threadTs: '1234567890.123456',
        messages: [
          {
            type: 'message',
            user: 'U123',
            text: 'Original message',
            ts: '1234567890.123456',
          },
          {
            type: 'message',
            user: 'U456',
            text: 'Reply message',
            ts: '1234567891.123456',
          },
        ],
        hasMore: false,
        metadata: {
          channelName: 'general',
          channelType: 'public',
        },
      })

      const thread = await adapter.fetchThread('1234567890.123456', mockConfig)

      expect(thread).toBeDefined()
      expect(thread.id).toBe('1234567890.123456')
      expect(thread.rootMessage.content).toBe('Original message')
      expect(thread.replies).toHaveLength(1)
      expect(thread.replies[0].content).toBe('Reply message')
      expect(thread.participants).toEqual(['U123', 'U456'])
    })

    it('should throw error if channel ID missing', async () => {
      const configWithoutChannel = {
        ...mockConfig,
        metadata: {},
      }

      await expect(
        adapter.fetchThread('1234567890.123456', configWithoutChannel)
      ).rejects.toThrow('Channel ID not found in config metadata')
    })

    it('should throw error if no messages in thread', async () => {
      mockGetThread.mockResolvedValueOnce({
        channelId: 'C123CHANNEL',
        threadTs: '1234567890.123456',
        messages: [],
        hasMore: false,
        metadata: {},
      })

      await expect(
        adapter.fetchThread('1234567890.123456', mockConfig)
      ).rejects.toThrow('No messages found in thread')
    })
  })

  describe('postReply', () => {
    const mockConfig: SourceConfig = {
      id: 'config-1',
      sourceId: 'slack',
      name: 'Test Slack',
      apiToken: 'encrypted-token',
      notionToken: 'notion-token',
      notionDatabaseId: 'db-123',
      aiEnabled: true,
      autoSync: true,
      postConfirmation: true,
      active: true,
      metadata: {
        channelId: 'C123CHANNEL',
      },
    }

    it('should post reply successfully', async () => {
      mockPostMessage.mockResolvedValueOnce('1234567892.123456')

      const result = await adapter.postReply(
        '1234567890.123456',
        'Task created in Notion',
        mockConfig
      )

      expect(result).toBe(true)
      expect(mockPostMessage).toHaveBeenCalledWith(
        'C123CHANNEL',
        'Task created in Notion',
        '1234567890.123456'
      )
    })

    it('should skip reply if postConfirmation is disabled', async () => {
      const configWithoutConfirmation = {
        ...mockConfig,
        postConfirmation: false,
      }

      const result = await adapter.postReply(
        '1234567890.123456',
        'Task created',
        configWithoutConfirmation
      )

      expect(result).toBe(false)
      expect(mockPostMessage).not.toHaveBeenCalled()
    })

    it('should throw error if channel ID missing', async () => {
      const configWithoutChannel = {
        ...mockConfig,
        metadata: {},
      }

      await expect(
        adapter.postReply('1234567890.123456', 'Message', configWithoutChannel)
      ).rejects.toThrow('Channel ID not found in config metadata')
    })
  })

  describe('updateStatus', () => {
    const mockConfig: SourceConfig = {
      id: 'config-1',
      sourceId: 'slack',
      name: 'Test Slack',
      apiToken: 'encrypted-token',
      notionToken: 'notion-token',
      notionDatabaseId: 'db-123',
      aiEnabled: true,
      autoSync: true,
      postConfirmation: true,
      active: true,
      metadata: {
        channelId: 'C123CHANNEL',
        messageTs: '1234567890.123456',
      },
    }

    it('should update status to pending', async () => {
      mockRemoveReaction.mockResolvedValue(undefined)
      mockAddReaction.mockResolvedValue(undefined)

      const result = await adapter.updateStatus('1234567890.123456', 'pending', mockConfig)

      expect(result).toBe(true)
      expect(mockAddReaction).toHaveBeenCalledWith(
        'C123CHANNEL',
        '1234567890.123456',
        'clock'
      )
    })

    it('should update status to processing', async () => {
      mockRemoveReaction.mockResolvedValue(undefined)
      mockAddReaction.mockResolvedValue(undefined)

      const result = await adapter.updateStatus('1234567890.123456', 'processing', mockConfig)

      expect(result).toBe(true)
      expect(mockAddReaction).toHaveBeenCalledWith(
        'C123CHANNEL',
        '1234567890.123456',
        'hourglass_flowing_sand'
      )
    })

    it('should update status to completed', async () => {
      mockRemoveReaction.mockResolvedValue(undefined)
      mockAddReaction.mockResolvedValue(undefined)

      const result = await adapter.updateStatus('1234567890.123456', 'completed', mockConfig)

      expect(result).toBe(true)
      expect(mockAddReaction).toHaveBeenCalledWith(
        'C123CHANNEL',
        '1234567890.123456',
        'white_check_mark'
      )
    })

    it('should update status to failed', async () => {
      mockRemoveReaction.mockResolvedValue(undefined)
      mockAddReaction.mockResolvedValue(undefined)

      const result = await adapter.updateStatus('1234567890.123456', 'failed', mockConfig)

      expect(result).toBe(true)
      expect(mockAddReaction).toHaveBeenCalledWith(
        'C123CHANNEL',
        '1234567890.123456',
        'x'
      )
    })

    it('should remove previous status reactions', async () => {
      mockRemoveReaction.mockResolvedValue(undefined)
      mockAddReaction.mockResolvedValue(undefined)

      await adapter.updateStatus('1234567890.123456', 'completed', mockConfig)

      // Should try to remove other status emojis
      expect(mockRemoveReaction).toHaveBeenCalled()
    })

    it('should handle removeReaction errors gracefully', async () => {
      mockRemoveReaction.mockRejectedValue(new Error('Reaction not found'))
      mockAddReaction.mockResolvedValue(undefined)

      const result = await adapter.updateStatus('1234567890.123456', 'completed', mockConfig)

      // Should still succeed even if removeReaction fails
      expect(result).toBe(true)
      expect(mockAddReaction).toHaveBeenCalled()
    })

    it('should throw error if channel ID or message TS missing', async () => {
      const configWithoutMetadata = {
        ...mockConfig,
        metadata: {},
      }

      await expect(
        adapter.updateStatus('1234567890.123456', 'completed', configWithoutMetadata)
      ).rejects.toThrow('Channel ID or message TS not found in metadata')
    })
  })

  describe('validateConfig', () => {
    const validConfig: SourceConfig = {
      id: 'config-1',
      sourceId: 'slack',
      name: 'Test Slack',
      apiToken: 'xoxb-test-token',
      notionToken: 'notion-token',
      notionDatabaseId: 'db-123',
      aiEnabled: true,
      autoSync: true,
      postConfirmation: true,
      active: true,
      metadata: {},
    }

    it('should validate valid config', async () => {
      mockTestConnection.mockResolvedValueOnce(true)

      const result = await adapter.validateConfig(validConfig)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return error for missing apiToken', async () => {
      const invalidConfig = {
        ...validConfig,
        apiToken: undefined,
      }

      const result = await adapter.validateConfig(invalidConfig)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Slack bot token is required')
    })

    it('should return error for missing notionToken', async () => {
      const invalidConfig = {
        ...validConfig,
        notionToken: '',
      }

      const result = await adapter.validateConfig(invalidConfig)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Notion API token is required')
    })

    it('should return error for missing notionDatabaseId', async () => {
      const invalidConfig = {
        ...validConfig,
        notionDatabaseId: '',
      }

      const result = await adapter.validateConfig(invalidConfig)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Notion database ID is required')
    })

    it('should return error if connection test fails', async () => {
      mockTestConnection.mockResolvedValueOnce(false)

      const result = await adapter.validateConfig(validConfig)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Failed to connect to Slack API - check your bot token')
    })

    it('should handle connection test errors', async () => {
      mockTestConnection.mockRejectedValueOnce(new Error('Network error'))

      const result = await adapter.validateConfig(validConfig)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Slack API connection test failed')
    })
  })

  describe('testConnection', () => {
    const mockConfig: SourceConfig = {
      id: 'config-1',
      sourceId: 'slack',
      name: 'Test Slack',
      apiToken: 'xoxb-test-token',
      notionToken: 'notion-token',
      notionDatabaseId: 'db-123',
      aiEnabled: true,
      autoSync: true,
      postConfirmation: true,
      active: true,
      metadata: {},
    }

    it('should return true for successful connection', async () => {
      mockTestConnection.mockResolvedValueOnce(true)

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(true)
    })

    it('should return false for failed connection', async () => {
      mockTestConnection.mockResolvedValueOnce(false)

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      mockTestConnection.mockRejectedValueOnce(new Error('Connection failed'))

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(false)
    })
  })
})