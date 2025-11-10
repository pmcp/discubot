/**
 * Slack Service
 *
 * Handles all interactions with the Slack API, including:
 * - Fetching conversation threads
 * - Posting messages and replies
 * - Adding/removing reactions
 * - Getting user and channel info
 * - Rate limiting and circuit breaker patterns
 */

interface SlackMessage {
  type: string
  user: string
  text: string
  ts: string
  thread_ts?: string
  reactions?: Array<{
    name: string
    count: number
    users: string[]
  }>
}

export interface SlackThread {
  messages: SlackMessage[]
  channelId: string
  threadTs: string
  hasMore: boolean
  metadata: {
    channelName?: string
    channelType?: string
  }
}

export interface SlackUser {
  id: string
  name: string
  real_name: string
  email?: string
  profile: {
    display_name: string
    real_name: string
    email?: string
    image_72?: string
  }
}

export interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_archived: boolean
  topic: {
    value: string
  }
  purpose: {
    value: string
  }
}

interface SlackApiResponse<T = any> {
  ok: boolean
  error?: string
  response_metadata?: {
    next_cursor?: string
  }
  [key: string]: any
}

/**
 * Circuit Breaker States
 */
enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, rejecting requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Circuit Breaker for Slack API
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private successCount = 0
  private lastFailureTime: number | null = null
  private readonly threshold: number
  private readonly timeout: number
  private readonly halfOpenRequests: number

  constructor(options: {
    threshold?: number
    timeout?: number
    halfOpenRequests?: number
  } = {}) {
    this.threshold = options.threshold || 5
    this.timeout = options.timeout || 60000 // 60 seconds
    this.halfOpenRequests = options.halfOpenRequests || 3
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN
        console.log('[Circuit Breaker] Transitioning to HALF_OPEN')
      }
      else {
        throw new Error('[Circuit Breaker] Circuit is OPEN')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    }
    catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= this.halfOpenRequests) {
        this.state = CircuitState.CLOSED
        this.successCount = 0
        console.log('[Circuit Breaker] Circuit CLOSED')
      }
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    this.successCount = 0

    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN
      console.warn('[Circuit Breaker] Circuit OPENED after', this.failureCount, 'failures')
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailureTime !== null &&
           Date.now() - this.lastFailureTime >= this.timeout
  }

  getState(): CircuitState {
    return this.state
  }
}

/**
 * Rate Limiter using Token Bucket algorithm
 */
class RateLimiter {
  private tokens: number
  private lastRefill: number
  private readonly capacity: number
  private readonly refillRate: number

  constructor(capacity = 50, refillRate = 1) {
    this.capacity = capacity
    this.tokens = capacity
    this.refillRate = refillRate // tokens per second
    this.lastRefill = Date.now()
  }

  async waitForToken(): Promise<void> {
    this.refill()

    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }

    // Wait for next token
    const waitTime = 1000 / this.refillRate
    await new Promise(resolve => setTimeout(resolve, waitTime))
    this.tokens -= 1
  }

  private refill(): void {
    const now = Date.now()
    const timePassed = (now - this.lastRefill) / 1000
    const tokensToAdd = timePassed * this.refillRate

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd)
    this.lastRefill = now
  }
}

/**
 * Slack Service class
 */
export class SlackService {
  private readonly token: string
  private readonly baseUrl = 'https://slack.com/api'
  private readonly circuitBreaker: CircuitBreaker
  private readonly rateLimiter: RateLimiter
  private readonly cache = new Map<string, { data: any; expiry: number }>()
  private readonly cacheTTL = 300000 // 5 minutes

  constructor(token: string, options: {
    circuitBreakerThreshold?: number
    circuitBreakerTimeout?: number
    rateLimit?: number
  } = {}) {
    this.token = token
    this.circuitBreaker = new CircuitBreaker({
      threshold: options.circuitBreakerThreshold || 5,
      timeout: options.circuitBreakerTimeout || 60000,
    })
    this.rateLimiter = new RateLimiter(
      options.rateLimit || 50, // capacity
      (options.rateLimit || 50) / 60 // refill rate (50 requests per minute)
    )
  }

