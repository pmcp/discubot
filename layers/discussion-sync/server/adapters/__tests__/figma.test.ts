import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FigmaAdapter } from '../figma'
import type { SourceConfig, DiscussionThread, ThreadMessage } from '../base'

// Mock the FigmaService
vi.mock('../../services/figma', () => {
  return {
    FigmaService: vi.fn().mockImplementation(() => {
      return {
        buildThread: vi.fn(),
        postComment: vi.fn(),
        addReaction: vi.fn(),
        updateReaction: vi.fn(),
        testConnection: vi.fn(),
      }
    }),
  }
})

// Mock the EmailParser
vi.mock('../../utils/emailParser', () => {
  return {
    EmailParser: vi.fn().mockImplementation(() => {
      return {
        parse: vi.fn(),
      }
    }),
  }
})

describe('FigmaAdapter', () => {
  let adapter: FigmaAdapter
  let mockFigmaService: any
  let mockEmailParser: any

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new FigmaAdapter()

    // Get the mocked instances
    const { FigmaService } = require('../../services/figma')
    const { EmailParser } = require('../../utils/emailParser')

    mockFigmaService = new FigmaService()
    mockEmailParser = new EmailParser()

    // Replace the adapter's parser with our mock
    ;(adapter as any).emailParser = mockEmailParser
  })

  describe('parseIncoming', () => {
    const mockMailgunPayload = {
      'body-html': '<html><body><table><tr><td>@Figbot fix this</td></tr></table></body></html>',
      'From': 'Designer <designer@company.com>',
      'To': 'team-acme@comments.yourdomain.com',
      'Subject': 'Comment on Dashboard Design',
    }

    const mockEmailData = {
      commentText: '@Figbot fix this',
      fileKey: 'abc123xyz',
      commentId: 'comment-456',
      fileName: 'Dashboard Design',
      authorEmail: 'designer@company.com',
      authorName: 'Designer',
      figmaUrl: 'https://www.figma.com/file/abc123xyz/Dashboard',
      metadata: {},
    }

    it('should parse Mailgun payload successfully', async () => {
      mockEmailParser.parse.mockResolvedValueOnce({
        success: true,
        data: mockEmailData,
        strategy: 'StructuredContent',
      })

      const result = await adapter.parseIncoming(mockMailgunPayload)

      expect(result).toMatchObject({
        sourceType: 'figma',
        sourceThreadId: 'comment-456',
        sourceUrl: 'https://www.figma.com/file/abc123xyz/Dashboard',
        teamId: 'team-acme',
        authorHandle: 'designer@company.com',
        title: 'Comment on Dashboard Design',
        content: '@Figbot fix this',
      })

      expect(result.participants).toEqual(['designer@company.com'])
      expect(result.metadata.fileKey).toBe('abc123xyz')
      expect(result.metadata.commentId).toBe('comment-456')
    })

    it('should extract team slug from recipient email', async () => {
      mockEmailParser.parse.mockResolvedValueOnce({
        success: true,
        data: mockEmailData,
      })

      const result = await adapter.parseIncoming({
        ...mockMailgunPayload,
        To: 'my-awesome-team@comments.example.com',
      })

      expect(result.teamId).toBe('my-awesome-team')
    })

    it('should use default team if no recipient email', async () => {
      mockEmailParser.parse.mockResolvedValueOnce({
        success: true,
        data: mockEmailData,
      })

      const result = await adapter.parseIncoming({
        ...mockMailgunPayload,
        To: '',
      })

      expect(result.teamId).toBe('default')
    })

    it('should throw error if no HTML body', async () => {
      const payloadWithoutHtml = {
        From: 'test@example.com',
        To: 'team@example.com',
      }

      await expect(
        adapter.parseIncoming(payloadWithoutHtml)
      ).rejects.toThrow('No HTML body found')
    })

    it('should throw error if no sender email', async () => {
      const payloadWithoutFrom = {
        'body-html': '<html>test</html>',
        To: 'team@example.com',
      }

      await expect(
        adapter.parseIncoming(payloadWithoutFrom)
      ).rejects.toThrow('No sender email found')
    })

    it('should throw error if email parsing fails', async () => {
      mockEmailParser.parse.mockResolvedValueOnce({
        success: false,
        error: 'Could not extract file key',
      })

      await expect(
        adapter.parseIncoming(mockMailgunPayload)
      ).rejects.toThrow('Failed to parse email')
    })

    it('should use file key as thread ID if comment ID is missing', async () => {
      mockEmailParser.parse.mockResolvedValueOnce({
        success: true,
        data: {
          ...mockEmailData,
          commentId: '',
        },
      })

      const result = await adapter.parseIncoming(mockMailgunPayload)

      expect(result.sourceThreadId).toBe('abc123xyz')
    })

    it('should generate default title if subject is missing', async () => {
      mockEmailParser.parse.mockResolvedValueOnce({
        success: true,
        data: mockEmailData,
      })

      const result = await adapter.parseIncoming({
        ...mockMailgunPayload,
        Subject: '',
      })

      expect(result.title).toBe('Comment on Dashboard Design')
    })
  })

  describe('fetchThread', () => {
    const mockConfig: SourceConfig = {
      id: 'config-1',
      sourceId: 'source-1',
      name: 'Figma Config',
      apiToken: 'figma-token-123',
      notionToken: 'notion-token-123',
      notionDatabaseId: 'db-123',
      aiEnabled: true,
      autoSync: true,
      postConfirmation: true,
      active: true,
      metadata: {
        fileKey: 'abc123xyz',
      },
    }

    const mockThread: DiscussionThread = {
      id: 'root-comment',
      rootMessage: {
        id: 'root-comment',
        authorHandle: 'designer',
        content: '@Figbot please review',
        timestamp: new Date('2024-01-01'),
      },
      replies: [
        {
          id: 'reply-1',
          authorHandle: 'developer',
          content: 'On it!',
          timestamp: new Date('2024-01-01'),
        },
      ],
      participants: ['designer', 'developer'],
      metadata: {},
    }

    it('should fetch thread successfully', async () => {
      mockFigmaService.buildThread.mockResolvedValueOnce(mockThread)

      // Inject mock service
      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const result = await adapter.fetchThread('root-comment', mockConfig)

      expect(result).toEqual(mockThread)
      expect(mockFigmaService.buildThread).toHaveBeenCalledWith(
        'abc123xyz',
        'root-comment'
      )
    })

    it('should throw error if file key not in metadata', async () => {
      const configWithoutFileKey: SourceConfig = {
        ...mockConfig,
        metadata: {},
      }

      await expect(
        adapter.fetchThread('comment-1', configWithoutFileKey)
      ).rejects.toThrow('File key not found')
    })

    it('should propagate errors from Figma service', async () => {
      mockFigmaService.buildThread.mockRejectedValueOnce(
        new Error('Comment not found')
      )

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      await expect(
        adapter.fetchThread('nonexistent', mockConfig)
      ).rejects.toThrow('Comment not found')
    })
  })

  describe('postReply', () => {
    const mockConfig: SourceConfig = {
      id: 'config-1',
      sourceId: 'source-1',
      name: 'Figma Config',
      apiToken: 'figma-token-123',
      notionToken: 'notion-token-123',
      notionDatabaseId: 'db-123',
      aiEnabled: true,
      autoSync: true,
      postConfirmation: true,
      active: true,
      metadata: {
        fileKey: 'abc123xyz',
      },
    }

    it('should post reply successfully', async () => {
      mockFigmaService.postComment.mockResolvedValueOnce('new-comment-id')

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const result = await adapter.postReply(
        'thread-123',
        'Task created in Notion',
        mockConfig
      )

      expect(result).toBe(true)
      expect(mockFigmaService.postComment).toHaveBeenCalledWith(
        'abc123xyz',
        'thread-123',
        'Task created in Notion'
      )
    })

    it('should return false if file key not in metadata', async () => {
      const configWithoutFileKey: SourceConfig = {
        ...mockConfig,
        metadata: {},
      }

      const result = await adapter.postReply(
        'thread-123',
        'Test message',
        configWithoutFileKey
      )

      expect(result).toBe(false)
      expect(mockFigmaService.postComment).not.toHaveBeenCalled()
    })

    it('should return false on service error', async () => {
      mockFigmaService.postComment.mockRejectedValueOnce(
        new Error('API error')
      )

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const result = await adapter.postReply(
        'thread-123',
        'Test message',
        mockConfig
      )

      expect(result).toBe(false)
    })
  })

  describe('updateStatus', () => {
    const mockConfig: SourceConfig = {
      id: 'config-1',
      sourceId: 'source-1',
      name: 'Figma Config',
      apiToken: 'figma-token-123',
      notionToken: 'notion-token-123',
      notionDatabaseId: 'db-123',
      aiEnabled: true,
      autoSync: true,
      postConfirmation: true,
      active: true,
      metadata: {
        fileKey: 'abc123xyz',
      },
    }

    it('should add reaction for pending status', async () => {
      mockFigmaService.addReaction.mockResolvedValueOnce(true)

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const result = await adapter.updateStatus('comment-1', 'pending', mockConfig)

      expect(result).toBe(true)
      expect(mockFigmaService.addReaction).toHaveBeenCalledWith(
        'abc123xyz',
        'comment-1',
        '👀'
      )
    })

    it('should update reaction for completed status', async () => {
      mockFigmaService.updateReaction.mockResolvedValueOnce(true)

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const result = await adapter.updateStatus('comment-1', 'completed', mockConfig)

      expect(result).toBe(true)
      expect(mockFigmaService.updateReaction).toHaveBeenCalledWith(
        'abc123xyz',
        'comment-1',
        '👀',
        '✅'
      )
    })

    it('should use correct emoji for failed status', async () => {
      mockFigmaService.updateReaction.mockResolvedValueOnce(true)

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const result = await adapter.updateStatus('comment-1', 'failed', mockConfig)

      expect(result).toBe(true)
      expect(mockFigmaService.updateReaction).toHaveBeenCalledWith(
        'abc123xyz',
        'comment-1',
        '👀',
        '❌'
      )
    })

    it('should return false if file key not in metadata', async () => {
      const configWithoutFileKey: SourceConfig = {
        ...mockConfig,
        metadata: {},
      }

      const result = await adapter.updateStatus(
        'comment-1',
        'completed',
        configWithoutFileKey
      )

      expect(result).toBe(false)
    })

    it('should return false on service error', async () => {
      mockFigmaService.addReaction.mockRejectedValueOnce(
        new Error('API error')
      )

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const result = await adapter.updateStatus('comment-1', 'pending', mockConfig)

      expect(result).toBe(false)
    })
  })

  describe('validateConfig', () => {
    it('should validate a complete config successfully', async () => {
      mockFigmaService.testConnection.mockResolvedValueOnce(true)

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const config: SourceConfig = {
        id: 'config-1',
        sourceId: 'source-1',
        name: 'Figma Config',
        apiToken: 'figma-token-123',
        notionToken: 'notion-token-123',
        notionDatabaseId: 'db-123',
        aiEnabled: true,
        autoSync: true,
        postConfirmation: true,
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(mockFigmaService.testConnection).toHaveBeenCalled()
    })

    it('should fail validation if API token missing', async () => {
      const config: SourceConfig = {
        id: 'config-1',
        sourceId: 'source-1',
        name: 'Figma Config',
        apiToken: '',
        notionToken: 'notion-token-123',
        notionDatabaseId: 'db-123',
        aiEnabled: true,
        autoSync: true,
        postConfirmation: true,
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Figma API token is required')
    })

    it('should fail validation if Notion token missing', async () => {
      const config: SourceConfig = {
        id: 'config-1',
        sourceId: 'source-1',
        name: 'Figma Config',
        apiToken: 'figma-token-123',
        notionToken: '',
        notionDatabaseId: 'db-123',
        aiEnabled: true,
        autoSync: true,
        postConfirmation: true,
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Notion API token is required')
    })

    it('should fail validation if Notion database ID missing', async () => {
      const config: SourceConfig = {
        id: 'config-1',
        sourceId: 'source-1',
        name: 'Figma Config',
        apiToken: 'figma-token-123',
        notionToken: 'notion-token-123',
        notionDatabaseId: '',
        aiEnabled: true,
        autoSync: true,
        postConfirmation: true,
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Notion database ID is required')
    })

    it('should fail validation if connection test fails', async () => {
      mockFigmaService.testConnection.mockResolvedValueOnce(false)

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const config: SourceConfig = {
        id: 'config-1',
        sourceId: 'source-1',
        name: 'Figma Config',
        apiToken: 'figma-token-123',
        notionToken: 'notion-token-123',
        notionDatabaseId: 'db-123',
        aiEnabled: true,
        autoSync: true,
        postConfirmation: true,
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Figma API connection test failed')
    })

    it('should handle connection test errors', async () => {
      mockFigmaService.testConnection.mockRejectedValueOnce(
        new Error('Invalid API key')
      )

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const config: SourceConfig = {
        id: 'config-1',
        sourceId: 'source-1',
        name: 'Figma Config',
        apiToken: 'figma-token-123',
        notionToken: 'notion-token-123',
        notionDatabaseId: 'db-123',
        aiEnabled: true,
        autoSync: true,
        postConfirmation: true,
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid API key')
    })
  })

  describe('testConnection', () => {
    const mockConfig: SourceConfig = {
      id: 'config-1',
      sourceId: 'source-1',
      name: 'Figma Config',
      apiToken: 'figma-token-123',
      notionToken: 'notion-token-123',
      notionDatabaseId: 'db-123',
      aiEnabled: true,
      autoSync: true,
      postConfirmation: true,
      active: true,
    }

    it('should return true for successful connection', async () => {
      mockFigmaService.testConnection.mockResolvedValueOnce(true)

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(true)
    })

    it('should return false for failed connection', async () => {
      mockFigmaService.testConnection.mockResolvedValueOnce(false)

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      mockFigmaService.testConnection.mockRejectedValueOnce(
        new Error('Network error')
      )

      const { FigmaService } = require('../../services/figma')
      FigmaService.mockImplementationOnce(() => mockFigmaService)

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(false)
    })
  })

  describe('sourceType', () => {
    it('should have correct source type', () => {
      expect(adapter.sourceType).toBe('figma')
    })
  })
})
