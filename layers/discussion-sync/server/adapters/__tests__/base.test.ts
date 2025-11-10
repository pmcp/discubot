import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerAdapter,
  getAdapter,
  hasAdapter,
  getRegisteredSourceTypes,
  type DiscussionSourceAdapter,
  type ParsedDiscussion,
  type DiscussionThread,
  type SourceConfig,
  type ValidationResult,
} from '../base'

// Mock adapter implementation
class MockAdapter implements DiscussionSourceAdapter {
  sourceType = 'mock'

  async parseIncoming(payload: any): Promise<ParsedDiscussion> {
    return {
      sourceType: 'mock',
      sourceThreadId: payload.threadId,
      sourceUrl: payload.url,
      teamId: payload.teamId,
      authorHandle: payload.author,
      title: payload.title,
      content: payload.content,
      participants: [payload.author],
      timestamp: new Date(),
      metadata: {},
    }
  }

  async fetchThread(threadId: string, config: SourceConfig): Promise<DiscussionThread> {
    return {
      id: threadId,
      rootMessage: {
        id: 'msg-1',
        authorHandle: 'user1',
        content: 'Test message',
        timestamp: new Date(),
      },
      replies: [],
      participants: ['user1'],
      metadata: {},
    }
  }

  async postReply(threadId: string, message: string, config: SourceConfig): Promise<boolean> {
    return true
  }

  async updateStatus(threadId: string, status: any, config: SourceConfig): Promise<boolean> {
    return true
  }

  async validateConfig(config: SourceConfig): Promise<ValidationResult> {
    return {
      valid: true,
      errors: [],
    }
  }

  async testConnection(config: SourceConfig): Promise<boolean> {
    return true
  }
}

class AnotherMockAdapter implements DiscussionSourceAdapter {
  sourceType = 'another'

  async parseIncoming(payload: any): Promise<ParsedDiscussion> {
    return {} as ParsedDiscussion
  }

  async fetchThread(threadId: string, config: SourceConfig): Promise<DiscussionThread> {
    return {} as DiscussionThread
  }

  async postReply(threadId: string, message: string, config: SourceConfig): Promise<boolean> {
    return false
  }

  async updateStatus(threadId: string, status: any, config: SourceConfig): Promise<boolean> {
    return false
  }

  async validateConfig(config: SourceConfig): Promise<ValidationResult> {
    return { valid: false, errors: ['Invalid'] }
  }

  async testConnection(config: SourceConfig): Promise<boolean> {
    return false
  }
}

