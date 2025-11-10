/**
 * Mailgun Webhook Handler for Figma Comments
 *
 * Receives forwarded Figma comment emails from Mailgun, parses them,
 * creates discussion records, and triggers async processing.
 */

import crypto from 'node:crypto'
import { FigmaAdapter } from '../../../adapters/figma'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  console.log('[Mailgun Webhook] Received Figma comment email')

  try {
    // 1. Read and verify Mailgun signature
    const body = await readBody(event)

    console.log('[Mailgun Webhook] Request body keys:', Object.keys(body))

    if (!verifyMailgunSignature(body)) {
      console.error('[Mailgun Webhook] Invalid signature')
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Invalid Mailgun signature',
      })
    }

    console.log('[Mailgun Webhook] Signature verified')

    // 2. Parse email using Figma adapter
    const adapter = new FigmaAdapter()
    const discussion = await adapter.parseIncoming(body)

    console.log('[Mailgun Webhook] Parsed discussion:', {
      teamId: discussion.teamId,
      sourceThreadId: discussion.sourceThreadId,
      title: discussion.title.substring(0, 50),
      contentLength: discussion.content.length,
    })

    // 3. Resolve team ID from slug
    // TODO: This should query the teams table or use SuperSaaS connector
    // For now, we'll use the slug as-is and assume it matches a team ID
    const teamId = discussion.teamId

    if (!teamId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: `Team not found: ${discussion.teamId}`,
      })
    }

    console.log('[Mailgun Webhook] Using team ID:', teamId)

    // 4. Load source config for this team
    const db = useDb()
    const { discussionSyncSourceconfigs } = await import(
      '../../../../collections/sourceconfigs/server/database/schema'
    )

    const sourceConfigs = await db
      .select()
      .from(discussionSyncSourceconfigs)
      .where(
        and(
          eq(discussionSyncSourceconfigs.teamId, teamId),
          eq(discussionSyncSourceconfigs.active, true)
        )
      )
      .limit(1)

    const config = sourceConfigs[0]

    if (!config) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: `No active Figma config found for team: ${teamId}`,
      })
    }

    console.log('[Mailgun Webhook] Found config:', config.id)

    // 5. Check if discussion already exists (duplicate prevention)
    const { discussionSyncDiscussions } = await import(
      '../../../../collections/discussions/server/database/schema'
    )

    const existingDiscussions = await db
      .select()
      .from(discussionSyncDiscussions)
      .where(
        and(
          eq(discussionSyncDiscussions.sourceThreadId, discussion.sourceThreadId),
          eq(discussionSyncDiscussions.teamId, teamId)
        )
      )
      .limit(1)

    const existing = existingDiscussions[0]

    if (existing) {
      console.log('[Mailgun Webhook] Discussion already exists:', existing.id)
      return {
        success: true,
        discussionId: existing.id,
        duplicate: true,
        message: 'Discussion already exists',
      }
    }

    // 6. Create discussion record
    // Note: owner will be set to the creator's user ID
    // For now, we use the authorHandle and will resolve it later
    const [created] = await db
      .insert(discussionSyncDiscussions)
      .values({
        teamId,
        owner: discussion.authorHandle, // Will be mapped to user ID by processor
        sourceType: discussion.sourceType,
        sourceThreadId: discussion.sourceThreadId,
        sourceUrl: discussion.sourceUrl,
        sourceConfigId: config.id,
        title: discussion.title,
        content: discussion.content,
        authorHandle: discussion.authorHandle,
        participants: discussion.participants,
        status: 'pending',
        rawPayload: body,
        metadata: {
          ...discussion.metadata,
          // Preserve fileKey for later use
          fileKey: discussion.metadata.fileKey,
        },
        createdBy: discussion.authorHandle,
        updatedBy: discussion.authorHandle,
      })
      .returning()

    console.log('[Mailgun Webhook] Created discussion:', created.id)

    // 7. Trigger async processing (fire-and-forget)
    // We don't await this to return 200 OK immediately
    $fetch('/api/internal/process-discussion', {
      method: 'POST',
      body: {
        discussionId: created.id,
        retry: false,
      },
    }).catch((error) => {
      console.error('[Mailgun Webhook] Failed to trigger processing:', error)
      // Non-fatal - webhook still succeeds
      // The discussion is in the database and can be processed manually later
    })

    console.log('[Mailgun Webhook] Processing triggered, returning success')

    // 8. Return 200 OK immediately (don't wait for processing)
    return {
      success: true,
      discussionId: created.id,
      message: 'Discussion created and queued for processing',
    }
  }
  catch (error) {
    console.error('[Mailgun Webhook] Error:', error)

    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    // Otherwise, create a generic 500 error
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * Verify Mailgun webhook signature
 * See: https://documentation.mailgun.com/en/latest/user_manual.html#webhooks
 */
function verifyMailgunSignature(body: any): boolean {
  const config = useRuntimeConfig()
  const secret = config.mailgunWebhookSecret

  // In development, allow requests without signature verification
  if (!secret) {
    console.warn(
      '[Mailgun Webhook] No webhook secret configured - allowing request (development only)'
    )
    return true
  }

  // Extract signature fields
  const timestamp = body.timestamp
  const token = body.token
  const signature = body.signature

  if (!timestamp || !token || !signature) {
    console.error('[Mailgun Webhook] Missing signature fields:', {
      hasTimestamp: !!timestamp,
      hasToken: !!token,
      hasSignature: !!signature,
    })
    return false
  }

  // Verify timestamp is recent (within 15 minutes)
  const now = Math.floor(Date.now() / 1000)
  const age = now - Number.parseInt(timestamp, 10)

  if (age > 900) {
    // 15 minutes
    console.error('[Mailgun Webhook] Timestamp too old:', age, 'seconds')
    return false
  }

  // Compute expected signature
  const data = `${timestamp}${token}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')

  // Compare signatures
  const isValid = expectedSignature === signature

  if (!isValid) {
    console.error('[Mailgun Webhook] Signature mismatch:', {
      expected: expectedSignature.substring(0, 20) + '...',
      received: signature.substring(0, 20) + '...',
    })
  }

  return isValid
}
