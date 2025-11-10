/**
 * Figma Adapter - Implements DiscussionSourceAdapter for Figma
 *
 * Handles parsing Mailgun email payloads, fetching threads from Figma API,
 * posting replies, and updating status with emoji reactions.
 */

import { FigmaService } from '../services/figma'
import { EmailParser } from '../utils/emailParser'
import { getDecryptedApiToken } from '../utils/encryptedConfig'
import type {
  DiscussionSourceAdapter,
  ParsedDiscussion,
  DiscussionThread,
  DiscussionStatus,
  SourceConfig,
  ValidationResult,
} from './base'

export class FigmaAdapter implements DiscussionSourceAdapter {
  sourceType = 'figma' as const

  private figmaService: FigmaService | null = null
  private emailParser: EmailParser

  constructor() {
    this.emailParser = new EmailParser()
  }

  /**
   * Parse incoming Mailgun email payload
   */
  async parseIncoming(payload: any): Promise<ParsedDiscussion> {
    console.log('[Figma Adapter] Parsing incoming email payload')

    try {
      // 1. Extract email data from Mailgun payload
      const html = payload['body-html'] || payload.html
      const fromEmail = payload.From || payload.from || payload.sender
      const subject = payload.Subject || payload.subject
      const recipient = payload.To || payload.to || payload.recipient

      if (!html) {
        throw new Error('[Figma Adapter] No HTML body found in email payload')
      }

      if (!fromEmail) {
        throw new Error('[Figma Adapter] No sender email found in payload')
      }

      console.log('[Figma Adapter] Email metadata:', {
        from: fromEmail,
        to: recipient,
        subject,
        htmlLength: html.length,
      })

      // 2. Parse email using email parser
      const parseResult = await this.emailParser.parse(html, fromEmail)

      if (!parseResult.success || !parseResult.data) {
        throw new Error(
          `[Figma Adapter] Failed to parse email: ${parseResult.error || 'Unknown error'}`
        )
      }

      const data = parseResult.data

      console.log('[Figma Adapter] Email parsed successfully:', {
        fileKey: data.fileKey,
        commentId: data.commentId,
        commentPreview: data.commentText.substring(0, 50),
      })

      // 3. Extract team from recipient email
      // Format: team-slug@comments.yourdomain.com → team-slug
      const teamSlug = this.extractTeamSlug(recipient || '')

      console.log('[Figma Adapter] Extracted team slug:', teamSlug)

      // 4. Build parsed discussion
      const parsedDiscussion: ParsedDiscussion = {
        sourceType: 'figma',
        sourceThreadId: data.commentId || data.fileKey, // Use commentId if available, else fileKey
        sourceUrl: data.figmaUrl,
        teamId: teamSlug, // Will be resolved to actual team ID by webhook handler
        authorHandle: data.authorEmail,
        title: subject || `Comment on ${data.fileName}`,
        content: data.commentText,
        participants: [data.authorEmail],
        timestamp: new Date(),
        metadata: {
          fileKey: data.fileKey,
          fileName: data.fileName,
          authorName: data.authorName,
          authorEmail: data.authorEmail,
          commentId: data.commentId,
          parseStrategy: parseResult.strategy,
          rawPayload: payload,
        },
      }

      console.log('[Figma Adapter] Created parsed discussion:', {
        sourceThreadId: parsedDiscussion.sourceThreadId,
        teamId: parsedDiscussion.teamId,
        title: parsedDiscussion.title,
      })

      return parsedDiscussion
    }
    catch (error) {
      console.error('[Figma Adapter] Failed to parse incoming payload:', error)
      throw error
    }
  }

  /**
   * Fetch full thread from Figma API
   */
  async fetchThread(threadId: string, config: SourceConfig): Promise<DiscussionThread> {
    console.log('[Figma Adapter] Fetching thread:', threadId)

    try {
      const service = await this.getService(config)

      // Extract fileKey from metadata (stored during parseIncoming)
      const fileKey = config.metadata?.fileKey as string

      if (!fileKey) {
        throw new Error('[Figma Adapter] File key not found in config metadata')
      }

      console.log('[Figma Adapter] Using file key:', fileKey)

      // Build thread using Figma service
      // threadId might be a comment ID or the root comment ID
      const thread = await service.buildThread(fileKey, threadId)

      console.log('[Figma Adapter] Thread fetched successfully:', {
        id: thread.id,
        rootMessageContent: thread.rootMessage.content.substring(0, 50),
        repliesCount: thread.replies.length,
        participantsCount: thread.participants.length,
      })

      return thread
    }
    catch (error) {
      console.error('[Figma Adapter] Failed to fetch thread:', error)
      throw error
    }
  }

