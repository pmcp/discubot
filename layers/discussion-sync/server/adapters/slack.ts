/**
 * Slack Adapter - Implements DiscussionSourceAdapter for Slack
 *
 * Handles parsing Slack Events API payloads, fetching threads from Slack API,
 * posting replies, and updating status with emoji reactions.
 */

import { SlackService } from '../services/slack'
import { getDecryptedApiToken } from '../utils/encryptedConfig'
import type {
  DiscussionSourceAdapter,
  ParsedDiscussion,
  DiscussionThread,
  ThreadMessage,
  DiscussionStatus,
  SourceConfig,
  ValidationResult,
} from './base'

// Slack Event Types
interface SlackAppMentionEvent {
  type: 'app_mention'
  user: string
  text: string
  ts: string
  channel: string
  thread_ts?: string
  event_ts: string
}

interface SlackEventPayload {
  token: string
  team_id: string
  api_app_id: string
  event: SlackAppMentionEvent
  type: 'event_callback'
  event_id: string
  event_time: number
}

export class SlackAdapter implements DiscussionSourceAdapter {
  sourceType = 'slack' as const

  private slackService: SlackService | null = null

  /**
   * Parse incoming Slack Events API payload
   */
  async parseIncoming(payload: SlackEventPayload): Promise<ParsedDiscussion> {
    console.log('[Slack Adapter] Parsing incoming event payload')

    try {
      // 1. Validate payload structure
      if (!payload.event || payload.event.type !== 'app_mention') {
        throw new Error('[Slack Adapter] Invalid event type, expected app_mention')
      }

      const event = payload.event

      if (!event.channel || !event.ts) {
        throw new Error('[Slack Adapter] Missing required event fields (channel, ts)')
      }

      console.log('[Slack Adapter] Event metadata:', {
        channel: event.channel,
        ts: event.ts,
        threadTs: event.thread_ts,
        user: event.user,
        textPreview: event.text.substring(0, 50),
      })

      // 2. Extract team from payload
      const teamId = payload.team_id

      if (!teamId) {
        throw new Error('[Slack Adapter] No team_id found in payload')
      }

      // 3. Determine thread ID
      // If this is a threaded reply, use thread_ts, otherwise use ts
      const sourceThreadId = event.thread_ts || event.ts

      console.log('[Slack Adapter] Source thread ID:', sourceThreadId)

      // 4. Build source URL
      // Format: https://workspace.slack.com/archives/C123ABC/p1234567890123456
      const sourceUrl = this.buildSlackUrl(teamId, event.channel, sourceThreadId)

      // 5. Clean the mention text from the message
      const content = this.cleanMentionText(event.text)

      // 6. Build parsed discussion
      const parsedDiscussion: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId,
        sourceUrl,
        teamId, // Slack team ID
        authorHandle: event.user, // Slack user ID
        title: `Slack message from <@${event.user}>`,
        content,
        participants: [event.user],
        timestamp: new Date(event.event_ts ? Number(event.event_ts) * 1000 : Date.now()),
        metadata: {
          channelId: event.channel,
          messageTs: event.ts,
          threadTs: event.thread_ts,
          workspaceId: teamId,
          eventId: payload.event_id,
          rawEvent: event,
        },
      }

      console.log('[Slack Adapter] Created parsed discussion:', {
        sourceThreadId: parsedDiscussion.sourceThreadId,
        teamId: parsedDiscussion.teamId,
        title: parsedDiscussion.title,
      })

      return parsedDiscussion
    }
    catch (error) {
      console.error('[Slack Adapter] Failed to parse incoming payload:', error)
      throw error
    }
  }

  /**
   * Fetch full thread from Slack API
   */
  async fetchThread(threadId: string, config: SourceConfig): Promise<DiscussionThread> {
    console.log('[Slack Adapter] Fetching thread:', threadId)

    try {
      const service = await this.getService(config)

      // Extract channel ID from metadata (stored during parseIncoming)
      const channelId = config.metadata?.channelId as string

      if (!channelId) {
        throw new Error('[Slack Adapter] Channel ID not found in config metadata')
      }

      console.log('[Slack Adapter] Using channel:', channelId)

      // Fetch thread from Slack
      const slackThread = await service.getThread(channelId, threadId)

      // Convert to standardized thread format
      const messages: ThreadMessage[] = slackThread.messages.map(msg => ({
        id: msg.ts,
        authorHandle: msg.user,
        content: msg.text,
        timestamp: new Date(Number.parseFloat(msg.ts) * 1000),
      }))

      const rootMessage = messages[0]
      if (!rootMessage) {
        throw new Error('[Slack Adapter] No messages found in thread')
      }

      const replies = messages.slice(1)

      // Extract unique participants
      const participants = [...new Set(messages.map(m => m.authorHandle))]

      const thread: DiscussionThread = {
        id: threadId,
        rootMessage,
        replies,
        participants,
        metadata: {
          channelId,
          channelName: slackThread.metadata.channelName,
          channelType: slackThread.metadata.channelType,
          hasMore: slackThread.hasMore,
        },
      }

      console.log('[Slack Adapter] Thread fetched successfully:', {
        id: thread.id,
        rootMessageContent: thread.rootMessage.content.substring(0, 50),
        repliesCount: thread.replies.length,
        participantsCount: thread.participants.length,
      })

      return thread
    }
    catch (error) {
      console.error('[Slack Adapter] Failed to fetch thread:', error)
      throw error
    }
  }

  /**
   * Post a reply to a Slack thread
   */
  async postReply(
    threadId: string,
    message: string,
    config: SourceConfig
  ): Promise<boolean> {
    console.log('[Slack Adapter] Posting reply to thread:', threadId)

    try {
      if (!config.postConfirmation) {
        console.log('[Slack Adapter] Post confirmation disabled, skipping reply')
        return false
      }

      const service = await this.getService(config)

      // Extract channel ID from metadata
      const channelId = config.metadata?.channelId as string

      if (!channelId) {
        throw new Error('[Slack Adapter] Channel ID not found in config metadata')
      }

      // Post the message to the thread
      const messageTs = await service.postMessage(channelId, message, threadId)

      console.log('[Slack Adapter] Reply posted successfully:', messageTs)
      return true
    }
    catch (error) {
      console.error('[Slack Adapter] Failed to post reply:', error)
      throw error
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
    console.log('[Slack Adapter] Updating status to:', status)

    try {
      const service = await this.getService(config)

      // Extract channel ID and message TS from metadata
      const channelId = config.metadata?.channelId as string
      const messageTs = config.metadata?.messageTs as string

      if (!channelId || !messageTs) {
        throw new Error('[Slack Adapter] Channel ID or message TS not found in metadata')
      }

      // Map status to emoji reactions
      const statusEmojis: Record<DiscussionStatus, string> = {
        pending: 'clock',
        processing: 'hourglass_flowing_sand',
        completed: 'white_check_mark',
        failed: 'x',
      }

      const emoji = statusEmojis[status]

      if (!emoji) {
        console.warn('[Slack Adapter] Unknown status:', status)
        return false
      }

      // Remove previous status reactions
      const previousEmojis = Object.values(statusEmojis).filter(e => e !== emoji)
      for (const prevEmoji of previousEmojis) {
        try {
          await service.removeReaction(channelId, messageTs, prevEmoji)
        }
        catch (error) {
          // Ignore errors when removing reactions that don't exist
          console.log('[Slack Adapter] Could not remove reaction:', prevEmoji)
        }
      }

      // Add new status reaction
      await service.addReaction(channelId, messageTs, emoji)

      console.log('[Slack Adapter] Status updated with emoji:', emoji)
      return true
    }
    catch (error) {
      console.error('[Slack Adapter] Failed to update status:', error)
      throw error
    }
  }

  /**
   * Validate source configuration
   */
  async validateConfig(config: SourceConfig): Promise<ValidationResult> {
    const errors: string[] = []

    // Check required fields
    if (!config.apiToken) {
      errors.push('Slack bot token is required')
    }

    if (!config.notionToken) {
      errors.push('Notion API token is required')
    }

    if (!config.notionDatabaseId) {
      errors.push('Notion database ID is required')
    }

    // Test API connection if token is provided
    if (config.apiToken && errors.length === 0) {
      try {
        const service = await this.getService(config)
        const connected = await service.testConnection()

        if (!connected) {
          errors.push('Failed to connect to Slack API - check your bot token')
        }
      }
      catch (error) {
        errors.push(`Slack API connection test failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Test connection to Slack API
   */
  async testConnection(config: SourceConfig): Promise<boolean> {
    console.log('[Slack Adapter] Testing connection')

    try {
      const service = await this.getService(config)
      const connected = await service.testConnection()

      console.log('[Slack Adapter] Connection test result:', connected)
      return connected
    }
    catch (error) {
      console.error('[Slack Adapter] Connection test failed:', error)
      return false
    }
  }

  /**
   * Get or create Slack service instance
   */
  private async getService(config: SourceConfig): Promise<SlackService> {
    // Decrypt API token
    const apiToken = await getDecryptedApiToken(config)

    if (!apiToken) {
      throw new Error('[Slack Adapter] API token not found in source config')
    }

    // Reuse service if token hasn't changed
    if (!this.slackService) {
      this.slackService = new SlackService(apiToken)
    }

    return this.slackService
  }

  /**
   * Build Slack deep link URL
   */
  private buildSlackUrl(teamId: string, channelId: string, messageTs: string): string {
    // Convert timestamp to Slack's URL format (remove decimal point)
    const urlTs = messageTs.replace('.', '')
    return `https://slack.com/app_redirect?team=${teamId}&channel=${channelId}&message=${urlTs}`
  }

  /**
   * Clean bot mention from message text
   */
  private cleanMentionText(text: string): string {
    // Remove bot mentions like <@U123ABC>
    return text
      .replace(/<@[A-Z0-9]+>/gi, '')
      .trim()
  }
}
