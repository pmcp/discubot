/**
 * Circuit breaker utility to prevent cascading failures
 * Used to wrap external API calls (AI, Notion, etc.)
 */

export interface CircuitBreakerOptions {
  failureThreshold?: number // Number of failures before opening circuit
  resetTimeout?: number // Time in ms before attempting to close circuit
  monitoringPeriod?: number // Time window for tracking failures
  onOpen?: () => void // Callback when circuit opens
  onClose?: () => void // Callback when circuit closes
  onHalfOpen?: () => void // Callback when circuit enters half-open state
}

export interface CircuitBreakerState {
  isOpen: boolean
  failures: number
  successCount: number
  lastFailureTime?: number
  nextAttemptTime?: number
}

export class CircuitBreaker {
  private state: CircuitBreakerState
  private readonly options: Required<CircuitBreakerOptions>
  private readonly defaultOptions: Required<CircuitBreakerOptions> = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringPeriod: 10000, // 10 seconds
    onOpen: () => {},
    onClose: () => {},
    onHalfOpen: () => {},
  }

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options }
    this.state = {
      isOpen: false,
      failures: 0,
      successCount: 0,
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state.isOpen) {
      if (this.canAttemptReset()) {
        this.halfOpen()
      }
      else {
        throw new Error('Circuit breaker is OPEN - service unavailable')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    }
    catch (error) {
      this.onFailure()
      throw error
    }
  }

  private canAttemptReset(): boolean {
    if (!this.state.nextAttemptTime)
      return false
    return Date.now() >= this.state.nextAttemptTime
  }

  private halfOpen(): void {
    this.state.isOpen = false
    this.state.failures = 0
    this.options.onHalfOpen()
  }

  private onSuccess(): void {
    if (this.state.failures > 0 || this.state.isOpen) {
      this.state.failures = 0
      this.state.successCount++

      if (this.state.successCount >= 3) {
        this.close()
      }
    }
  }

  private onFailure(): void {
    this.state.failures++
    this.state.lastFailureTime = Date.now()
    this.state.successCount = 0

    if (this.state.failures >= this.options.failureThreshold) {
      this.open()
    }
  }

  private open(): void {
    this.state.isOpen = true
    this.state.nextAttemptTime = Date.now() + this.options.resetTimeout
    this.options.onOpen()

    console.error(`Circuit breaker opened. Will retry after ${new Date(this.state.nextAttemptTime).toISOString()}`)
  }

  private close(): void {
    this.state.isOpen = false
    this.state.failures = 0
    this.state.successCount = 0
    this.state.lastFailureTime = undefined
    this.state.nextAttemptTime = undefined
    this.options.onClose()
  }

  getState(): CircuitBreakerState {
    return { ...this.state }
  }

  reset(): void {
    this.close()
  }
}
