import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CircuitBreaker } from '../circuitBreaker'

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const breaker = new CircuitBreaker()
      const state = breaker.getState()

      expect(state.isOpen).toBe(false)
      expect(state.failures).toBe(0)
      expect(state.successCount).toBe(0)
    })

    it('should initialize with custom options', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 10,
        resetTimeout: 5000,
      })

      const state = breaker.getState()
      expect(state.isOpen).toBe(false)
    })
  })

  describe('execute - success scenarios', () => {
    it('should execute function successfully when circuit is closed', async () => {
      const breaker = new CircuitBreaker()
      const mockFn = vi.fn().mockResolvedValue('success')

      const result = await breaker.execute(mockFn)

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(breaker.getState().isOpen).toBe(false)
    })

    it('should handle multiple successful executions', async () => {
      const breaker = new CircuitBreaker()
      const mockFn = vi.fn().mockResolvedValue('success')

      await breaker.execute(mockFn)
      await breaker.execute(mockFn)
      await breaker.execute(mockFn)

      expect(mockFn).toHaveBeenCalledTimes(3)
      expect(breaker.getState().isOpen).toBe(false)
      expect(breaker.getState().failures).toBe(0)
    })
  })

  describe('execute - failure scenarios', () => {
    it('should track failures without opening circuit below threshold', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 })
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'))

      await expect(breaker.execute(mockFn)).rejects.toThrow('failure')
      await expect(breaker.execute(mockFn)).rejects.toThrow('failure')

      const state = breaker.getState()
      expect(state.failures).toBe(2)
      expect(state.isOpen).toBe(false)
    })

    it('should open circuit after reaching failure threshold', async () => {
      const onOpen = vi.fn()
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        onOpen,
      })
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'))

      // Trigger 3 failures
      await expect(breaker.execute(mockFn)).rejects.toThrow('failure')
      await expect(breaker.execute(mockFn)).rejects.toThrow('failure')
      await expect(breaker.execute(mockFn)).rejects.toThrow('failure')

      const state = breaker.getState()
      expect(state.isOpen).toBe(true)
      expect(state.failures).toBe(3)
      expect(onOpen).toHaveBeenCalledTimes(1)
    })

    it('should reject immediately when circuit is open', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 })
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'))

      // Open the circuit
      await expect(breaker.execute(mockFn)).rejects.toThrow('failure')
      await expect(breaker.execute(mockFn)).rejects.toThrow('failure')

      expect(breaker.getState().isOpen).toBe(true)

      // Should reject without calling function
      mockFn.mockClear()
      await expect(breaker.execute(mockFn)).rejects.toThrow('Circuit breaker is OPEN')
      expect(mockFn).not.toHaveBeenCalled()
    })
  })

  describe('half-open state', () => {
    it('should enter half-open state after reset timeout', async () => {
      const onHalfOpen = vi.fn()
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 100, // 100ms timeout
        onHalfOpen,
      })
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'))

      // Open the circuit
      await expect(breaker.execute(mockFn)).rejects.toThrow('failure')
      await expect(breaker.execute(mockFn)).rejects.toThrow('failure')
      expect(breaker.getState().isOpen).toBe(true)

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150))

      // Next call should attempt half-open
      mockFn.mockResolvedValueOnce('success')
      await breaker.execute(mockFn)

      expect(onHalfOpen).toHaveBeenCalled()
      expect(breaker.getState().isOpen).toBe(false)
    })

    it('should close circuit after 3 successful calls in half-open state', async () => {
      const onClose = vi.fn()
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 100,
        onClose,
      })
      const mockFn = vi.fn()

      // Open the circuit
      mockFn.mockRejectedValue(new Error('failure'))
      await expect(breaker.execute(mockFn)).rejects.toThrow()
      await expect(breaker.execute(mockFn)).rejects.toThrow()

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150))

      // Succeed 3 times to close circuit
      mockFn.mockResolvedValue('success')
      await breaker.execute(mockFn)
      expect(breaker.getState().successCount).toBe(1)

      await breaker.execute(mockFn)
      expect(breaker.getState().successCount).toBe(2)

      await breaker.execute(mockFn)
      expect(breaker.getState().successCount).toBe(0) // Reset after closing
      expect(breaker.getState().isOpen).toBe(false)
      expect(breaker.getState().failures).toBe(0)
      expect(onClose).toHaveBeenCalled()
    })

    it('should reopen circuit if failure occurs in half-open state', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 100,
      })
      const mockFn = vi.fn()

      // Open the circuit
      mockFn.mockRejectedValue(new Error('failure'))
      await expect(breaker.execute(mockFn)).rejects.toThrow()
      await expect(breaker.execute(mockFn)).rejects.toThrow()

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150))

      // Fail again in half-open state
      mockFn.mockRejectedValue(new Error('failure again'))
      await expect(breaker.execute(mockFn)).rejects.toThrow('failure again')

      expect(breaker.getState().failures).toBe(1)
      expect(breaker.getState().successCount).toBe(0)
    })
  })

  describe('reset', () => {
    it('should manually reset circuit to closed state', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 })
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'))

      // Open the circuit
      await expect(breaker.execute(mockFn)).rejects.toThrow()
      await expect(breaker.execute(mockFn)).rejects.toThrow()
      expect(breaker.getState().isOpen).toBe(true)

      // Manual reset
      breaker.reset()

      const state = breaker.getState()
      expect(state.isOpen).toBe(false)
      expect(state.failures).toBe(0)
      expect(state.successCount).toBe(0)
      expect(state.lastFailureTime).toBeUndefined()
      expect(state.nextAttemptTime).toBeUndefined()
    })
  })

  describe('callbacks', () => {
    it('should call onOpen callback when circuit opens', async () => {
      const onOpen = vi.fn()
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        onOpen,
      })
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'))

      await expect(breaker.execute(mockFn)).rejects.toThrow()
      expect(onOpen).not.toHaveBeenCalled()

      await expect(breaker.execute(mockFn)).rejects.toThrow()
      expect(onOpen).toHaveBeenCalledTimes(1)
    })

    it('should call onClose callback when circuit closes', async () => {
      const onClose = vi.fn()
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 100,
        onClose,
      })
      const mockFn = vi.fn()

      // Open circuit
      mockFn.mockRejectedValue(new Error('failure'))
      await expect(breaker.execute(mockFn)).rejects.toThrow()
      await expect(breaker.execute(mockFn)).rejects.toThrow()

      // Wait and succeed 3 times
      await new Promise(resolve => setTimeout(resolve, 150))
      mockFn.mockResolvedValue('success')

      await breaker.execute(mockFn)
      await breaker.execute(mockFn)
      expect(onClose).not.toHaveBeenCalled()

      await breaker.execute(mockFn)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onHalfOpen callback when entering half-open state', async () => {
      const onHalfOpen = vi.fn()
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 100,
        onHalfOpen,
      })
      const mockFn = vi.fn()

      // Open circuit
      mockFn.mockRejectedValue(new Error('failure'))
      await expect(breaker.execute(mockFn)).rejects.toThrow()
      await expect(breaker.execute(mockFn)).rejects.toThrow()

      // Wait and attempt
      await new Promise(resolve => setTimeout(resolve, 150))
      mockFn.mockResolvedValue('success')

      expect(onHalfOpen).not.toHaveBeenCalled()
      await breaker.execute(mockFn)
      expect(onHalfOpen).toHaveBeenCalledTimes(1)
    })
  })

  describe('getState', () => {
    it('should return a copy of state', () => {
      const breaker = new CircuitBreaker()
      const state1 = breaker.getState()
      const state2 = breaker.getState()

      expect(state1).toEqual(state2)
      expect(state1).not.toBe(state2) // Different objects
    })
  })
})
