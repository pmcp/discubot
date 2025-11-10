/**
 * Figma Service - Interact with Figma REST API
 *
 * Provides methods to fetch comments, post replies, add reactions, and manage Figma files.
 * All improvements from Phase 3 briefing implemented.
 */

import { CircuitBreaker } from '../utils/circuitBreaker'
import { LRUCache } from '../utils/lru-cache'
import type { DiscussionThread, ThreadMessage } from '../adapters/base'

// ============================================
// CONSTANTS
// ============================================

const FIGMA_CONFIG = {
  API_BASE_URL: 'https://api.figma.com/v1',
  RATE_LIMIT_DELAY_MS: 200,
  CIRCUIT_BREAKER_THRESHOLD: 3,
  CIRCUIT_BREAKER_TIMEOUT_MS: 30000,
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 1000,
  CACHE_TTL_MS: 300000, // 5 minutes
  CACHE_MAX_SIZE: 50,
  PROCESSING_EMOJI: '👀',
  SUCCESS_EMOJI: '✅',
  ERROR_EMOJI: '❌',
} as const

// ============================================
// TYPES
// ============================================

export interface FigmaComment {
  id: string
  file_key: string
  parent_id: string | null
  user: {
    id: string
    handle: string
    img_url: string | null
    email?: string | null
  }
  created_at: string
  resolved_at: string | null
  message: string
  client_meta?: {
    node_id?: string
    node_offset?: { x: number; y: number }
  }
  reactions?: Array<{
    emoji: string
    user_ids: string[]
  }>
}

export interface FigmaFile {
  name: string
  thumbnail_url: string
  version: string
  last_modified: string
  document?: unknown
  components?: unknown
  styles?: unknown
}

export interface FigmaCommentsResponse {
  comments: FigmaComment[]
  cursor?: string
}

// ============================================
// FIGMA SERVICE
// ============================================

export class FigmaService {
  private readonly apiKey: string
  private readonly circuitBreaker: CircuitBreaker
  private readonly commentCache: LRUCache<FigmaComment[]>
  private lastRequestTime = 0

