/**
 * Slack Signature Verification
 *
 * Verifies that webhook requests are actually from Slack using HMAC SHA256 signatures.
 * Implements Slack's signature verification protocol with timestamp replay protection.
 *
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verify Slack request signature
 *
 * @param body - Raw request body as string
 * @param timestamp - Request timestamp from X-Slack-Request-Timestamp header
 * @param signature - Request signature from X-Slack-Signature header
 * @param secret - Slack signing secret from app settings
 * @returns True if signature is valid, false otherwise
 */
export function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  try {
    // 1. Validate timestamp to prevent replay attacks
    // Slack recommends rejecting requests older than 5 minutes
    const currentTime = Math.floor(Date.now() / 1000)
    const requestTime = Number.parseInt(timestamp, 10)

    if (Number.isNaN(requestTime)) {
      console.warn('[Slack Signature] Invalid timestamp format:', timestamp)
      return false
    }

    const timeDiff = Math.abs(currentTime - requestTime)
    const FIVE_MINUTES = 60 * 5

    if (timeDiff > FIVE_MINUTES) {
      console.warn('[Slack Signature] Request timestamp is too old:', {
        requestTime,
        currentTime,
        diff: timeDiff,
      })
      return false
    }

    // 2. Construct the base string
    // Format: v0:<timestamp>:<request_body>
    const baseString = `v0:${timestamp}:${body}`

    // 3. Compute the expected signature using HMAC SHA256
    const hmac = createHmac('sha256', secret)
    hmac.update(baseString)
    const computedSignature = `v0=${hmac.digest('hex')}`

    // 4. Compare signatures using timing-safe comparison
    // This prevents timing attacks
    if (signature.length !== computedSignature.length) {
      console.warn('[Slack Signature] Signature length mismatch')
      return false
    }

    const signatureBuffer = Buffer.from(signature, 'utf8')
    const computedBuffer = Buffer.from(computedSignature, 'utf8')

    const isValid = timingSafeEqual(signatureBuffer, computedBuffer)

    if (!isValid) {
      console.warn('[Slack Signature] Signature verification failed:', {
        expected: computedSignature.substring(0, 20) + '...',
        received: signature.substring(0, 20) + '...',
      })
    }

    return isValid
  }
  catch (error) {
    console.error('[Slack Signature] Verification error:', error)
    return false
  }
}

/**
 * Verify Slack request from H3 event
 *
 * This is a convenience function for Nuxt/H3 applications that extracts
 * the necessary headers and body from the event object.
 */
export async function verifySlackRequest(
  event: any,
  secret: string
): Promise<boolean> {
  try {
    // Extract headers
    const headers = event.headers || event.node?.req?.headers || {}
    const timestamp = headers['x-slack-request-timestamp']
    const signature = headers['x-slack-signature']

    if (!timestamp || !signature) {
      console.warn('[Slack Signature] Missing required headers:', {
        hasTimestamp: !!timestamp,
        hasSignature: !!signature,
      })
      return false
    }

    // Get raw body
    // For H3/Nuxt, we need to read the raw body before it's parsed
    const body = await readRawBody(event)

    if (!body) {
      console.warn('[Slack Signature] No request body found')
      return false
    }

    return verifySlackSignature(body, timestamp, signature, secret)
  }
  catch (error) {
    console.error('[Slack Signature] Request verification error:', error)
    return false
  }
}

/**
 * Read raw body from H3 event
 *
 * This reads the raw request body as a string, which is required for
 * signature verification (we need the exact bytes that were sent).
 */
async function readRawBody(event: any): Promise<string | null> {
  try {
    // Try to get the raw body from the event
    if (event._rawBody) {
      return event._rawBody
    }

    // Try to read from the request stream
    if (event.node?.req) {
      const chunks: Buffer[] = []
      return new Promise((resolve, reject) => {
        event.node.req.on('data', (chunk: Buffer) => chunks.push(chunk))
        event.node.req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        event.node.req.on('error', reject)
      })
    }

    return null
  }
  catch (error) {
    console.error('[Slack Signature] Error reading raw body:', error)
    return null
  }
}

/**
 * Development mode: Skip signature verification
 *
 * In development, you can use this to bypass signature verification.
 * NEVER use this in production!
 */
export function allowInDevelopment(isProduction: boolean): boolean {
  if (!isProduction) {
    console.warn('[Slack Signature] ⚠️  Signature verification bypassed (development mode)')
    return true
  }
  return false
}