  /**
   * Post confirmation message back to Figma
   */
  async postReply(
    threadId: string,
    message: string,
    config: SourceConfig
  ): Promise<boolean> {
    console.log('[Figma Adapter] Posting reply to thread:', threadId)

    try {
      const service = await this.getService(config)
      const fileKey = config.metadata?.fileKey as string

      if (!fileKey) {
        console.warn('[Figma Adapter] Cannot post reply without file key')
        return false
      }

      console.log('[Figma Adapter] Posting to file:', fileKey)

      await service.postComment(fileKey, threadId, message)

      console.log('[Figma Adapter] Reply posted successfully')

      return true
    }
    catch (error) {
      console.error('[Figma Adapter] Failed to post reply:', error)
      return false
    }
  }

  /**
   * Update status using emoji reactions
   */
  async updateStatus(
    threadId: string,
    status: DiscussionStatus,
    config: SourceConfig
  ): Promise<boolean> {
    console.log('[Figma Adapter] Updating status:', {
      threadId,
      status,
    })

    try {
      const service = await this.getService(config)
      const fileKey = config.metadata?.fileKey as string

      if (!fileKey) {
        console.warn('[Figma Adapter] Cannot update status without file key')
        return false
      }

      const emoji = this.statusToEmoji(status)

      console.log('[Figma Adapter] Using emoji:', emoji)

      // If not pending, remove the processing emoji first
      if (status !== 'pending' && status !== 'processing') {
        await service.updateReaction(fileKey, threadId, '👀', emoji)
      }
      else {
        await service.addReaction(fileKey, threadId, emoji)
      }

      console.log('[Figma Adapter] Status updated successfully')

      return true
    }
    catch (error) {
      console.error('[Figma Adapter] Failed to update status:', error)
      return false
    }
  }

  /**
   * Validate Figma configuration
   */
  async validateConfig(config: SourceConfig): Promise<ValidationResult> {
    console.log('[Figma Adapter] Validating config')

    const errors: string[] = []

    // Check for API token
    if (!config.apiToken) {
      errors.push('Figma API token is required')
    }

    // Check for Notion configuration (required for all adapters)
    if (!config.notionToken) {
      errors.push('Notion API token is required')
    }

    if (!config.notionDatabaseId) {
      errors.push('Notion database ID is required')
    }

    // Test connection if we have a token
    if (config.apiToken) {
      try {
        const service = new FigmaService(config.apiToken)
        const connectionOk = await service.testConnection()

        if (!connectionOk) {
          errors.push('Figma API connection test failed')
        }
      }
      catch (error) {
        errors.push(
          `Figma API connection failed: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    const valid = errors.length === 0

    console.log('[Figma Adapter] Validation result:', {
      valid,
      errorsCount: errors.length,
    })

    return {
      valid,
      errors,
    }
  }

  /**
   * Test connection to Figma API
   */
  async testConnection(config: SourceConfig): Promise<boolean> {
    console.log('[Figma Adapter] Testing connection')

    try {
      const service = await this.getService(config)
      const result = await service.testConnection()

      console.log('[Figma Adapter] Connection test result:', result)

      return result
    }
    catch (error) {
      console.error('[Figma Adapter] Connection test failed:', error)
      return false
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Get or create Figma service instance
   */
  private async getService(config: SourceConfig): Promise<FigmaService> {
    // Decrypt API token
    const apiToken = await getDecryptedApiToken(config)

    if (!apiToken) {
      throw new Error('[Figma Adapter] API token is required in config')
    }

    // Create a new service instance each time to ensure fresh config
    // (service instances are lightweight and cache internally)
    return new FigmaService(apiToken)
  }

  /**
   * Extract team slug from recipient email
   * Format: team-slug@comments.domain.com → team-slug
   */
  private extractTeamSlug(email: string): string {
    if (!email) {
      console.warn('[Figma Adapter] No email provided for team extraction')
      return 'default'
    }

    // Extract everything before the @ sign
    const match = email.match(/^([^@]+)@/)

    if (!match || !match[1]) {
      console.warn('[Figma Adapter] Could not extract team slug from email:', email)
      return 'default'
    }

    return match[1]
  }

  /**
   * Convert discussion status to emoji
   */
  private statusToEmoji(status: DiscussionStatus): string {
    const emojiMap: Record<DiscussionStatus, string> = {
      pending: '👀',
      processing: '👀',
      completed: '✅',
      failed: '❌',
    }

    return emojiMap[status]
  }
}
