/**
 * Slack Events API Webhook
 *
 * Handles incoming events from Slack including:
 * - URL verification challenges
 * - app_mention events
 * - Event signature verification
 * - Discussion creation and processing
 */

import { db } from '~/server/database'
import { discussionSyncDiscussions, discussionSyncSourceconfigs } from '~/server/database/schema'
import { eq } from 'drizzle-orm'
import { getAdapter } from '../../../adapters/base'
import { verifySlackSignature } from '../../../utils/slackSignature'

// Event types
interface SlackUrlVerificationEvent {
  type: 'url_verification'
  token: string
  challenge: string
}

interface SlackEventCallbackEvent {
  type: 'event_callback'
  token: string
  team_id: string
  api_app_id: string
  event: {
    type: string
    user: string
    text: string
    ts: string
    channel: string
    thread_ts?: string
    event_ts: string
  }
  event_id: string
  event_time: number
}

type SlackWebhookPayload = SlackUrlVerificationEvent | SlackEventCallbackEvent

export default defineEventHandler(async (event) => {
  console.log('[Slack Webhook] Received event')

  try {
    // 1. Get runtime config for Slack signing secret
    const config = useRuntimeConfig()
    const signingSecret = config.slackSigningSecret || config.public.slackSigningSecret

    if (!signingSecret) {
      console.error('[Slack Webhook] No signing secret configured')
      return createError({
        statusCode: 500,
        message: 'Slack signing secret not configured',
      })
    }

    // 2. Verify signature
    const timestamp = getHeader(event, 'x-slack-request-timestamp')
    const signature = getHeader(event, 'x-slack-signature')

    if (!timestamp || !signature) {
      console.warn('[Slack Webhook] Missing signature headers')
      return createError({
        statusCode: 401,
        message: 'Missing signature headers',
      })
    }

    // Read raw body for signature verification
    const rawBody = await readRawBody(event, 'utf-8')
    if (!rawBody) {
      console.warn('[Slack Webhook] No body received')
      return createError({
        statusCode: 400,
        message: 'No request body',
      })
    }

    // Verify signature (skip in development if needed)
    const isDevelopment = process.env.NODE_ENV === 'development'
    if (!isDevelopment) {
      const isValid = verifySlackSignature(rawBody, timestamp, signature, signingSecret)
      if (!isValid) {
        console.warn('[Slack Webhook] Invalid signature')
        return createError({
          statusCode: 401,
          message: 'Invalid signature',
        })
      }
    }
    else {
      console.warn('[Slack Webhook] ⚠️  Signature verification skipped (development mode)')
    }

    // 3. Parse payload
    const payload = JSON.parse(rawBody) as SlackWebhookPayload

    console.log('[Slack Webhook] Event type:', payload.type)

    // 4. Handle URL verification challenge
    if (payload.type === 'url_verification') {
      console.log('[Slack Webhook] Responding to URL verification challenge')
      return {
        challenge: payload.challenge,
      }
    }

    // 5. Handle event callbacks
    if (payload.type === 'event_callback') {
      const eventPayload = payload as SlackEventCallbackEvent

      // Only handle app_mention events
      if (eventPayload.event.type !== 'app_mention') {
        console.log('[Slack Webhook] Ignoring event type:', eventPayload.event.type)
        return { ok: true }
      }

      console.log('[Slack Webhook] Processing app_mention event')

      // 6. Check for duplicate event
      const eventId = eventPayload.event_id
      const isDuplicate = await checkDuplicateEvent(eventId)

      if (isDuplicate) {
        console.log('[Slack Webhook] Duplicate event detected, skipping:', eventId)
        return { ok: true }
      }

      // 7. Get adapter for Slack
      const adapter = getAdapter('slack')

      // 8. Parse incoming event
      const parsedDiscussion = await adapter.parseIncoming(eventPayload)

      console.log('[Slack Webhook] Discussion parsed:', {
        sourceThreadId: parsedDiscussion.sourceThreadId,
        teamId: parsedDiscussion.teamId,
      })

      // 9. Find matching source config
      // We need to find a Slack source config for this team/workspace
      const sourceConfigs = await db
        .select()
        .from(discussionSyncSourceconfigs)
        .where(eq(discussionSyncSourceconfigs.sourceId, 'slack'))
        .all()

      const matchingConfig = sourceConfigs.find(config => {
        // Match by workspace/team ID stored in metadata
        const workspaceId = config.metadata?.workspaceId
        return workspaceId === parsedDiscussion.teamId
      })

      if (!matchingConfig) {
        console.warn('[Slack Webhook] No matching source config found for workspace:', parsedDiscussion.teamId)
        return createError({
          statusCode: 404,
          message: 'No source configuration found for this workspace',
        })
      }

      console.log('[Slack Webhook] Found source config:', matchingConfig.id)

      // 10. Create discussion record
      const discussion = await db
        .insert(discussionSyncDiscussions)
        .values({
          teamId: matchingConfig.teamId,
          owner: matchingConfig.owner,
          sourceType: 'slack',
          sourceThreadId: parsedDiscussion.sourceThreadId,
          sourceUrl: parsedDiscussion.sourceUrl,
          sourceConfigId: matchingConfig.id,
          title: parsedDiscussion.title,
          content: parsedDiscussion.content,
          authorHandle: parsedDiscussion.authorHandle,
          participants: parsedDiscussion.participants,
          status: 'pending',
          metadata: {
            ...parsedDiscussion.metadata,
            // Store channel ID and message TS for later use
            channelId: eventPayload.event.channel,
            messageTs: eventPayload.event.ts,
            threadTs: eventPayload.event.thread_ts,
          },
          createdBy: 'slack-webhook',
          updatedBy: 'slack-webhook',
        })
        .returning()
        .get()

      console.log('[Slack Webhook] Discussion created:', discussion.id)

      // 11. Trigger async processing
      // Call the processor endpoint to handle the discussion
      try {
        await $fetch('/api/discussion-sync/process', {
          method: 'POST',
          body: {
            discussionId: discussion.id,
          },
        })

        console.log('[Slack Webhook] Processing triggered for discussion:', discussion.id)
      }
      catch (processingError) {
        console.error('[Slack Webhook] Failed to trigger processing:', processingError)
        // Don't fail the webhook - processing can be retried
      }

      // 12. Return success
      return {
        ok: true,
        discussionId: discussion.id,
      }
    }

    // Unknown event type
    console.warn('[Slack Webhook] Unknown event type:', payload.type)
    return { ok: true }
  }
  catch (error) {
    console.error('[Slack Webhook] Error processing webhook:', error)

    return createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * Check if an event has already been processed
 *
 * This prevents duplicate processing of the same event.
 * Slack may send the same event multiple times.
 */
async function checkDuplicateEvent(eventId: string): Promise<boolean> {
  try {
    // Check if we've seen this event ID before
    // You could store this in KV store or database
    // For now, we'll just check if a discussion exists with this event ID

    const existing = await db
      .select()
      .from(discussionSyncDiscussions)
      .where(eq(discussionSyncDiscussions.metadata, { eventId }))
      .get()

    return !!existing
  }
  catch (error) {
    console.error('[Slack Webhook] Error checking for duplicates:', error)
    return false
  }
}
