/**
 * Simple LRU (Least Recently Used) Cache implementation
 * Automatically evicts least recently used items when max size is reached
 */

export interface LRUCacheOptions {
  maxSize: number
  ttl?: number // Time to live in milliseconds
}

interface CacheEntry<T> {
  value: T
  timestamp: number
}

export class LRUCache<T> {
  private readonly cache: Map<string, CacheEntry<T>>
  private readonly maxSize: number
  private readonly ttl: number | undefined
  private cleanupInterval: NodeJS.Timeout | undefined

  constructor(options: LRUCacheOptions) {
    this.cache = new Map()
    this.maxSize = options.maxSize
    this.ttl = options.ttl

    // Setup automatic cleanup if TTL is set
    if (this.ttl) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup()
      }, Math.min(this.ttl, 60000)) // Run cleanup at least once per minute
    }
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.value
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T): void {
    // Remove if already exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Evict LRU item if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    })
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    // Check if expired
    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    if (!this.ttl)
      return

    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
    }

    if (keysToDelete.length > 0) {
      console.log(`[LRU Cache] Cleaned up ${keysToDelete.length} expired entries`)
    }
  }

  /**
   * Destroy the cache and cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.cache.clear()
  }
}