  constructor(apiKey?: string) {
    const key = apiKey || useRuntimeConfig().figmaApiKey || ''

    if (!key || key.trim() === '') {
      throw new Error(
        '[Figma Service] API key is required. ' +
        'Set FIGMA_API_KEY environment variable or pass apiKey to constructor.'
      )
    }

    this.apiKey = key

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: FIGMA_CONFIG.CIRCUIT_BREAKER_THRESHOLD,
      resetTimeout: FIGMA_CONFIG.CIRCUIT_BREAKER_TIMEOUT_MS,
      onOpen: () => console.error('[Figma Service] Circuit breaker opened'),
      onClose: () => console.log('[Figma Service] Circuit breaker closed'),
    })

    this.commentCache = new LRUCache<FigmaComment[]>({
      maxSize: FIGMA_CONFIG.CACHE_MAX_SIZE,
      ttl: FIGMA_CONFIG.CACHE_TTL_MS,
    })
  }

  /**
   * Get all comments for a specific file (with pagination)
   */
  async getComments(fileKey: string): Promise<FigmaComment[]> {
    const cleanFileKey = this.cleanFileKey(fileKey)
    const cacheKey = `comments:${cleanFileKey}`

    // Check cache first
    const cached = this.commentCache.get(cacheKey)
    if (cached) {
      console.log('[Figma Service] Cache hit:', cacheKey)
      return cached
    }

    console.log('[Figma Service] Cache miss, fetching from API:', cacheKey)

    // Fetch with pagination
    let allComments: FigmaComment[] = []
    let cursor: string | undefined

    do {
      const response = await this.fetchCommentsPage(cleanFileKey, cursor)
      allComments.push(...response.comments)
      cursor = response.cursor
    } while (cursor)

    // Cache the result
    this.commentCache.set(cacheKey, allComments)

    console.log(`[Figma Service] Fetched ${allComments.length} comments for file ${cleanFileKey}`)
    return allComments
  }

  /**
   * Get a specific comment thread
   */
  async getCommentThread(fileKey: string, commentId: string): Promise<FigmaComment[]> {
    const allComments = await this.getComments(fileKey)

    // Find the root comment
    const rootComment = this.findRootComment(allComments, commentId)

    if (!rootComment) {
      throw new Error(`[Figma Service] Comment ${commentId} not found in file ${fileKey}`)
    }

    // Get all replies to the root comment
    const thread = [rootComment]
    const replies = this.getReplies(allComments, rootComment.id)
    thread.push(...replies)

    return thread
  }

  /**
   * Build a discussion thread from comment ID
   */
  async buildThread(fileKey: string, commentId: string): Promise<DiscussionThread> {
    const comments = await this.getCommentThread(fileKey, commentId)

    if (comments.length === 0) {
      throw new Error(`[Figma Service] No comments found for thread ${commentId}`)
    }

    const rootComment = comments[0]!
    const replies = comments.slice(1)

    // Convert to ThreadMessage format
    const rootMessage: ThreadMessage = {
      id: rootComment.id,
      authorHandle: rootComment.user.handle,
      content: rootComment.message,
      timestamp: new Date(rootComment.created_at),
      attachments: [],
    }

    const replyMessages: ThreadMessage[] = replies.map(comment => ({
      id: comment.id,
      authorHandle: comment.user.handle,
      content: comment.message,
      timestamp: new Date(comment.created_at),
      attachments: [],
    }))

    // Extract all unique participants
    const participants = Array.from(
      new Set(comments.map(c => c.user.handle))
    )

    return {
      id: rootComment.id,
      rootMessage,
      replies: replyMessages,
      participants,
      metadata: {
        fileKey,
        resolved: rootComment.resolved_at !== null,
        nodeId: rootComment.client_meta?.node_id,
      },
    }
  }

  /**
   * Post a comment to a file
   */
  async postComment(
    fileKey: string,
    commentId: string,
    message: string
  ): Promise<string> {
    const cleanFileKey = this.cleanFileKey(fileKey)

    return this.retryWithBackoff(async () => {
      console.log('[Figma Service] Posting comment:', {
        fileKey: cleanFileKey,
        parentCommentId: commentId,
        messageLength: message.length,
      })

      const response = await this.rateLimitedFetch<{ comment: FigmaComment }>(
        `${FIGMA_CONFIG.API_BASE_URL}/files/${cleanFileKey}/comments`,
        {
          method: 'POST',
          headers: {
            'X-Figma-Token': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            comment_id: commentId,
          }),
        }
      )

      const newCommentId = response.comment.id

      console.log('[Figma Service] Comment posted successfully:', newCommentId)

      // Invalidate cache for this file
      this.commentCache.delete(`comments:${cleanFileKey}`)

      return newCommentId
    })
  }

  /**
   * Add a reaction emoji to a comment
   */
  async addReaction(
    fileKey: string,
    commentId: string,
    emoji: string
  ): Promise<boolean> {
    const cleanFileKey = this.cleanFileKey(fileKey)

    try {
      console.log('[Figma Service] Adding reaction:', {
        fileKey: cleanFileKey,
        commentId,
        emoji,
      })

      await this.rateLimitedFetch(
        `${FIGMA_CONFIG.API_BASE_URL}/files/${cleanFileKey}/comments/${commentId}/reactions`,
        {
          method: 'POST',
          headers: {
            'X-Figma-Token': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji }),
        }
      )

      console.log('[Figma Service] Reaction added successfully')

      // Invalidate cache
      this.commentCache.delete(`comments:${cleanFileKey}`)

      return true
    }
    catch (error) {
      console.error('[Figma Service] Failed to add reaction:', error)
      return false
    }
  }

  /**
   * Remove a reaction emoji from a comment
   */
  async removeReaction(
    fileKey: string,
    commentId: string,
    emoji: string
  ): Promise<boolean> {
    const cleanFileKey = this.cleanFileKey(fileKey)

    try {
      console.log('[Figma Service] Removing reaction:', {
        fileKey: cleanFileKey,
        commentId,
        emoji,
      })

      await this.rateLimitedFetch(
        `${FIGMA_CONFIG.API_BASE_URL}/files/${cleanFileKey}/comments/${commentId}/reactions?emoji=${encodeURIComponent(emoji)}`,
        {
          method: 'DELETE',
          headers: {
            'X-Figma-Token': this.apiKey,
          },
        }
      )

      console.log('[Figma Service] Reaction removed successfully')

      // Invalidate cache
      this.commentCache.delete(`comments:${cleanFileKey}`)

      return true
    }
    catch (error) {
      console.error('[Figma Service] Failed to remove reaction:', error)
      return false
    }
  }

  /**
   * Update reaction emoji (remove old, add new)
   */
  async updateReaction(
    fileKey: string,
    commentId: string,
    oldEmoji: string,
    newEmoji: string
  ): Promise<boolean> {
    await this.removeReaction(fileKey, commentId, oldEmoji)
    return this.addReaction(fileKey, commentId, newEmoji)
  }

  /**
   * Get file information
   */
  async getFile(fileKey: string): Promise<FigmaFile> {
    const cleanFileKey = this.cleanFileKey(fileKey)

    return this.retryWithBackoff(async () => {
      console.log('[Figma Service] Fetching file info:', cleanFileKey)

      const response = await this.rateLimitedFetch<FigmaFile>(
        `${FIGMA_CONFIG.API_BASE_URL}/files/${cleanFileKey}`,
        {
          headers: {
            'X-Figma-Token': this.apiKey,
          },
        }
      )

      return response
    })
  }

  /**
   * Validate API key by making test request
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('[Figma Service] Testing connection...')

      // Make a simple request to verify the API key works
      await this.rateLimitedFetch(
        `${FIGMA_CONFIG.API_BASE_URL}/me`,
        {
          headers: {
            'X-Figma-Token': this.apiKey,
          },
        }
      )

      console.log('[Figma Service] Connection test successful')
      return true
    }
    catch (error) {
      console.error('[Figma Service] Connection test failed:', error)
      return false
    }
  }

  // ============================================
  // INTERNAL HELPERS
  // ============================================

  /**
   * Fetch a single page of comments
   */
  private async fetchCommentsPage(
    fileKey: string,
    cursor?: string
  ): Promise<FigmaCommentsResponse> {
    return this.circuitBreaker.execute(async () => {
      let url = `${FIGMA_CONFIG.API_BASE_URL}/files/${fileKey}/comments`
      if (cursor) {
        url += `?cursor=${encodeURIComponent(cursor)}`
      }

      const response = await this.rateLimitedFetch<FigmaCommentsResponse>(url, {
        headers: {
          'X-Figma-Token': this.apiKey,
        },
      })

      return response
    })
  }

  /**
   * Make a rate-limited fetch request
   */
  private async rateLimitedFetch<T>(url: string, options: RequestInit): Promise<T> {
    // Enforce rate limiting
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < FIGMA_CONFIG.RATE_LIMIT_DELAY_MS) {
      const delay = FIGMA_CONFIG.RATE_LIMIT_DELAY_MS - timeSinceLastRequest
      console.log(`[Figma Service] Rate limiting: waiting ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    this.lastRequestTime = Date.now()

    // Make the request
    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Figma Service] API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url,
      })

      if (response.status === 404) {
        throw new Error(
          `Figma resource not found. Please check:\n` +
          `1. The file/comment key is correct\n` +
          `2. Your API token has access to this resource\n` +
          `3. The resource exists and hasn't been deleted`
        )
      }

      if (response.status === 403) {
        throw new Error(
          `Figma API access denied. This usually means:\n` +
          `1. Your API token is invalid or revoked\n` +
          `2. The token doesn't have access to this resource\n` +
          `3. Try generating a new token at: https://www.figma.com/settings`
        )
      }

      if (response.status === 429) {
        throw new Error(
          `Figma API rate limit exceeded. Please wait before making more requests.`
        )
      }

      throw new Error(`Figma API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts = FIGMA_CONFIG.RETRY_MAX_ATTEMPTS
  ): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn()
      }
      catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt === maxAttempts) {
          console.error(`[Figma Service] All ${maxAttempts} attempts failed`, lastError)
          throw lastError
        }

        const delay = FIGMA_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
        console.warn(
          `[Figma Service] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`,
          lastError.message
        )

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  /**
   * Clean file key - handle both full URLs and bare keys
   */
  private cleanFileKey(fileKey: string): string {
    // If it's a full URL, extract the key
    if (fileKey.includes('figma.com')) {
      const match = fileKey.match(/\/(file|board)\/([a-zA-Z0-9]+)(\/|$|\?)/)
      return match?.[2] || fileKey
    }

    // Remove any trailing path or query params
    return fileKey.split('/')[0]?.split('?')[0] || fileKey
  }

  /**
   * Find the root comment of a thread
   */
  private findRootComment(comments: FigmaComment[], commentId: string): FigmaComment | null {
    const comment = comments.find(c => c.id === commentId)

    if (!comment) {
      return null
    }

    // If this comment has no parent, it's the root
    if (!comment.parent_id) {
      return comment
    }

    // Otherwise, recursively find the root of its parent
    return this.findRootComment(comments, comment.parent_id)
  }

  /**
   * Get all replies to a comment
   */
  private getReplies(comments: FigmaComment[], commentId: string): FigmaComment[] {
    return comments
      .filter(c => c.parent_id === commentId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }

  /**
   * Build Figma URL for a file and optional comment
   */
  private buildFigmaUrl(fileKey: string, commentId?: string): string {
    let url = `https://www.figma.com/file/${fileKey}`

    if (commentId) {
      url += `#comment-${commentId}`
    }

    return url
  }
}
