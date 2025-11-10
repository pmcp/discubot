import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

// Mock ProcessorService
vi.mock('../../services/processor', () => ({
  ProcessorService: vi.fn().mockImplementation(() => ({
    processDiscussion: vi.fn(),
    processWithRetry: vi.fn(),
    destroy: vi.fn(),
  })),
}))

// Mock Nuxt composables
vi.mock('#imports', () => ({
  defineEventHandler: (handler: any) => handler,
  readBody: vi.fn(),
  createError: vi.fn((error) => error),
  useDb: vi.fn(() => ({})),
  useRuntimeConfig: vi.fn(() => ({
    anthropicApiKey: 'test-key',
    notionApiKey: 'test-key',
  })),
}))

describe('POST /api/internal/process-discussion', () => {
  let handler: any
  let mockEvent: Partial<H3Event>
  let mockProcessor: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Import handler
    const module = await import('../internal/process-discussion.post')
    handler = module.default

    // Setup mock event
    mockEvent = {
      node: {
        req: {},
        res: {},
      },
    } as any

    // Setup mock processor
    const { ProcessorService } = await import('../../services/processor')
    mockProcessor = (ProcessorService as any).mock.results[0]?.value
  })

  it('should require discussionId in body', async () => {
    const { readBody, createError } = await import('#imports')
    ;(readBody as any).mockResolvedValueOnce({})

    await handler(mockEvent)

    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'discussionId is required',
      }),
    )
  })

  it('should process discussion successfully', async () => {
    const { readBody } = await import('#imports')
    const { ProcessorService } = await import('../../services/processor')

    const mockResult = {
      success: true,
      jobId: 'job-123',
      discussionId: 'discussion-123',
      pageIds: ['page-1', 'page-2'],
      processingTime: 1500,
    }

    ;(readBody as any).mockResolvedValueOnce({
      discussionId: 'discussion-123',
    })

    const processorInstance = {
      processDiscussion: vi.fn().mockResolvedValueOnce(mockResult),
      processWithRetry: vi.fn(),
      destroy: vi.fn(),
    }

    ;(ProcessorService as any).mockImplementationOnce(() => processorInstance)

    const result = await handler(mockEvent)

    expect(processorInstance.processDiscussion).toHaveBeenCalledWith('discussion-123')
    expect(result).toEqual(mockResult)
    expect(processorInstance.destroy).toHaveBeenCalled()
  })

  it('should use retry when specified', async () => {
    const { readBody } = await import('#imports')
    const { ProcessorService } = await import('../../services/processor')

    const mockResult = {
      success: true,
      jobId: 'job-123',
      discussionId: 'discussion-123',
      pageIds: ['page-1'],
      processingTime: 2500,
    }

    ;(readBody as any).mockResolvedValueOnce({
      discussionId: 'discussion-123',
      retry: true,
    })

    const processorInstance = {
      processDiscussion: vi.fn(),
      processWithRetry: vi.fn().mockResolvedValueOnce(mockResult),
      destroy: vi.fn(),
    }

    ;(ProcessorService as any).mockImplementationOnce(() => processorInstance)

    const result = await handler(mockEvent)

    expect(processorInstance.processWithRetry).toHaveBeenCalledWith('discussion-123')
    expect(processorInstance.processDiscussion).not.toHaveBeenCalled()
    expect(result).toEqual(mockResult)
  })

  it('should handle processing errors', async () => {
    const { readBody, createError } = await import('#imports')
    const { ProcessorService } = await import('../../services/processor')

    ;(readBody as any).mockResolvedValueOnce({
      discussionId: 'discussion-123',
    })

    const processorInstance = {
      processDiscussion: vi.fn().mockRejectedValueOnce(new Error('Processing failed')),
      processWithRetry: vi.fn(),
      destroy: vi.fn(),
    }

    ;(ProcessorService as any).mockImplementationOnce(() => processorInstance)

    await handler(mockEvent)

    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Processing failed',
      }),
    )

    expect(processorInstance.destroy).toHaveBeenCalled()
  })

  it('should cleanup processor even on error', async () => {
    const { readBody } = await import('#imports')
    const { ProcessorService } = await import('../../services/processor')

    ;(readBody as any).mockResolvedValueOnce({
      discussionId: 'discussion-123',
    })

    const processorInstance = {
      processDiscussion: vi.fn().mockRejectedValueOnce(new Error('Test error')),
      processWithRetry: vi.fn(),
      destroy: vi.fn(),
    }

    ;(ProcessorService as any).mockImplementationOnce(() => processorInstance)

    try {
      await handler(mockEvent)
    }
    catch {
      // Expected to throw
    }

    expect(processorInstance.destroy).toHaveBeenCalled()
  })
})
