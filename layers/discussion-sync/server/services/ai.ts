/**
 * AI Service using Claude (Anthropic)
 * Provides summary generation and task detection for discussion threads
 */

import Anthropic from '@anthropic-ai/sdk'
import crypto from 'crypto'
import type { DiscussionThread } from '../adapters/base'
import { CircuitBreaker } from '../utils/circuitBreaker'
import { LRUCache } from '../utils/lru-cache'

// ============================================
// CONSTANTS
// ============================================

const AI_CONFIG = {
  MODEL: 'claude-3-5-sonnet-20241022',
  CACHE_MAX_SIZE: 100,
  CACHE_TTL_MS: 3600000, // 1 hour
  CACHE_HASH_ALGORITHM: 'sha256',
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: 3,
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: 30000, // 30 seconds
  DEFAULT_SUMMARY_MAX_TOKENS: 500,
  DEFAULT_TASK_DETECTION_MAX_TOKENS: 800,
  MODEL_TEMPERATURE: 0.7,
  HALF_OPEN_SUCCESS_THRESHOLD: 3,
} as const

// ============================================
// TYPES
// ============================================

export interface AISummaryRequest {
  thread: DiscussionThread
  fileName?: string
  customPrompt?: string
  maxTokens?: number
}

export interface AISummaryResponse {
  summary: string
  keyPoints: string[]
  suggestedActions?: string[]
  cached: boolean
}

export interface TaskDetectionRequest {
  commentText: string
  threadContext?: DiscussionThread
  fileName?: string
  customPrompt?: string
}

export interface TaskDetection {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
}

export interface TaskDetectionResponse {
  isMultiTask: boolean
  tasks: TaskDetection[]
  overallContext: string
}

// ============================================
// AI SERVICE CLASS
// ============================================

export class AIService {
  private readonly client: Anthropic
  private readonly circuitBreaker: CircuitBreaker
  private readonly cache: LRUCache<AISummaryResponse | TaskDetectionResponse>

