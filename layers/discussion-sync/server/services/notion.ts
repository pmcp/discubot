/**
 * Notion Service
 * Handles task creation and management in Notion databases
 *
 * REFACTORED from fyit-tools with improvements:
 * - Strict API key validation (fail fast)
 * - Extracted magic numbers to constants
 * - Added rate limiter (not just delays)
 * - Added LRU cache for duplicate detection
 * - Refactored god function into smaller block builders
 * - Field mapping support for different database setups
 * - Proper pagination for search
 * - Retry with exponential backoff
 * - Better error handling and context
 */

import { Client } from '@notionhq/client'
import type {
  CreatePageParameters,
  QueryDatabaseParameters,
  BlockObjectRequest,
  PageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints'
import { CircuitBreaker } from '../utils/circuitBreaker'
import { LRUCache } from '../utils/lru-cache'
import type { AISummaryResponse } from './ai'
import type { SourceConfig } from '../adapters/base'

// ============================================
// CONSTANTS
// ============================================

const NOTION_CONFIG = {
  API_VERSION: '2022-06-28',
  RATE_LIMIT_DELAY_MS: 200,
  RATE_LIMIT_MAX_REQUESTS: 3,
  RATE_LIMIT_PER_MS: 1000,
  CIRCUIT_BREAKER_THRESHOLD: 3,
  CIRCUIT_BREAKER_TIMEOUT_MS: 30000,
  DEFAULT_FIELD_NAME: 'Name', // Every Notion DB has this
  CACHE_MAX_SIZE: 50,
  CACHE_TTL_MS: 300000, // 5 minutes
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 1000,
  RETRY_MAX_DELAY_MS: 10000,
  PAGINATION_PAGE_SIZE: 100,
} as const

// ============================================
// TYPES
// ============================================

export interface NotionFieldMapping {
  title?: string      // Default: "Name"
  status?: string     // Optional status field
  priority?: string   // Optional priority field
  assignee?: string   // Optional assignee field
  dueDate?: string    // Optional due date field
  tags?: string       // Optional tags field
  sourceUrl?: string  // Optional source URL field
}

export interface NotionTaskData {
  title: string
  description?: string
  sourceUrl: string
  sourceThreadId: string
  priority?: 'low' | 'medium' | 'high'
  assignee?: string
  tags?: string[]
  aiSummary?: AISummaryResponse
  metadata?: Record<string, unknown>
}

export interface NotionPage {
  id: string
  url: string
  properties: Record<string, unknown>
  created_time?: string
  last_edited_time?: string
}

export interface NotionQueryResult {
  results: NotionPage[]
  has_more: boolean
  next_cursor?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// ============================================
// RATE LIMITER
// ============================================

class RateLimiter {
  private queue: number[] = []
  private readonly maxRequests: number
  private readonly perMilliseconds: number

  constructor(options: { maxRequests: number; perMilliseconds: number }) {
    this.maxRequests = options.maxRequests
    this.perMilliseconds = options.perMilliseconds
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitIfNeeded()
    this.queue.push(Date.now())
    return fn()
  }

  private async waitIfNeeded(): Promise<void> {
    const now = Date.now()

    // Remove old requests outside the time window
    this.queue = this.queue.filter(time => now - time < this.perMilliseconds)

    // If we're at the limit, wait
    if (this.queue.length >= this.maxRequests) {
      const oldestRequest = this.queue[0]
      const waitTime = this.perMilliseconds - (now - oldestRequest)
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return this.waitIfNeeded() // Recursive check
      }
    }
  }
}

// ============================================
// NOTION SERVICE CLASS
// ============================================

export class NotionService {
  private readonly client: Client
  private readonly circuitBreaker: CircuitBreaker
  private readonly rateLimiter: RateLimiter
  private readonly searchCache: LRUCache<NotionPage | null>

  constructor(apiKey?: string) {
    // Try parameter, runtime config, or environment variable
    const key = apiKey || useRuntimeConfig().notionApiKey || process.env.NOTION_API_KEY || ''

    // Strict validation: fail fast if no API key
    if (!key || key.trim() === '') {
      throw new Error(
        '[Notion Service] API key is required. ' +
        'Set NOTION_API_KEY environment variable or pass apiKey to constructor.',
      )
    }

    this.client = new Client({
      auth: key,
      notionVersion: NOTION_CONFIG.API_VERSION,
    })

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: NOTION_CONFIG.CIRCUIT_BREAKER_THRESHOLD,
      resetTimeout: NOTION_CONFIG.CIRCUIT_BREAKER_TIMEOUT_MS,
      onOpen: () => console.error('[Notion Service] Circuit breaker opened'),
      onClose: () => console.log('[Notion Service] Circuit breaker closed'),
    })

    this.rateLimiter = new RateLimiter({
      maxRequests: NOTION_CONFIG.RATE_LIMIT_MAX_REQUESTS,
      perMilliseconds: NOTION_CONFIG.RATE_LIMIT_PER_MS,
    })

    this.searchCache = new LRUCache({
      maxSize: NOTION_CONFIG.CACHE_MAX_SIZE,
      ttl: NOTION_CONFIG.CACHE_TTL_MS,
    })
  }

  // ============================================
  // PUBLIC METHODS - Core Operations
  // ============================================

  /**
   * Create a single task in Notion
   */
  async createTask(task: NotionTaskData, config: SourceConfig): Promise<string> {
    console.log('[Notion Service] Creating task:', {
      title: task.title,
      sourceUrl: task.sourceUrl,
      hasAiSummary: !!task.aiSummary,
      databaseId: config.notionDatabaseId,
    })

    return this.retryWithBackoff(async () => {
      return this.circuitBreaker.execute(async () => {
        return this.rateLimiter.execute(async () => {
          const mapping = (config.notionFieldMapping as NotionFieldMapping) || {}

          const properties = this.buildProperties(task, mapping)
          const children = this.buildPageContent(task)

          const response = await this.client.pages.create({
            parent: { database_id: config.notionDatabaseId },
            properties,
            children,
          } as CreatePageParameters)

          console.log('[Notion Service] Task created:', response.id)
          return response.id
        })
      })
    })
  }

  /**
   * Create multiple tasks (batch operation with rate limiting)
   */
  async createTasks(tasks: NotionTaskData[], config: SourceConfig): Promise<string[]> {
    console.log('[Notion Service] Creating batch:', {
      count: tasks.length,
      titles: tasks.map(t => t.title),
    })

    const pageIds: string[] = []

    for (const task of tasks) {
      try {
        const pageId = await this.createTask(task, config)
        pageIds.push(pageId)

        console.log(`[Notion Service] Created ${pageIds.length}/${tasks.length}`)

        // Rate limiting delay between tasks
        if (pageIds.length < tasks.length) {
          await new Promise(resolve =>
            setTimeout(resolve, NOTION_CONFIG.RATE_LIMIT_DELAY_MS),
          )
        }
      }
      catch (error) {
        console.error('[Notion Service] Failed to create task:', {
          title: task.title,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error // Fail fast
      }
    }

    console.log(`[Notion Service] Successfully created ${pageIds.length} tasks`)
    return pageIds
  }

  /**
   * Update an existing task
   */
  async updateTask(
    pageId: string,
    updates: Partial<NotionTaskData>,
    config: SourceConfig,
  ): Promise<void> {
    console.log('[Notion Service] Updating task:', pageId)

    return this.retryWithBackoff(async () => {
      return this.circuitBreaker.execute(async () => {
        return this.rateLimiter.execute(async () => {
          const mapping = (config.notionFieldMapping as NotionFieldMapping) || {}
          const properties = this.buildProperties(updates as NotionTaskData, mapping)

          await this.client.pages.update({
            page_id: pageId,
            properties,
          })

          console.log('[Notion Service] Task updated:', pageId)
        })
      })
    })
  }

  // ============================================
  // PUBLIC METHODS - Search & Duplicate Detection
  // ============================================

  /**
   * Find duplicate task by source URL (with pagination and caching)
   */
  async findDuplicateByUrl(
    sourceUrl: string,
    config: SourceConfig,
  ): Promise<NotionPage | null> {
    const cacheKey = `duplicate:${config.notionDatabaseId}:${sourceUrl}`

    // Check cache first
    const cached = this.searchCache.get(cacheKey)
    if (cached !== undefined) {
      console.log('[Notion Service] Cache hit for duplicate check')
      return cached
    }

    console.log('[Notion Service] Searching for duplicate:', sourceUrl)

    const mapping = (config.notionFieldMapping as NotionFieldMapping) || {}
    const sourceUrlField = mapping.sourceUrl || 'SourceURL'

    let hasMore = true
    let startCursor: string | undefined

    while (hasMore) {
      const result = await this.queryDatabase(
        {
          database_id: config.notionDatabaseId,
          filter: {
            property: sourceUrlField,
            url: { equals: sourceUrl },
          },
          start_cursor: startCursor,
          page_size: NOTION_CONFIG.PAGINATION_PAGE_SIZE,
        },
        config,
      )

      if (result.results.length > 0) {
        const page = result.results[0]
        this.searchCache.set(cacheKey, page)
        return page
      }

      hasMore = result.has_more
      startCursor = result.next_cursor
    }

    // Cache negative result
    this.searchCache.set(cacheKey, null)
    return null
  }

  /**
   * Query database with pagination support
   */
  async queryDatabase(
    query: QueryDatabaseParameters,
    config: SourceConfig,
  ): Promise<NotionQueryResult> {
    return this.retryWithBackoff(async () => {
      return this.circuitBreaker.execute(async () => {
        return this.rateLimiter.execute(async () => {
          const response = await this.client.databases.query(query)

          return {
            results: response.results as NotionPage[],
            has_more: response.has_more,
            next_cursor: response.next_cursor || undefined,
          }
        })
      })
    })
  }

  // ============================================
  // PUBLIC METHODS - Validation
  // ============================================

  /**
   * Validate configuration
   */
  async validateConfig(config: SourceConfig): Promise<ValidationResult> {
    const errors: string[] = []

    if (!config.notionToken || config.notionToken.trim() === '') {
      errors.push('Notion token is required')
    }

    if (!config.notionDatabaseId || config.notionDatabaseId.trim() === '') {
      errors.push('Notion database ID is required')
    }

    // Try to test connection if we have valid credentials
    if (errors.length === 0) {
      try {
        await this.testConnection(config)
      }
      catch (error) {
        errors.push(
          `Connection test failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Test connection to Notion database
   */
  async testConnection(config: SourceConfig): Promise<boolean> {
    try {
      await this.circuitBreaker.execute(async () => {
        return this.rateLimiter.execute(async () => {
          await this.client.databases.retrieve({
            database_id: config.notionDatabaseId,
          })
        })
      })
      return true
    }
    catch (error) {
      console.error('[Notion Service] Connection test failed:', error)
      throw error
    }
  }

  // ============================================
  // PRIVATE METHODS - Property Building
  // ============================================

  /**
   * Build Notion properties from task data
   */
  private buildProperties(
    task: NotionTaskData,
    mapping: NotionFieldMapping,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {}

    // Title property (required - every Notion DB has this)
    const titleField = mapping.title || NOTION_CONFIG.DEFAULT_FIELD_NAME
    if (task.title) {
      properties[titleField] = {
        title: [{ text: { content: task.title } }],
      }
    }

    // Optional: Source URL
    if (mapping.sourceUrl && task.sourceUrl) {
      properties[mapping.sourceUrl] = {
        url: task.sourceUrl,
      }
    }

    // Optional: Priority
    if (mapping.priority && task.priority) {
      properties[mapping.priority] = {
        select: { name: this.capitalizePriority(task.priority) },
      }
    }

    // Optional: Tags
    if (mapping.tags && task.tags && task.tags.length > 0) {
      properties[mapping.tags] = {
        multi_select: task.tags.map(tag => ({ name: tag })),
      }
    }

    // Optional: Assignee (assuming person property)
    if (mapping.assignee && task.assignee) {
      // Note: This would need actual Notion user IDs
      // For now, we'll skip or use rich text
      properties[mapping.assignee] = {
        rich_text: [{ text: { content: task.assignee } }],
      }
    }

    return properties
  }

  // ============================================
  // PRIVATE METHODS - Content Building
  // ============================================

  /**
   * Build page content blocks
   */
  private buildPageContent(task: NotionTaskData): BlockObjectRequest[] {
    const blocks: BlockObjectRequest[] = []

    // AI Summary section
    if (task.aiSummary) {
      blocks.push(...this.buildAISummaryBlocks(task.aiSummary))
      blocks.push(this.buildDivider())
    }

    // Description section
    if (task.description) {
      blocks.push(...this.buildDescriptionBlocks(task.description))
      blocks.push(this.buildDivider())
    }

    // Metadata section
    blocks.push(...this.buildMetadataBlocks(task))

    // Source link
    if (task.sourceUrl) {
      blocks.push(this.buildDivider())
      blocks.push(this.buildSourceLinkBlock(task.sourceUrl))
    }

    return blocks
  }

  /**
   * Build AI summary blocks
   */
  private buildAISummaryBlocks(summary: AISummaryResponse): BlockObjectRequest[] {
    const blocks: BlockObjectRequest[] = []

    // Summary callout
    if (summary.summary) {
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          icon: { emoji: '🤖' },
          rich_text: [{
            type: 'text',
            text: { content: `AI Summary: ${summary.summary}` },
          }],
        },
      })
    }

    // Key points
    if (summary.keyPoints && summary.keyPoints.length > 0) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: '📌 Key Points' } }],
        },
      })

      for (const point of summary.keyPoints) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: point } }],
          },
        })
      }
    }

    // Suggested actions
    if (summary.suggestedActions && summary.suggestedActions.length > 0) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: '✅ Suggested Actions' } }],
        },
      })

      for (const action of summary.suggestedActions) {
        blocks.push({
          object: 'block',
          type: 'to_do',
          to_do: {
            checked: false,
            rich_text: [{ type: 'text', text: { content: action } }],
          },
        })
      }
    }

    return blocks
  }

  /**
   * Build description blocks
   */
  private buildDescriptionBlocks(description: string): BlockObjectRequest[] {
    return [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Discussion Content' } }],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: description } }],
        },
      },
    ]
  }

  /**
   * Build metadata blocks
   */
  private buildMetadataBlocks(task: NotionTaskData): BlockObjectRequest[] {
    const blocks: BlockObjectRequest[] = [
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: '📋 Metadata' } }],
        },
      },
    ]

    const metadataItems: string[] = [
      `Thread ID: ${task.sourceThreadId}`,
      `Source URL: ${task.sourceUrl}`,
    ]

    // Add custom metadata
    if (task.metadata) {
      for (const [key, value] of Object.entries(task.metadata)) {
        if (value !== null && value !== undefined) {
          metadataItems.push(`${key}: ${String(value)}`)
        }
      }
    }

    for (const item of metadataItems) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: item } }],
        },
      })
    }

    return blocks
  }

  /**
   * Build source link block
   */
  private buildSourceLinkBlock(url: string): BlockObjectRequest {
    return {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { type: 'text', text: { content: '🔗 ' } },
          {
            type: 'text',
            text: {
              content: 'View in Source',
              link: { url },
            },
            annotations: { bold: true, color: 'blue' },
          },
        ],
      },
    }
  }

  /**
   * Build divider block
   */
  private buildDivider(): BlockObjectRequest {
    return {
      object: 'block',
      type: 'divider',
      divider: {},
    }
  }

  // ============================================
  // PRIVATE METHODS - Utilities
  // ============================================

  /**
   * Extract text from Notion blocks
   */
  private extractTextFromBlocks(blocks: unknown[]): string {
    let text = ''

    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue

      const b = block as Record<string, unknown>
      const type = b.type as string

      if (type === 'paragraph' && b.paragraph && typeof b.paragraph === 'object') {
        const paragraph = b.paragraph as Record<string, unknown>
        if (Array.isArray(paragraph.rich_text)) {
          text += this.extractRichText(paragraph.rich_text)
        }
      }
      else if (type === 'bulleted_list_item' && b.bulleted_list_item) {
        const item = b.bulleted_list_item as Record<string, unknown>
        if (Array.isArray(item.rich_text)) {
          text += this.extractRichText(item.rich_text)
        }
      }
      else if (type === 'callout' && b.callout) {
        const callout = b.callout as Record<string, unknown>
        if (Array.isArray(callout.rich_text)) {
          text += this.extractRichText(callout.rich_text)
        }
      }
    }

    return text
  }

  /**
   * Extract text from rich text array
   */
  private extractRichText(richText: unknown[]): string {
    return richText
      .filter(rt => rt && typeof rt === 'object')
      .map(rt => {
        const r = rt as Record<string, unknown>
        if (r.text && typeof r.text === 'object') {
          const text = r.text as Record<string, unknown>
          return text.content || ''
        }
        return ''
      })
      .join('')
  }

  /**
   * Capitalize priority for Notion select
   */
  private capitalizePriority(priority: string): string {
    return priority.charAt(0).toUpperCase() + priority.slice(1)
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts = NOTION_CONFIG.RETRY_MAX_ATTEMPTS,
  ): Promise<T> {
    let lastError: Error | unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn()
      }
      catch (error) {
        lastError = error

        if (attempt === maxAttempts) {
          break // Don't delay on last attempt
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          NOTION_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1),
          NOTION_CONFIG.RETRY_MAX_DELAY_MS,
        )

        console.warn(
          `[Notion Service] Attempt ${attempt}/${maxAttempts} failed, ` +
          `retrying in ${delay}ms:`,
          error instanceof Error ? error.message : String(error),
        )

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.searchCache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; keys: string[] } {
    return this.searchCache.getStats()
  }

  /**
   * Destroy service and cleanup resources
   */
  destroy(): void {
    this.searchCache.destroy()
  }
}
