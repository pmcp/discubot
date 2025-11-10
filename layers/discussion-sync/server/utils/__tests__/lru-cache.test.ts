import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LRUCache } from '../lru-cache'

describe('LRUCache', () => {
  describe('basic operations', () => {
    let cache: LRUCache<string>

    beforeEach(() => {
      cache = new LRUCache({ maxSize: 3 })
    })

    afterEach(() => {
      cache.destroy()
    })

    it('should set and get values', () => {
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBe(null)
    })

    it('should update existing keys', () => {
      cache.set('key1', 'value1')
      cache.set('key1', 'value2')
      expect(cache.get('key1')).toBe('value2')
    })

    it('should check if key exists', () => {
      cache.set('key1', 'value1')
      expect(cache.has('key1')).toBe(true)
      expect(cache.has('key2')).toBe(false)
    })

    it('should delete keys', () => {
      cache.set('key1', 'value1')
      expect(cache.has('key1')).toBe(true)

      cache.delete('key1')
      expect(cache.has('key1')).toBe(false)
    })

    it('should clear all entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      expect(cache.getStats().size).toBe(2)

      cache.clear()
      expect(cache.getStats().size).toBe(0)
    })
  })

  describe('LRU eviction', () => {
    it('should evict least recently used item when maxSize is reached', () => {
      const cache = new LRUCache<string>({ maxSize: 3 })

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      expect(cache.get('key1')).toBe('value1')
      expect(cache.get('key2')).toBe('value2')
      expect(cache.get('key3')).toBe('value3')

      // Adding 4th item should evict key1 (least recently used)
      cache.set('key4', 'value4')

      expect(cache.get('key1')).toBe(null)
      expect(cache.get('key2')).toBe('value2')
      expect(cache.get('key3')).toBe('value3')
      expect(cache.get('key4')).toBe('value4')

      cache.destroy()
    })

    it('should update LRU order when accessing items', () => {
      const cache = new LRUCache<string>({ maxSize: 3 })

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      // Access key1 to make it most recently used
      cache.get('key1')

      // Adding 4th item should evict key2 (now least recently used)
      cache.set('key4', 'value4')

      expect(cache.get('key1')).toBe('value1') // Still exists
      expect(cache.get('key2')).toBe(null) // Evicted
      expect(cache.get('key3')).toBe('value3')
      expect(cache.get('key4')).toBe('value4')

      cache.destroy()
    })

    it('should update LRU order when setting existing keys', () => {
      const cache = new LRUCache<string>({ maxSize: 3 })

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      // Update key1 to make it most recently used
      cache.set('key1', 'value1-updated')

      // Adding 4th item should evict key2
      cache.set('key4', 'value4')

      expect(cache.get('key1')).toBe('value1-updated')
      expect(cache.get('key2')).toBe(null)
      expect(cache.get('key3')).toBe('value3')
      expect(cache.get('key4')).toBe('value4')

      cache.destroy()
    })
  })

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      const cache = new LRUCache<string>({
        maxSize: 10,
        ttl: 100, // 100ms
      })

      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(cache.get('key1')).toBe(null)
      expect(cache.has('key1')).toBe(false)

      cache.destroy()
    })

    it('should not expire entries before TTL', async () => {
      const cache = new LRUCache<string>({
        maxSize: 10,
        ttl: 200, // 200ms
      })

      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')

      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(cache.get('key1')).toBe('value1')
      expect(cache.has('key1')).toBe(true)

      cache.destroy()
    })

    it('should cleanup expired entries automatically', async () => {
      const cache = new LRUCache<string>({
        maxSize: 10,
        ttl: 100,
      })

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      expect(cache.getStats().size).toBe(3)

      // Wait for cleanup to run (should run after 100ms based on TTL)
      await new Promise(resolve => setTimeout(resolve, 200))

      // All entries should be cleaned up
      expect(cache.getStats().size).toBe(0)

      cache.destroy()
    })
  })

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const cache = new LRUCache<string>({ maxSize: 5 })

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      const stats = cache.getStats()
      expect(stats.size).toBe(2)
      expect(stats.maxSize).toBe(5)
      expect(stats.keys).toEqual(['key1', 'key2'])

      cache.destroy()
    })

    it('should update stats after operations', () => {
      const cache = new LRUCache<string>({ maxSize: 3 })

      cache.set('key1', 'value1')
      expect(cache.getStats().size).toBe(1)

      cache.set('key2', 'value2')
      expect(cache.getStats().size).toBe(2)

      cache.delete('key1')
      expect(cache.getStats().size).toBe(1)

      cache.clear()
      expect(cache.getStats().size).toBe(0)

      cache.destroy()
    })
  })

  describe('destroy', () => {
    it('should clear cache and stop cleanup interval', () => {
      const cache = new LRUCache<string>({
        maxSize: 10,
        ttl: 100,
      })

      cache.set('key1', 'value1')
      expect(cache.getStats().size).toBe(1)

      cache.destroy()
      expect(cache.getStats().size).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle maxSize of 1', () => {
      const cache = new LRUCache<string>({ maxSize: 1 })

      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')

      cache.set('key2', 'value2')
      expect(cache.get('key1')).toBe(null)
      expect(cache.get('key2')).toBe('value2')

      cache.destroy()
    })

    it('should handle complex values', () => {
      interface ComplexValue {
        id: number
        data: string[]
        nested: { foo: string }
      }

      const cache = new LRUCache<ComplexValue>({ maxSize: 3 })

      const value: ComplexValue = {
        id: 1,
        data: ['a', 'b', 'c'],
        nested: { foo: 'bar' },
      }

      cache.set('key1', value)
      const retrieved = cache.get('key1')

      expect(retrieved).toEqual(value)
      expect(retrieved?.nested.foo).toBe('bar')

      cache.destroy()
    })

    it('should handle undefined and null values', () => {
      const cache = new LRUCache<string | null | undefined>({ maxSize: 3 })

      cache.set('key1', null as any)
      cache.set('key2', undefined as any)

      expect(cache.get('key1')).toBe(null)
      expect(cache.get('key2')).toBe(undefined)
      expect(cache.has('key1')).toBe(true)
      expect(cache.has('key2')).toBe(true)

      cache.destroy()
    })
  })
})