  constructor(apiKey?: string) {
    // Try constructor param, runtime config, or environment variable
    const key = apiKey || useRuntimeConfig().anthropicApiKey || process.env.ANTHROPIC_API_KEY || ''

    // Strict validation: fail fast if no API key
    if (!key || key.trim() === '') {
      throw new Error(
        '[AI Service] Anthropic API key is required. ' +
        'Set ANTHROPIC_API_KEY environment variable or pass apiKey to constructor.',
      )
    }

    this.client = new Anthropic({ apiKey: key })

    this.cache = new LRUCache({
      maxSize: AI_CONFIG.CACHE_MAX_SIZE,
      ttl: AI_CONFIG.CACHE_TTL_MS,
    })

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: AI_CONFIG.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      resetTimeout: AI_CONFIG.CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
      onOpen: () => console.error('[AI Service] Circuit breaker opened'),
      onClose: () => console.log('[AI Service] Circuit breaker closed'),
    })
  }

  /**
   * Generate a summary of a discussion thread
   */
  async generateSummary(request: AISummaryRequest): Promise<AISummaryResponse> {
    const cacheKey = this.getCacheKey('summary', request.thread)

    return this.getCachedOrExecute(
      cacheKey,
      async () => {
        console.log('[AI Service] Generating new summary:', {
          threadSize: request.thread.replies.length + 1,
          fileName: request.fileName,
          hasCustomPrompt: !!request.customPrompt,
        })

        const prompt = this.buildSummaryPrompt(request)

        const message = await this.client.messages.create({
          model: AI_CONFIG.MODEL,
          max_tokens: request.maxTokens || AI_CONFIG.DEFAULT_SUMMARY_MAX_TOKENS,
          temperature: AI_CONFIG.MODEL_TEMPERATURE,
          system: request.customPrompt
            ? 'You are an assistant that summarizes discussion threads according to specific instructions.'
            : 'You are a helpful assistant that summarizes discussion threads. Be concise but comprehensive.',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        })

        const content = message.content[0]
        if (content.type !== 'text') {
          throw new Error('Unexpected response type from Claude')
        }

        return this.parseSummaryResponse(content.text)
      },
      true, // markAsCached
    )
  }

  /**
   * Detect multiple tasks within a discussion
   */
  async detectTasks(request: TaskDetectionRequest): Promise<TaskDetectionResponse> {
    const cacheKey = this.getCacheKey('tasks', request.commentText)

    return this.getCachedOrExecute(
      cacheKey,
      async () => {
        console.log('[AI Service] Detecting tasks:', {
          commentLength: request.commentText.length,
          hasThreadContext: !!request.threadContext,
          fileName: request.fileName,
        })

        const prompt = this.buildTaskDetectionPrompt(request)

        const message = await this.client.messages.create({
          model: AI_CONFIG.MODEL,
          max_tokens: AI_CONFIG.DEFAULT_TASK_DETECTION_MAX_TOKENS,
          temperature: AI_CONFIG.MODEL_TEMPERATURE,
          system: 'You are a task detection assistant. Analyze discussions to identify distinct, actionable tasks. Return valid JSON only.',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        })

        const content = message.content[0]
        if (content.type !== 'text') {
          throw new Error('Unexpected response type from Claude')
        }

        return this.parseTaskDetectionResponse(content.text, request)
      },
      false, // Don't mark as cached (already a plain object)
    )
  }

  /**
   * Generic cached execution helper
   * Checks cache first, executes function if not found, then caches result
   */
  private async getCachedOrExecute<T extends AISummaryResponse | TaskDetectionResponse>(
    cacheKey: string,
    executeFn: () => Promise<T>,
    markAsCached: boolean = false,
  ): Promise<T> {
    // Check cache first
    const cached = this.cache.get(cacheKey) as T | null

    if (cached) {
      console.log('[AI Service] Returning cached result')

      // If this is a summary response, mark it as cached
      if (markAsCached && 'cached' in cached) {
        return { ...cached, cached: true } as T
      }

      return cached
    }

    // Execute with circuit breaker protection
    const result = await this.circuitBreaker.execute(executeFn)

    // Cache the result
    this.cache.set(cacheKey, result)

    // If this is a summary response, mark it as not cached
    if (markAsCached && 'cached' in result) {
      return { ...result, cached: false } as T
    }

    return result
  }

  /**
   * Build prompt for summary generation
   */
  private buildSummaryPrompt(request: AISummaryRequest): string {
    const { thread, fileName, customPrompt } = request

    let prompt = ''

    // Add custom prompt if provided
    if (customPrompt) {
      prompt = `${customPrompt}\n\n`
    }

    // Add context
    prompt += `Context: Discussion ${fileName ? `about "${fileName}"` : 'thread'}\n\n`

    // Add root message
    prompt += `Initial message (by @${thread.rootMessage.authorHandle}):\n`
    prompt += `"${thread.rootMessage.content}"\n\n`

    // Add replies if any
    if (thread.replies.length > 0) {
      prompt += 'Replies:\n'
      for (const reply of thread.replies) {
        prompt += `- @${reply.authorHandle}: "${reply.content}"\n`
      }
      prompt += '\n'
    }

    // Add instructions if no custom prompt
    if (!customPrompt) {
      prompt += 'Please provide:\n'
      prompt += '1. A brief summary of the main discussion points (2-3 sentences)\n'
      prompt += '2. Key points or decisions made (as bullet points)\n'
      prompt += '3. Any suggested next actions (if applicable)\n\n'
      prompt += 'Format your response with clear sections for Summary, Key Points, and Suggested Actions.'
    }

    return prompt
  }

  /**
   * Build prompt for task detection
   */
  private buildTaskDetectionPrompt(request: TaskDetectionRequest): string {
    const { commentText, threadContext, fileName } = request

    let prompt = `Analyze this discussion ${fileName ? `from "${fileName}"` : ''} to detect distinct, actionable tasks.\n\n`

    prompt += `Comment to analyze:\n"${commentText}"\n\n`

    if (threadContext) {
      prompt += 'Context - Full thread conversation:\n'
      prompt += `Root message by @${threadContext.rootMessage.authorHandle}: "${threadContext.rootMessage.content}"\n`

      if (threadContext.replies.length > 0) {
        prompt += 'Replies:\n'
        for (const reply of threadContext.replies) {
          prompt += `- @${reply.authorHandle}: "${reply.content}"\n`
        }
      }
      prompt += '\n'
    }

    prompt += `Instructions:
1. Identify if this comment contains multiple distinct, actionable tasks
2. A task is actionable if it requires specific work to be done
3. Tasks should be separate if they can be worked on independently
4. Don't split tasks that are really one cohesive piece of work
5. Generate a unique ID for each task using format: task_[uuid]

Return a JSON object with this exact structure:
{
  "isMultiTask": boolean,
  "tasks": [
    {
      "id": "task_[uuid]",
      "title": "Brief title (max 50 chars)",
      "description": "Detailed description of what needs to be done",
      "priority": "low|medium|high"
    }
  ],
  "overallContext": "Brief context about the overall discussion/request"
}

Examples:
- "Fix the header and update the footer" = 2 tasks
- "Fix the header styling" = 1 task
- "Update all the buttons to use the new design system" = 1 task
- "Create a new login page, add validation, and setup routing" = 3 tasks

Return ONLY the JSON object, no additional text.`

    return prompt
  }

  /**
   * Parse summary response
   */
  private parseSummaryResponse(content: string): AISummaryResponse {
    console.log('[AI Service] Parsing summary response')

    // Try to extract structured sections
    const summaryMatch = content.match(/Summary[:\s]+(.+?)(?=Key Points|Action Items|Suggested Actions|$)/si)
    const keyPointsMatch = content.match(/Key Points[:\s]+(.+?)(?=Action Items|Suggested Actions|$)/si)
    const actionsMatch = content.match(/(Action Items|Suggested Actions)[:\s]+(.+?)$/si)

    let summary: string
    let keyPoints: string[] = []
    let suggestedActions: string[] | undefined

    if (summaryMatch) {
      // Found structured format
      summary = summaryMatch[1]?.trim().replace(/^[•\-*]\s*/, '') || ''
      keyPoints = this.extractBulletPoints(keyPointsMatch?.[1] || '')
      suggestedActions = actionsMatch?.[2]
        ? this.extractBulletPoints(actionsMatch[2])
        : undefined
    }
    else {
      // No structured format - use entire response as summary
      summary = content.trim()

      // Try to extract bullet points as action items
      const bulletPoints = this.extractBulletPoints(content)
      if (bulletPoints.length > 0) {
        const nonBulletText = content.split('\n').find(line =>
          line.trim() && !line.trim().match(/^[•\-*\d.]+\s/),
        )
        if (nonBulletText) {
          summary = nonBulletText.trim()
          suggestedActions = bulletPoints
        }
      }
    }

    // Ensure we always have a summary
    if (!summary || summary.length === 0) {
      summary = content.substring(0, 200) || 'No summary available'
    }

    return {
      summary,
      keyPoints: keyPoints.length > 0 ? keyPoints : [],
      suggestedActions: suggestedActions && suggestedActions.length > 0 ? suggestedActions : undefined,
      cached: false,
    }
  }

  /**
   * Parse task detection response
   */
  private parseTaskDetectionResponse(content: string, request: TaskDetectionRequest): TaskDetectionResponse {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      // Validate structure
      if (typeof parsed.isMultiTask !== 'boolean' || !Array.isArray(parsed.tasks)) {
        throw new Error('Invalid response structure')
      }

      // Process tasks
      const tasks: TaskDetection[] = parsed.tasks.map((task: any, index: number) => ({
        id: task.id?.startsWith('task_') ? task.id : `task_${crypto.randomUUID()}`,
        title: String(task.title || `Task ${index + 1}`).substring(0, 50),
        description: String(task.description || request.commentText),
        priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium',
      }))

      // Ensure at least one task
      if (tasks.length === 0) {
        tasks.push({
          id: `task_${crypto.randomUUID()}`,
          title: request.fileName ? `Task from ${request.fileName}` : 'Discussion task',
          description: request.commentText,
          priority: 'medium',
        })
      }

      return {
        isMultiTask: parsed.isMultiTask && tasks.length > 1,
        tasks,
        overallContext: String(parsed.overallContext || 'Discussion feedback'),
      }
    }
    catch (error) {
      console.warn('[AI Service] Failed to parse task detection, falling back to single task:', error)

      // Fallback: single task
      return {
        isMultiTask: false,
        tasks: [
          {
            id: `task_${crypto.randomUUID()}`,
            title: request.fileName ? `Task from ${request.fileName}` : 'Discussion task',
            description: request.commentText,
            priority: 'medium',
          },
        ],
        overallContext: 'Discussion feedback',
      }
    }
  }

  /**
   * Extract bullet points from text
   */
  private extractBulletPoints(text: string): string[] {
    const lines = text.split('\n')
    const points: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed) {
        const cleaned = trimmed.replace(/^[•\-*\d.]+\s*/, '')
        if (cleaned) {
          points.push(cleaned)
        }
      }
    }

    return points
  }

  /**
   * Generate cache key using SHA-256
   */
  private getCacheKey(type: string, data: unknown): string {
    let hash: string

    if (typeof data === 'string') {
      hash = crypto.createHash(AI_CONFIG.CACHE_HASH_ALGORITHM).update(data).digest('hex')
    }
    else if (data && typeof data === 'object' && 'id' in data) {
      // For DiscussionThread
      const thread = data as DiscussionThread
      const ids = [
        thread.rootMessage.id,
        ...thread.replies.map(r => r.id),
      ].sort().join('-')
      hash = crypto.createHash(AI_CONFIG.CACHE_HASH_ALGORITHM).update(ids).digest('hex')
    }
    else {
      hash = crypto.createHash(AI_CONFIG.CACHE_HASH_ALGORITHM).update(JSON.stringify(data)).digest('hex')
    }

    return `ai:${type}:${hash}`
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; keys: string[] } {
    return this.cache.getStats()
  }

  /**
   * Destroy the service and cleanup resources
   */
  destroy(): void {
    this.cache.destroy()
  }
}
