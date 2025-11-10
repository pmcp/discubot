import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AIService } from '../ai'
import type { DiscussionThread } from '../../adapters/base'

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  }
})

// Mock Nuxt runtime config
vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(() => ({
    anthropicApiKey: 'test-api-key',
  })),
}))

describe('AIService', () => {
  let aiService: AIService
  let mockAnthropicClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    aiService = new AIService('test-api-key')
    mockAnthropicClient = (aiService as any).client
  })

  afterEach(() => {
    aiService.destroy()
  })

  describe('constructor', () => {
    it('should throw error if no API key provided', () => {
      vi.mocked(useRuntimeConfig).mockReturnValue({ anthropicApiKey: '' } as any)

      expect(() => new AIService()).toThrow('Anthropic API key is required')
    })

    it('should accept API key from constructor', () => {
      const service = new AIService('constructor-key')
      expect(service).toBeInstanceOf(AIService)
      service.destroy()
    })

    it('should fallback to runtime config', () => {
      vi.mocked(useRuntimeConfig).mockReturnValue({ anthropicApiKey: 'runtime-key' } as any)
      const service = new AIService()
      expect(service).toBeInstanceOf(AIService)
      service.destroy()
    })
  })

  describe('generateSummary', () => {
    const mockThread: DiscussionThread = {
      id: 'thread-1',
      rootMessage: {
        id: 'msg-1',
        authorHandle: 'user1',
        content: 'This is the main issue we need to fix',
        timestamp: new Date('2025-01-01'),
      },
      replies: [
        {
          id: 'msg-2',
          authorHandle: 'user2',
          content: 'I agree, we should prioritize this',
          timestamp: new Date('2025-01-02'),
        },
      ],
      participants: ['user1', 'user2'],
      metadata: {},
    }

    it('should generate summary successfully', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Summary: This is a test summary\n\nKey Points:\n- Point 1\n- Point 2\n\nSuggested Actions:\n- Action 1',
        }],
      })

      const result = await aiService.generateSummary({ thread: mockThread })

      expect(result.summary).toContain('test summary')
      expect(result.keyPoints).toHaveLength(2)
      expect(result.suggestedActions).toHaveLength(1)
      expect(result.cached).toBe(false)
    })

    it('should return cached result on second call', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Summary: Cached summary',
        }],
      })

      const result1 = await aiService.generateSummary({ thread: mockThread })
      expect(result1.cached).toBe(false)

      const result2 = await aiService.generateSummary({ thread: mockThread })
      expect(result2.cached).toBe(true)
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(1)
    })

    it('should handle custom prompt', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Custom summary result',
        }],
      })

      await aiService.generateSummary({
        thread: mockThread,
        customPrompt: 'Custom instructions here',
      })

      const call = mockAnthropicClient.messages.create.mock.calls[0][0]
      expect(call.system).toContain('according to specific instructions')
    })

    it('should include fileName in context', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Summary with file context',
        }],
      })

      await aiService.generateSummary({
        thread: mockThread,
        fileName: 'test-file.fig',
      })

      const call = mockAnthropicClient.messages.create.mock.calls[0][0]
      expect(call.messages[0].content).toContain('test-file.fig')
    })

    it('should throw error for non-text response', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'image',
          data: 'base64...',
        }],
      })

      await expect(aiService.generateSummary({ thread: mockThread }))
        .rejects.toThrow('Unexpected response type from Claude')
    })

    it('should handle circuit breaker failures', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(new Error('API Error'))

      await expect(aiService.generateSummary({ thread: mockThread }))
        .rejects.toThrow('API Error')
    })
  })

  describe('detectTasks', () => {
    const validTaskResponse = {
      isMultiTask: true,
      tasks: [
        {
          id: 'task_123',
          title: 'Fix header',
          description: 'Fix the header styling',
          priority: 'high',
        },
        {
          id: 'task_456',
          title: 'Update footer',
          description: 'Update the footer content',
          priority: 'medium',
        },
      ],
      overallContext: 'UI improvements needed',
    }

    it('should detect multiple tasks', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify(validTaskResponse),
        }],
      })

      const result = await aiService.detectTasks({
        commentText: 'Fix the header and update the footer',
      })

      expect(result.isMultiTask).toBe(true)
      expect(result.tasks).toHaveLength(2)
      expect(result.tasks[0].title).toBe('Fix header')
      expect(result.tasks[1].priority).toBe('medium')
    })

    it('should cache task detection results', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify(validTaskResponse),
        }],
      })

      await aiService.detectTasks({ commentText: 'Same comment' })
      await aiService.detectTasks({ commentText: 'Same comment' })

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(1)
    })

    it('should include thread context if provided', async () => {
      const thread: DiscussionThread = {
        id: 'thread-1',
        rootMessage: {
          id: 'msg-1',
          authorHandle: 'user1',
          content: 'Context message',
          timestamp: new Date(),
        },
        replies: [],
        participants: ['user1'],
        metadata: {},
      }

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify(validTaskResponse),
        }],
      })

      await aiService.detectTasks({
        commentText: 'Task comment',
        threadContext: thread,
      })

      const call = mockAnthropicClient.messages.create.mock.calls[0][0]
      expect(call.messages[0].content).toContain('Context message')
    })

    it('should fallback to single task on parse error', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Invalid JSON response',
        }],
      })

      const result = await aiService.detectTasks({
        commentText: 'Fix something',
        fileName: 'test.fig',
      })

      expect(result.isMultiTask).toBe(false)
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].description).toBe('Fix something')
      expect(result.tasks[0].title).toContain('test.fig')
    })

    it('should generate task IDs if missing', async () => {
      const responseWithoutIds = {
        isMultiTask: true,
        tasks: [
          {
            title: 'Task 1',
            description: 'Description 1',
            priority: 'high',
          },
        ],
        overallContext: 'Context',
      }

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify(responseWithoutIds),
        }],
      })

      const result = await aiService.detectTasks({ commentText: 'Test' })

      expect(result.tasks[0].id).toMatch(/^task_/)
    })

    it('should normalize invalid priority values', async () => {
      const responseWithInvalidPriority = {
        isMultiTask: false,
        tasks: [
          {
            id: 'task_1',
            title: 'Task',
            description: 'Description',
            priority: 'urgent', // Invalid
          },
        ],
        overallContext: 'Context',
      }

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify(responseWithInvalidPriority),
        }],
      })

      const result = await aiService.detectTasks({ commentText: 'Test' })

      expect(result.tasks[0].priority).toBe('medium') // Defaulted
    })

    it('should ensure at least one task exists', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            isMultiTask: false,
            tasks: [],
            overallContext: 'Empty',
          }),
        }],
      })

      const result = await aiService.detectTasks({
        commentText: 'Original comment',
      })

      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].description).toBe('Original comment')
    })
  })

  describe('cache management', () => {
    it('should clear cache', async () => {
      const thread: DiscussionThread = {
        id: 'thread-1',
        rootMessage: {
          id: 'msg-1',
          authorHandle: 'user1',
          content: 'Test',
          timestamp: new Date(),
        },
        replies: [],
        participants: ['user1'],
        metadata: {},
      }

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Summary: Test summary',
        }],
      })

      await aiService.generateSummary({ thread })
      expect(aiService.getCacheStats().size).toBeGreaterThan(0)

      aiService.clearCache()
      expect(aiService.getCacheStats().size).toBe(0)
    })

    it('should provide cache statistics', async () => {
      const thread: DiscussionThread = {
        id: 'thread-1',
        rootMessage: {
          id: 'msg-1',
          authorHandle: 'user1',
          content: 'Test',
          timestamp: new Date(),
        },
        replies: [],
        participants: ['user1'],
        metadata: {},
      }

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Summary: Test',
        }],
      })

      await aiService.generateSummary({ thread })

      const stats = aiService.getCacheStats()
      expect(stats.size).toBe(1)
      expect(stats.maxSize).toBe(100)
      expect(stats.keys.length).toBe(1)
    })
  })
})