  /**
   * Fetch a conversation thread
   */
  async getThread(channelId: string, threadTs: string): Promise<SlackThread> {
    const cacheKey = `thread:${channelId}:${threadTs}`
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    await this.rateLimiter.waitForToken()

    const response = await this.circuitBreaker.execute(async () => {
      return await this.apiCall<SlackApiResponse>('conversations.replies', {
        channel: channelId,
        ts: threadTs,
        inclusive: true,
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch thread: ${response.error}`)
    }

    const thread: SlackThread = {
      messages: response.messages || [],
      channelId,
      threadTs,
      hasMore: !!response.response_metadata?.next_cursor,
      metadata: {},
    }

    // Get channel info
    try {
      const channelInfo = await this.getChannelInfo(channelId)
      thread.metadata.channelName = channelInfo.name
      thread.metadata.channelType = channelInfo.is_private ? 'private' : 'public'
    }
    catch (error) {
      console.warn('[Slack Service] Could not fetch channel info:', error)
    }

    this.setCache(cacheKey, thread)
    return thread
  }

  /**
   * Post a message to a channel or thread
   */
  async postMessage(
    channelId: string,
    text: string,
    threadTs?: string
  ): Promise<string> {
    await this.rateLimiter.waitForToken()

    const response = await this.circuitBreaker.execute(async () => {
      return await this.apiCall<SlackApiResponse>('chat.postMessage', {
        channel: channelId,
        text,
        thread_ts: threadTs,
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to post message: ${response.error}`)
    }

    return response.ts
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(
    channelId: string,
    timestamp: string,
    emoji: string
  ): Promise<void> {
    await this.rateLimiter.waitForToken()

    const response = await this.circuitBreaker.execute(async () => {
      return await this.apiCall<SlackApiResponse>('reactions.add', {
        channel: channelId,
        timestamp,
        name: emoji.replace(/:/g, ''), // Remove colons if present
      })
    })

    if (!response.ok && response.error !== 'already_reacted') {
      throw new Error(`Failed to add reaction: ${response.error}`)
    }
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(
    channelId: string,
    timestamp: string,
    emoji: string
  ): Promise<void> {
    await this.rateLimiter.waitForToken()

    const response = await this.circuitBreaker.execute(async () => {
      return await this.apiCall<SlackApiResponse>('reactions.remove', {
        channel: channelId,
        timestamp,
        name: emoji.replace(/:/g, ''),
      })
    })

    if (!response.ok && response.error !== 'no_reaction') {
      throw new Error(`Failed to remove reaction: ${response.error}`)
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(userId: string): Promise<SlackUser> {
    const cacheKey = `user:${userId}`
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    await this.rateLimiter.waitForToken()

    const response = await this.circuitBreaker.execute(async () => {
      return await this.apiCall<SlackApiResponse>('users.info', {
        user: userId,
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.error}`)
    }

    const user: SlackUser = response.user

    this.setCache(cacheKey, user, 3600000) // Cache for 1 hour
    return user
  }

  /**
   * Get channel information
   */
  async getChannelInfo(channelId: string): Promise<SlackChannel> {
    const cacheKey = `channel:${channelId}`
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    await this.rateLimiter.waitForToken()

    const response = await this.circuitBreaker.execute(async () => {
      return await this.apiCall<SlackApiResponse>('conversations.info', {
        channel: channelId,
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch channel info: ${response.error}`)
    }

    const channel: SlackChannel = response.channel

    this.setCache(cacheKey, channel, 3600000) // Cache for 1 hour
    return channel
  }

  /**
   * Test the connection to Slack API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.rateLimiter.waitForToken()

      const response = await this.circuitBreaker.execute(async () => {
        return await this.apiCall<SlackApiResponse>('auth.test')
      })

      return response.ok
    }
    catch (error) {
      console.error('[Slack Service] Connection test failed:', error)
      return false
    }
  }

  /**
   * Make an API call to Slack
   */
  private async apiCall<T>(method: string, params: Record<string, any> = {}): Promise<T> {
    const url = `${this.baseUrl}/${method}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json() as T
  }

  /**
   * Get data from cache
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key)
    if (cached && cached.expiry > Date.now()) {
      console.log('[Slack Service] Cache hit:', key)
      return cached.data
    }
    if (cached) {
      this.cache.delete(key)
    }
    return null
  }

  /**
   * Set data in cache
   */
  private setCache(key: string, data: any, ttl: number = this.cacheTTL): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    })
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear()
    console.log('[Slack Service] Cache cleared')
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState()
  }
}

/**
 * Create a Slack service instance
 */
export function createSlackService(token: string): SlackService {
  return new SlackService(token)
}
