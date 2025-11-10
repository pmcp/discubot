import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FigmaService } from '../figma'
import type { FigmaComment, FigmaFile } from '../figma'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch as any

// Mock useRuntimeConfig
vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({
    figmaApiKey: 'test-api-key',
  }),
}))

describe('FigmaService', () => {
  let service: FigmaService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new FigmaService('test-api-key-12345')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should throw error if no API key provided', () => {
      vi.mocked(useRuntimeConfig as any).mockReturnValueOnce({
        figmaApiKey: '',
      })

      expect(() => new FigmaService('')).toThrow('API key is required')
    })

    it('should accept API key from constructor', () => {
      expect(() => new FigmaService('my-key')).not.toThrow()
    })

    it('should use runtime config if no key provided', () => {
      expect(() => new FigmaService()).not.toThrow()
    })
  })

  describe('getComments', () => {
    const mockComments: FigmaComment[] = [
      {
        id: 'comment-1',
        file_key: 'abc123',
        parent_id: null,
        user: {
          id: 'user-1',
          handle: 'designer',
          img_url: 'https://example.com/avatar.jpg',
        },
        created_at: '2024-01-01T00:00:00Z',
        resolved_at: null,
        message: '@Figbot please create a task',
        reactions: [],
      },
      {
        id: 'comment-2',
        file_key: 'abc123',
        parent_id: 'comment-1',
        user: {
          id: 'user-2',
          handle: 'developer',
          img_url: 'https://example.com/avatar2.jpg',
        },
        created_at: '2024-01-01T00:05:00Z',
        resolved_at: null,
        message: 'Working on it!',
        reactions: [],
      },
    ]

    it('should fetch comments successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: mockComments }),
      })

      const comments = await service.getComments('abc123')

      expect(comments).toHaveLength(2)
      expect(comments[0]!.id).toBe('comment-1')
      expect(comments[1]!.id).toBe('comment-2')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/files/abc123/comments',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Figma-Token': 'test-api-key-12345',
          }),
        })
      )
    })

    it('should clean file key from full URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      })

      await service.getComments('https://www.figma.com/file/xyz789/My-Design')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/files/xyz789/comments',
        expect.any(Object)
      )
    })

    it('should handle pagination', async () => {
      // First page with cursor
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [mockComments[0]],
          cursor: 'next-page-cursor',
        }),
      })

      // Second page without cursor
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [mockComments[1]],
        }),
      })

      const comments = await service.getComments('abc123')

      expect(comments).toHaveLength(2)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://api.figma.com/v1/files/abc123/comments?cursor=next-page-cursor',
        expect.any(Object)
      )
    })

    it('should cache comments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: mockComments }),
      })

      // First call - should fetch
      await service.getComments('abc123')

      // Second call - should use cache
      const cached = await service.getComments('abc123')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(cached).toHaveLength(2)
    })

    it('should handle 404 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'File not found',
      })

      await expect(service.getComments('nonexistent')).rejects.toThrow(
        'Figma resource not found'
      )
    })

    it('should handle 403 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Access denied',
      })

      await expect(service.getComments('forbidden')).rejects.toThrow(
        'Figma API access denied'
      )
    })

    it('should handle rate limit error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      })

      await expect(service.getComments('rate-limited')).rejects.toThrow(
        'rate limit exceeded'
      )
    })
  })

  describe('getCommentThread', () => {
    const mockComments: FigmaComment[] = [
      {
        id: 'root-comment',
        file_key: 'abc123',
        parent_id: null,
        user: {
          id: 'user-1',
          handle: 'designer',
          img_url: null,
        },
        created_at: '2024-01-01T00:00:00Z',
        resolved_at: null,
        message: 'Root comment',
        reactions: [],
      },
      {
        id: 'reply-1',
        file_key: 'abc123',
        parent_id: 'root-comment',
        user: {
          id: 'user-2',
          handle: 'developer',
          img_url: null,
        },
        created_at: '2024-01-01T00:05:00Z',
        resolved_at: null,
        message: 'Reply 1',
        reactions: [],
      },
      {
        id: 'reply-2',
        file_key: 'abc123',
        parent_id: 'root-comment',
        user: {
          id: 'user-3',
          handle: 'pm',
          img_url: null,
        },
        created_at: '2024-01-01T00:10:00Z',
        resolved_at: null,
        message: 'Reply 2',
        reactions: [],
      },
    ]

    it('should get a complete thread', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: mockComments }),
      })

      const thread = await service.getCommentThread('abc123', 'reply-1')

      expect(thread).toHaveLength(3)
      expect(thread[0]!.id).toBe('root-comment')
      expect(thread[1]!.id).toBe('reply-1')
      expect(thread[2]!.id).toBe('reply-2')
    })

    it('should throw error if comment not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      })

      await expect(
        service.getCommentThread('abc123', 'nonexistent')
      ).rejects.toThrow('Comment nonexistent not found')
    })
  })

  describe('buildThread', () => {
    const mockComments: FigmaComment[] = [
      {
        id: 'root',
        file_key: 'abc123',
        parent_id: null,
        user: {
          id: 'user-1',
          handle: 'alice',
          img_url: null,
        },
        created_at: '2024-01-01T00:00:00Z',
        resolved_at: null,
        message: 'Initial comment',
        client_meta: {
          node_id: 'node-123',
        },
        reactions: [],
      },
      {
        id: 'reply',
        file_key: 'abc123',
        parent_id: 'root',
        user: {
          id: 'user-2',
          handle: 'bob',
          img_url: null,
        },
        created_at: '2024-01-01T00:05:00Z',
        resolved_at: null,
        message: 'Reply comment',
        reactions: [],
      },
    ]

    it('should build a discussion thread', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: mockComments }),
      })

      const thread = await service.buildThread('abc123', 'root')

      expect(thread.id).toBe('root')
      expect(thread.rootMessage.content).toBe('Initial comment')
      expect(thread.replies).toHaveLength(1)
      expect(thread.replies[0]!.content).toBe('Reply comment')
      expect(thread.participants).toEqual(['alice', 'bob'])
      expect(thread.metadata.fileKey).toBe('abc123')
      expect(thread.metadata.nodeId).toBe('node-123')
    })

    it('should throw if no comments found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      })

      await expect(
        service.buildThread('abc123', 'nonexistent')
      ).rejects.toThrow('No comments found')
    })
  })

  describe('postComment', () => {
    it('should post a comment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'new-comment-id',
            message: 'Test comment',
          },
        }),
      })

      const commentId = await service.postComment(
        'abc123',
        'parent-id',
        'Test comment'
      )

      expect(commentId).toBe('new-comment-id')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/files/abc123/comments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Figma-Token': 'test-api-key-12345',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            message: 'Test comment',
            comment_id: 'parent-id',
          }),
        })
      )
    })

    it('should retry on failure', async () => {
      // First attempt fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      })

      // Second attempt succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: { id: 'retry-success' },
        }),
      })

      const commentId = await service.postComment('abc123', 'parent', 'Retry test')

      expect(commentId).toBe('retry-success')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should invalidate cache after posting', async () => {
      // First, get comments to populate cache
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      })
      await service.getComments('abc123')

      // Post a comment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comment: { id: 'new' } }),
      })
      await service.postComment('abc123', 'parent', 'New comment')

      // Get comments again - should fetch, not use cache
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      })
      await service.getComments('abc123')

      // Should have called fetch 3 times (get, post, get again)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('addReaction', () => {
    it('should add a reaction successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const result = await service.addReaction('abc123', 'comment-id', '👍')

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/files/abc123/comments/comment-id/reactions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ emoji: '👍' }),
        })
      )
    })

    it('should return false on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      const result = await service.addReaction('abc123', 'bad-id', '👎')

      expect(result).toBe(false)
    })
  })

  describe('removeReaction', () => {
    it('should remove a reaction successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const result = await service.removeReaction('abc123', 'comment-id', '👍')

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/files/abc123/comments/comment-id/reactions?emoji=%F0%9F%91%8D',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })

    it('should return false on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      const result = await service.removeReaction('abc123', 'bad-id', '👎')

      expect(result).toBe(false)
    })
  })

  describe('updateReaction', () => {
    it('should update a reaction (remove + add)', async () => {
      // Remove old
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      // Add new
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const result = await service.updateReaction(
        'abc123',
        'comment-id',
        '👀',
        '✅'
      )

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('getFile', () => {
    const mockFile: FigmaFile = {
      name: 'Test Design',
      thumbnail_url: 'https://example.com/thumb.png',
      version: '1.0',
      last_modified: '2024-01-01T00:00:00Z',
    }

    it('should fetch file information', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFile,
      })

      const file = await service.getFile('abc123')

      expect(file.name).toBe('Test Design')
      expect(file.version).toBe('1.0')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/files/abc123',
        expect.any(Object)
      )
    })

    it('should retry on failure', async () => {
      // First attempt fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      })

      // Second attempt succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFile,
      })

      const file = await service.getFile('abc123')

      expect(file.name).toBe('Test Design')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('testConnection', () => {
    it('should return true for valid API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'user-123', handle: 'testuser' }),
      })

      const result = await service.testConnection()

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/me',
        expect.any(Object)
      )
    })

    it('should return false for invalid API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Invalid token',
      })

      const result = await service.testConnection()

      expect(result).toBe(false)
    })
  })

  describe('rate limiting', () => {
    it('should enforce rate limiting between requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [] }),
      })

      const startTime = Date.now()

      await service.getComments('file1')
      await service.getComments('file2')

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should have waited at least 200ms (rate limit delay)
      expect(duration).toBeGreaterThanOrEqual(200)
    })
  })

  describe('file key cleaning', () => {
    it('should handle various file key formats', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [] }),
      })

      const testCases = [
        {
          input: 'abc123',
          expected: 'abc123',
        },
        {
          input: 'https://www.figma.com/file/xyz789/Design',
          expected: 'xyz789',
        },
        {
          input: 'https://www.figma.com/board/jam456/Brainstorm',
          expected: 'jam456',
        },
        {
          input: 'abc123/extra/path?query=param',
          expected: 'abc123',
        },
      ]

      for (const testCase of testCases) {
        vi.clearAllMocks()
        await service.getComments(testCase.input)

        expect(mockFetch).toHaveBeenCalledWith(
          `https://api.figma.com/v1/files/${testCase.expected}/comments`,
          expect.any(Object)
        )
      }
    })
  })

  describe('circuit breaker', () => {
    it('should open circuit after multiple failures', async () => {
      // Fail 3 times (circuit breaker threshold)
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        })
      }

      // First 3 failures should attempt the request
      for (let i = 0; i < 3; i++) {
        await expect(service.getComments('fail')).rejects.toThrow()
      }

      // Circuit should now be open - next call should fail immediately
      await expect(service.getComments('fail')).rejects.toThrow('Circuit breaker is open')
    })
  })
})
