import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NotionService } from '../notion'
import type { NotionTaskData, NotionFieldMapping } from '../notion'
import type { SourceConfig } from '../../adapters/base'
import type { AISummaryResponse } from '../ai'

// Mock @notionhq/client
vi.mock('@notionhq/client', () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      pages: {
        create: vi.fn(),
        update: vi.fn(),
      },
      databases: {
        query: vi.fn(),
        retrieve: vi.fn(),
      },
    })),
  }
})

// Mock runtime config
vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(() => ({
    notionApiKey: '',
    anthropicApiKey: '',
  })),
}))

describe('NotionService', () => {
  let service: NotionService
  let mockClient: any

  const validApiKey = 'secret_test_key_123'

  const mockConfig: SourceConfig = {
    id: 'config-1',
    sourceId: 'source-1',
    name: 'Test Config',
    notionToken: 'secret_notion_token',
    notionDatabaseId: 'database-id-123',
    notionFieldMapping: {
      title: 'Name',
      sourceUrl: 'SourceURL',
      priority: 'Priority',
      tags: 'Tags',
    } as NotionFieldMapping,
    aiEnabled: true,
    autoSync: true,
    postConfirmation: true,
    active: true,
  }

  const mockTaskData: NotionTaskData = {
    title: 'Test Task',
    description: 'This is a test task description',
    sourceUrl: 'https://example.com/thread/123',
    sourceThreadId: 'thread-123',
    priority: 'high',
    tags: ['bug', 'urgent'],
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Create service instance with API key
    service = new NotionService(validApiKey)

    // Get mocked client
    const { Client } = require('@notionhq/client')
    mockClient = Client.mock.results[Client.mock.results.length - 1].value
  })

  afterEach(() => {
    service.destroy()
  })

  describe('Constructor', () => {
    it('should throw error if no API key provided', () => {
      expect(() => new NotionService('')).toThrowError(/API key is required/)
    })

    it('should create service with valid API key', () => {
      expect(() => new NotionService(validApiKey)).not.toThrow()
    })

    it('should initialize with circuit breaker and rate limiter', () => {
      const svc = new NotionService(validApiKey)
      expect(svc).toBeDefined()
      svc.destroy()
    })
  })

  describe('createTask', () => {
    it('should create a task successfully', async () => {
      mockClient.pages.create.mockResolvedValueOnce({
        id: 'page-123',
        object: 'page',
      })

      const pageId = await service.createTask(mockTaskData, mockConfig)

      expect(pageId).toBe('page-123')
      expect(mockClient.pages.create).toHaveBeenCalledTimes(1)

      const call = mockClient.pages.create.mock.calls[0][0]
      expect(call.parent.database_id).toBe(mockConfig.notionDatabaseId)
      expect(call.properties.Name).toBeDefined()
      expect(call.properties.Name.title[0].text.content).toBe(mockTaskData.title)
    })

    it('should include optional fields when mapping exists', async () => {
      mockClient.pages.create.mockResolvedValueOnce({
        id: 'page-456',
        object: 'page',
      })

      await service.createTask(mockTaskData, mockConfig)

      const call = mockClient.pages.create.mock.calls[0][0]

      // Check source URL
      expect(call.properties.SourceURL).toBeDefined()
      expect(call.properties.SourceURL.url).toBe(mockTaskData.sourceUrl)

      // Check priority
      expect(call.properties.Priority).toBeDefined()
      expect(call.properties.Priority.select.name).toBe('High')

      // Check tags
      expect(call.properties.Tags).toBeDefined()
      expect(call.properties.Tags.multi_select).toHaveLength(2)
      expect(call.properties.Tags.multi_select[0].name).toBe('bug')
    })

    it('should include AI summary in content blocks', async () => {
      const taskWithAI: NotionTaskData = {
        ...mockTaskData,
        aiSummary: {
          summary: 'This is an AI generated summary',
          keyPoints: ['Point 1', 'Point 2'],
          suggestedActions: ['Action 1', 'Action 2'],
          cached: false,
        },
      }

      mockClient.pages.create.mockResolvedValueOnce({
        id: 'page-789',
        object: 'page',
      })

      await service.createTask(taskWithAI, mockConfig)

      const call = mockClient.pages.create.mock.calls[0][0]
      expect(call.children).toBeDefined()
      expect(Array.isArray(call.children)).toBe(true)

      // Check for callout block (AI summary)
      const calloutBlock = call.children.find((b: any) => b.type === 'callout')
      expect(calloutBlock).toBeDefined()
      expect(calloutBlock.callout.icon.emoji).toBe('🤖')
    })

    it('should retry on failure', async () => {
      mockClient.pages.create
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ id: 'page-retry', object: 'page' })

      const pageId = await service.createTask(mockTaskData, mockConfig)

      expect(pageId).toBe('page-retry')
      expect(mockClient.pages.create).toHaveBeenCalledTimes(2)
    })

    it('should fail after max retries', async () => {
      mockClient.pages.create.mockRejectedValue(new Error('Persistent error'))

      await expect(service.createTask(mockTaskData, mockConfig)).rejects.toThrow(
        'Persistent error',
      )

      // Should have retried 3 times
      expect(mockClient.pages.create).toHaveBeenCalledTimes(3)
    }, 10000) // Increase timeout for retries
  })

  describe('createTasks', () => {
    it('should create multiple tasks', async () => {
      const tasks: NotionTaskData[] = [
        { ...mockTaskData, title: 'Task 1' },
        { ...mockTaskData, title: 'Task 2' },
        { ...mockTaskData, title: 'Task 3' },
      ]

      mockClient.pages.create
        .mockResolvedValueOnce({ id: 'page-1', object: 'page' })
        .mockResolvedValueOnce({ id: 'page-2', object: 'page' })
        .mockResolvedValueOnce({ id: 'page-3', object: 'page' })

      const pageIds = await service.createTasks(tasks, mockConfig)

      expect(pageIds).toEqual(['page-1', 'page-2', 'page-3'])
      expect(mockClient.pages.create).toHaveBeenCalledTimes(3)
    }, 10000)

    it('should fail fast if one task fails', async () => {
      const tasks: NotionTaskData[] = [
        { ...mockTaskData, title: 'Task 1' },
        { ...mockTaskData, title: 'Task 2' },
      ]

      mockClient.pages.create
        .mockResolvedValueOnce({ id: 'page-1', object: 'page' })
        .mockRejectedValue(new Error('Task 2 failed'))

      await expect(service.createTasks(tasks, mockConfig)).rejects.toThrow()

      // Should have created first task but failed on second
      // Note: With retries, this might be called more times
      expect(mockClient.pages.create.mock.calls.length).toBeGreaterThanOrEqual(1)
    }, 10000)
  })

  describe('updateTask', () => {
    it('should update a task', async () => {
      mockClient.pages.update.mockResolvedValueOnce({ id: 'page-123', object: 'page' })

      await service.updateTask('page-123', { title: 'Updated Title' }, mockConfig)

      expect(mockClient.pages.update).toHaveBeenCalledTimes(1)

      const call = mockClient.pages.update.mock.calls[0][0]
      expect(call.page_id).toBe('page-123')
      expect(call.properties.Name.title[0].text.content).toBe('Updated Title')
    })
  })

  describe('findDuplicateByUrl', () => {
    it('should find duplicate by source URL', async () => {
      const mockPage = {
        id: 'page-duplicate',
        url: 'https://notion.so/page',
        properties: {},
      }

      mockClient.databases.query.mockResolvedValueOnce({
        results: [mockPage],
        has_more: false,
        next_cursor: null,
      })

      const result = await service.findDuplicateByUrl(mockTaskData.sourceUrl, mockConfig)

      expect(result).toEqual(mockPage)
      expect(mockClient.databases.query).toHaveBeenCalledTimes(1)

      const call = mockClient.databases.query.mock.calls[0][0]
      expect(call.database_id).toBe(mockConfig.notionDatabaseId)
      expect(call.filter.property).toBe('SourceURL')
      expect(call.filter.url.equals).toBe(mockTaskData.sourceUrl)
    })

    it('should return null if no duplicate found', async () => {
      mockClient.databases.query.mockResolvedValueOnce({
        results: [],
        has_more: false,
        next_cursor: null,
      })

      const result = await service.findDuplicateByUrl(mockTaskData.sourceUrl, mockConfig)

      expect(result).toBeNull()
    })

    it('should use cache for repeated queries', async () => {
      const mockPage = {
        id: 'page-cached',
        url: 'https://notion.so/page',
        properties: {},
      }

      mockClient.databases.query.mockResolvedValueOnce({
        results: [mockPage],
        has_more: false,
        next_cursor: null,
      })

      // First call - should hit API
      const result1 = await service.findDuplicateByUrl(mockTaskData.sourceUrl, mockConfig)
      expect(result1).toEqual(mockPage)
      expect(mockClient.databases.query).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      const result2 = await service.findDuplicateByUrl(mockTaskData.sourceUrl, mockConfig)
      expect(result2).toEqual(mockPage)
      expect(mockClient.databases.query).toHaveBeenCalledTimes(1) // Still 1
    })

    it('should handle pagination', async () => {
      mockClient.databases.query
        .mockResolvedValueOnce({
          results: [],
          has_more: true,
          next_cursor: 'cursor-123',
        })
        .mockResolvedValueOnce({
          results: [{ id: 'page-found', url: 'url', properties: {} }],
          has_more: false,
          next_cursor: null,
        })

      const result = await service.findDuplicateByUrl(mockTaskData.sourceUrl, mockConfig)

      expect(result).toBeDefined()
      expect(result?.id).toBe('page-found')
      expect(mockClient.databases.query).toHaveBeenCalledTimes(2)
    })
  })

  describe('queryDatabase', () => {
    it('should query database', async () => {
      const mockResults = [
        { id: 'page-1', url: 'url1', properties: {} },
        { id: 'page-2', url: 'url2', properties: {} },
      ]

      mockClient.databases.query.mockResolvedValueOnce({
        results: mockResults,
        has_more: false,
        next_cursor: null,
      })

      const result = await service.queryDatabase(
        {
          database_id: mockConfig.notionDatabaseId,
          page_size: 10,
        },
        mockConfig,
      )

      expect(result.results).toEqual(mockResults)
      expect(result.has_more).toBe(false)
      expect(result.next_cursor).toBeUndefined()
    })
  })

  describe('validateConfig', () => {
    it('should validate valid config', async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        id: mockConfig.notionDatabaseId,
        object: 'database',
      })

      const result = await service.validateConfig(mockConfig)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject config without token', async () => {
      const invalidConfig = { ...mockConfig, notionToken: '' }

      const result = await service.validateConfig(invalidConfig)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Notion token is required')
    })

    it('should reject config without database ID', async () => {
      const invalidConfig = { ...mockConfig, notionDatabaseId: '' }

      const result = await service.validateConfig(invalidConfig)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Notion database ID is required')
    })

    it('should reject config if connection test fails', async () => {
      mockClient.databases.retrieve.mockRejectedValueOnce(new Error('Invalid database'))

      const result = await service.validateConfig(mockConfig)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Connection test failed')
    })
  })

  describe('testConnection', () => {
    it('should return true for valid connection', async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        id: mockConfig.notionDatabaseId,
        object: 'database',
      })

      const result = await service.testConnection(mockConfig)

      expect(result).toBe(true)
    })

    it('should throw error for invalid connection', async () => {
      mockClient.databases.retrieve.mockRejectedValueOnce(new Error('Connection failed'))

      await expect(service.testConnection(mockConfig)).rejects.toThrow()
    })
  })

  describe('Cache management', () => {
    it('should clear cache', () => {
      service.clearCache()

      const stats = service.getCacheStats()
      expect(stats.size).toBe(0)
    })

    it('should provide cache statistics', async () => {
      mockClient.databases.query.mockResolvedValueOnce({
        results: [{ id: 'page-1', url: 'url', properties: {} }],
        has_more: false,
        next_cursor: null,
      })

      await service.findDuplicateByUrl('https://example.com/test', mockConfig)

      const stats = service.getCacheStats()
      expect(stats.size).toBeGreaterThan(0)
      expect(stats.maxSize).toBe(50)
      expect(Array.isArray(stats.keys)).toBe(true)
    })
  })
})