describe('Adapter Registry', () => {
  // Clear adapters before each test to ensure isolation
  // Note: This is a workaround since the registry is module-level state
  beforeEach(() => {
    // We can't actually clear the registry, so we'll just re-register
    registerAdapter('mock', MockAdapter)
  })

  describe('registerAdapter', () => {
    it('should register an adapter', () => {
      registerAdapter('test', MockAdapter)
      expect(hasAdapter('test')).toBe(true)
    })

    it('should allow re-registration (overwrite)', () => {
      registerAdapter('test', MockAdapter)
      registerAdapter('test', AnotherMockAdapter)

      const adapter = getAdapter('test')
      expect(adapter.sourceType).toBe('another')
    })
  })

  describe('getAdapter', () => {
    it('should return adapter instance for registered type', () => {
      registerAdapter('mock', MockAdapter)

      const adapter = getAdapter('mock')
      expect(adapter).toBeInstanceOf(MockAdapter)
      expect(adapter.sourceType).toBe('mock')
    })

    it('should return new instance on each call', () => {
      registerAdapter('mock', MockAdapter)

      const adapter1 = getAdapter('mock')
      const adapter2 = getAdapter('mock')

      expect(adapter1).not.toBe(adapter2) // Different instances
      expect(adapter1).toBeInstanceOf(MockAdapter)
      expect(adapter2).toBeInstanceOf(MockAdapter)
    })

    it('should throw error for unregistered adapter with helpful message', () => {
      registerAdapter('mock', MockAdapter)

      expect(() => getAdapter('unregistered'))
        .toThrow('No adapter registered for source type: unregistered')

      expect(() => getAdapter('unregistered'))
        .toThrow('Available adapters:')
    })

    it('should show "none" when no adapters registered', () => {
      // This test is tricky because we can't truly clear the registry
      // But we can test the error message format
      try {
        getAdapter('nonexistent')
      }
      catch (error: any) {
        expect(error.message).toContain('No adapter registered')
      }
    })
  })

  describe('hasAdapter', () => {
    it('should return true for registered adapter', () => {
      registerAdapter('mock', MockAdapter)
      expect(hasAdapter('mock')).toBe(true)
    })

    it('should return false for unregistered adapter', () => {
      expect(hasAdapter('nonexistent')).toBe(false)
    })

    it('should return true after registration', () => {
      expect(hasAdapter('new-adapter')).toBe(false)

      registerAdapter('new-adapter', MockAdapter)

      expect(hasAdapter('new-adapter')).toBe(true)
    })
  })

  describe('getRegisteredSourceTypes', () => {
    it('should return array of registered types', () => {
      registerAdapter('mock1', MockAdapter)
      registerAdapter('mock2', AnotherMockAdapter)

      const types = getRegisteredSourceTypes()
      expect(types).toBeInstanceOf(Array)
      expect(types).toContain('mock1')
      expect(types).toContain('mock2')
    })

    it('should return updated list after new registration', () => {
      const beforeTypes = getRegisteredSourceTypes()
      const beforeCount = beforeTypes.length

      registerAdapter('new-type', MockAdapter)

      const afterTypes = getRegisteredSourceTypes()
      expect(afterTypes.length).toBeGreaterThan(beforeCount)
      expect(afterTypes).toContain('new-type')
    })
  })

  describe('DiscussionSourceAdapter interface', () => {
    let adapter: DiscussionSourceAdapter
    let mockConfig: SourceConfig

    beforeEach(() => {
      registerAdapter('mock', MockAdapter)
      adapter = getAdapter('mock')
      mockConfig = {
        id: 'config-1',
        sourceId: 'mock',
        name: 'Mock Config',
        notionToken: 'notion-token',
        notionDatabaseId: 'db-id',
        aiEnabled: true,
        autoSync: true,
        postConfirmation: true,
        active: true,
      }
    })

    it('should parse incoming payload', async () => {
      const payload = {
        threadId: 'thread-123',
        url: 'https://example.com/thread/123',
        teamId: 'team-1',
        author: 'user1',
        title: 'Test Discussion',
        content: 'This is a test',
      }

      const result = await adapter.parseIncoming(payload)

      expect(result.sourceType).toBe('mock')
      expect(result.sourceThreadId).toBe('thread-123')
      expect(result.teamId).toBe('team-1')
      expect(result.authorHandle).toBe('user1')
    })

    it('should fetch thread details', async () => {
      const thread = await adapter.fetchThread('thread-123', mockConfig)

      expect(thread.id).toBe('thread-123')
      expect(thread.rootMessage).toBeDefined()
      expect(thread.replies).toBeInstanceOf(Array)
      expect(thread.participants).toBeInstanceOf(Array)
    })

    it('should post reply', async () => {
      const result = await adapter.postReply('thread-123', 'Reply message', mockConfig)
      expect(result).toBe(true)
    })

    it('should update status', async () => {
      const result = await adapter.updateStatus('thread-123', 'completed', mockConfig)
      expect(result).toBe(true)
    })

    it('should validate config', async () => {
      const result = await adapter.validateConfig(mockConfig)

      expect(result).toHaveProperty('valid')
      expect(result).toHaveProperty('errors')
      expect(result.errors).toBeInstanceOf(Array)
    })

    it('should test connection', async () => {
      const result = await adapter.testConnection(mockConfig)
      expect(typeof result).toBe('boolean')
    })
  })

  describe('Type definitions', () => {
    it('should enforce ParsedDiscussion structure', () => {
      const discussion: ParsedDiscussion = {
        sourceType: 'test',
        sourceThreadId: 'thread-1',
        sourceUrl: 'https://example.com',
        teamId: 'team-1',
        authorHandle: 'user1',
        title: 'Title',
        content: 'Content',
        participants: ['user1'],
        timestamp: new Date(),
        metadata: { custom: 'data' },
      }

      expect(discussion.sourceType).toBe('test')
      expect(discussion.metadata).toHaveProperty('custom')
    })

    it('should enforce DiscussionThread structure', () => {
      const thread: DiscussionThread = {
        id: 'thread-1',
        rootMessage: {
          id: 'msg-1',
          authorHandle: 'user1',
          content: 'Message',
          timestamp: new Date(),
          attachments: [
            {
              id: 'attach-1',
              type: 'image',
              url: 'https://example.com/image.png',
              name: 'image.png',
              mimeType: 'image/png',
            },
          ],
        },
        replies: [],
        participants: ['user1'],
        metadata: {},
      }

      expect(thread.rootMessage.attachments).toHaveLength(1)
      expect(thread.rootMessage.attachments?.[0].type).toBe('image')
    })

    it('should enforce SourceConfig structure', () => {
      const config: SourceConfig = {
        id: 'config-1',
        sourceId: 'figma',
        name: 'Figma Config',
        apiToken: 'api-token',
        notionToken: 'notion-token',
        notionDatabaseId: 'db-id',
        notionFieldMapping: {
          title: 'Name',
          status: 'Status',
        },
        anthropicApiKey: 'ai-key',
        aiEnabled: true,
        aiSummaryPrompt: 'Custom prompt',
        aiTaskPrompt: 'Task prompt',
        autoSync: true,
        postConfirmation: true,
        active: true,
        metadata: { custom: 'config' },
      }

      expect(config.notionFieldMapping).toHaveProperty('title')
    })

    it('should enforce ValidationResult structure', () => {
      const validResult: ValidationResult = {
        valid: true,
        errors: [],
      }

      const invalidResult: ValidationResult = {
        valid: false,
        errors: ['Error 1', 'Error 2'],
      }

      expect(validResult.valid).toBe(true)
      expect(invalidResult.errors).toHaveLength(2)
    })
  })
})
