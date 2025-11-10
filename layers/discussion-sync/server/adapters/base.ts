/**
 * Base adapter interface for discussion sources
 * All discussion sources (Figma, Slack, etc.) must implement this interface
 */

// ============================================
// TYPES
// ============================================

export type DiscussionStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ParsedDiscussion {
  sourceType: string
  sourceThreadId: string // Unique ID in source system
  sourceUrl: string // Deep link to discussion
  teamId: string // Resolved team ID
  authorHandle: string // User who created
  title: string // Subject/title
  content: string // Main content
  participants: string[] // All participants
  timestamp: Date
  metadata: Record<string, unknown> // Source-specific data
}

export interface ThreadMessage {
  id: string
  authorHandle: string
  content: string
  timestamp: Date
  attachments?: Attachment[]
}

export interface Attachment {
  id: string
  type: 'image' | 'file' | 'link'
  url: string
  name?: string
  mimeType?: string
}

export interface DiscussionThread {
  id: string
  rootMessage: ThreadMessage
  replies: ThreadMessage[]
  participants: string[]
  metadata: Record<string, unknown>
}

export interface SourceConfig {
  id: string
  sourceId: string
  name: string
  apiToken?: string
  notionToken: string
  notionDatabaseId: string
  notionFieldMapping?: Record<string, unknown>
  anthropicApiKey?: string
  aiEnabled: boolean
  aiSummaryPrompt?: string
  aiTaskPrompt?: string
  autoSync: boolean
  postConfirmation: boolean
  active: boolean
  metadata?: Record<string, unknown>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// ============================================
// ADAPTER INTERFACE
// ============================================

export interface DiscussionSourceAdapter {
  /**
   * Unique identifier for this source type
   * Examples: 'figma', 'slack', 'linear', 'github'
   */
  sourceType: string

  /**
   * Parse incoming webhook/email payload into standardized format
   * This is called when a webhook is received from the source
   */
  parseIncoming(payload: any): Promise<ParsedDiscussion>

  /**
   * Fetch full thread details from source
   * This is called to build the complete discussion thread
   */
  fetchThread(threadId: string, config: SourceConfig): Promise<DiscussionThread>

  /**
   * Post a reply back to the source
   * This is called to post confirmation messages
   */
  postReply(
    threadId: string,
    message: string,
    config: SourceConfig
  ): Promise<boolean>

  /**
   * Update status indicators (reactions, emoji, status field)
   * This is called to update visual status in the source
   */
  updateStatus(
    threadId: string,
    status: DiscussionStatus,
    config: SourceConfig
  ): Promise<boolean>

  /**
   * Validate source configuration
   * This is called when a team sets up a new source config
   */
  validateConfig(config: SourceConfig): Promise<ValidationResult>

  /**
   * Health check - test connection to source API
   * This is called to verify API credentials are valid
   */
  testConnection(config: SourceConfig): Promise<boolean>
}

// ============================================
// ADAPTER REGISTRY
// ============================================

type AdapterClass = new () => DiscussionSourceAdapter

const adapters: Map<string, AdapterClass> = new Map()

/**
 * Register a discussion source adapter
 */
export function registerAdapter(
  sourceType: string,
  AdapterClass: AdapterClass
) {
  adapters.set(sourceType, AdapterClass)
}

/**
 * Get an adapter instance for a source type
 */
export function getAdapter(sourceType: string): DiscussionSourceAdapter {
  const AdapterClass = adapters.get(sourceType)
  if (!AdapterClass) {
    const availableTypes = Array.from(adapters.keys())
    throw new Error(
      `No adapter registered for source type: ${sourceType}. ` +
      `Available adapters: ${availableTypes.length > 0 ? availableTypes.join(', ') : 'none'}`,
    )
  }
  return new AdapterClass()
}

/**
 * Check if an adapter is registered for a source type
 */
export function hasAdapter(sourceType: string): boolean {
  return adapters.has(sourceType)
}

/**
 * Get all registered source types
 */
export function getRegisteredSourceTypes(): string[] {
  return Array.from(adapters.keys())
}
