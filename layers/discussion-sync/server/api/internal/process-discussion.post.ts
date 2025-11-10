/**
 * Internal API endpoint to process a discussion
 * This is called asynchronously after a webhook creates a discussion record
 *
 * POST /api/internal/process-discussion
 * Body: { discussionId: string, retry?: boolean }
 *
 * This endpoint is typically called from:
 * 1. Webhook handlers after creating discussion record
 * 2. Admin UI for manual reprocessing
 * 3. Scheduled jobs for retry failed discussions
 */

import { ProcessorService } from '../../services/processor'

export default defineEventHandler(async (event) => {
  try {
    // Parse request body
    const body = await readBody(event)

    if (!body.discussionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'discussionId is required',
      })
    }

    const { discussionId, retry = false } = body

    console.log('[API] Processing discussion:', {
      discussionId,
      retry,
    })

    // Create processor service
    const processor = new ProcessorService()

    try {
      // Process with or without retry
      const result = retry
        ? await processor.processWithRetry(discussionId)
        : await processor.processDiscussion(discussionId)

      console.log('[API] Processing completed:', {
        discussionId,
        success: result.success,
        pageIds: result.pageIds,
        processingTime: result.processingTime,
      })

      // Return result
      return {
        success: result.success,
        jobId: result.jobId,
        discussionId: result.discussionId,
        pageIds: result.pageIds,
        error: result.error,
        processingTime: result.processingTime,
      }
    }
    finally {
      // Cleanup
      processor.destroy()
    }
  }
  catch (error) {
    console.error('[API] Processing failed:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  }
})
