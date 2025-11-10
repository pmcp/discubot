# Discussion Sync v2.0 - Phase 3 Implementation Briefing

**Project:** discubot - Discussion-to-Notion Synchronization System
**Date:** 2025-11-10
**Current Status:** Phase 2 Complete (Core Services), Phase 3 Ready to Start
**Overall Completion:** ~50%

---

## What Was Just Completed ✅

### Phase 2: Core Services (100% Complete)

All core services are implemented and tested:

1. ✅ **NotionService** - Task creation, field mapping, duplicate detection, pagination, retry logic
2. ✅ **ProcessorService** - 7-stage pipeline with job tracking and retry
3. ✅ **Background API** - Async processing endpoint
4. ✅ **44 comprehensive tests** - Unit tests for all services
5. ✅ **Documentation** - Complete usage guide and API reference

**Files Created:**
- `layers/discussion-sync/server/services/notion.ts` (689 lines)
- `layers/discussion-sync/server/services/processor.ts` (525 lines)
- `layers/discussion-sync/server/api/internal/process-discussion.post.ts` (71 lines)
- Comprehensive test files and documentation

---

## What Needs To Be Done Next ❌

### Phase 3: Figma Integration (Priority: HIGH)

Figma integration is the first concrete adapter implementation. It uses **email-based webhooks** via Mailgun.

#### Architecture Overview

```
Figma Comment → Email → Mailgun → Webhook → Parser → Discussion → Processor → Notion → Reply
```

**Flow:**
1. Designer adds comment in Figma
2. Figma sends email to team-specific address: `team-slug@yourdomain.com`
3. Mailgun forwards email to webhook
4. Email parser extracts comment data
5. Creates discussion record
6. Triggers async processing
7. Processor fetches full thread from Figma API
8. AI analyzes, creates Notion task
9. Posts confirmation back to Figma comment

---

## Phase 3 Components

### 3.1 Email Parser Utility - HIGH PRIORITY ⚠️

**Target File:** `layers/discussion-sync/server/utils/emailParser.ts`

**Reference Implementation:** `/Users/pmcp/Projects/fyit-tools/layers/figno/server/utils/emailParser.ts`

**Purpose:** Extract Figma comment data from HTML emails

**Code Smells in Reference (MUST FIX while porting):**

1. **Line 45** - Uses `any` type for parsed data (should be `unknown`)
2. **Lines 89-124** - `extractCommentText()` is 35 lines long with nested loops
3. **Lines 156-183** - Magic strings scattered throughout ("View comment", "design file", etc.)
4. **Line 203** - Silent failures in fallback parsing
5. **No error context** - Errors don't include original HTML for debugging
6. **Multiple strategies** - Could be refactored into strategy pattern

**Required Improvements:**

1. **Extract Constants**
   ```typescript
   const EMAIL_PATTERNS = {
     COMMENT_MARKERS: ['View comment', 'View in Figma'],
     FILE_MARKERS: ['design file', 'Figma file'],
     URL_PATTERN: /https:\/\/www\.figma\.com\/file\/([a-zA-Z0-9]+)/g,
     COMMENT_ID_PATTERN: /comment-id=([0-9-]+)/,
   } as const
   ```

2. **Type Safety**
   ```typescript
   interface FigmaEmailData {
     commentText: string
     fileKey: string
     commentId: string
     fileName: string
     authorEmail: string
     authorName: string
     figmaUrl: string
     metadata: Record<string, unknown>
   }

   interface ParseResult {
     success: boolean
     data?: FigmaEmailData
     error?: string
     strategy?: string  // Which parsing strategy worked
   }
   ```

3. **Strategy Pattern**
   ```typescript
   class EmailParserStrategy {
     abstract parse(html: string, $: CheerioAPI): FigmaEmailData | null
   }

   class StructuredContentStrategy extends EmailParserStrategy { ... }
   class LinkExtractionStrategy extends EmailParserStrategy { ... }
   class FallbackStrategy extends EmailParserStrategy { ... }
   ```

4. **Better Error Handling**
   ```typescript
   try {
     const data = strategy.parse(html, $)
     if (!data) {
       throw new Error('[Email Parser] Strategy failed to extract data')
     }
     return { success: true, data, strategy: strategy.name }
   } catch (error) {
     console.error('[Email Parser] Parse failed:', {
       error: error.message,
       htmlPreview: html.substring(0, 200),
       strategy: strategy.name
     })
     // Try next strategy
   }
   ```

**Required Methods:**

```typescript
export class EmailParser {
  /**
   * Parse Figma comment email HTML
   */
  parse(html: string, fromEmail: string): Promise<ParseResult>

  /**
   * Validate parsed data is complete
   */
  private validate(data: Partial<FigmaEmailData>): FigmaEmailData | null

  /**
   * Extract comment text from HTML
   */
  private extractCommentText($: CheerioAPI): string | null

  /**
   * Extract file key from URLs
   */
  private extractFileKey($: CheerioAPI): string | null

  /**
   * Extract comment ID from URLs
   */
  private extractCommentId($: CheerioAPI): string | null

  /**
   * Extract author info from email headers
   */
  private extractAuthor(fromEmail: string): { name: string; email: string }
}
```

**Dependencies:**
- `cheerio` (already installed)

**Test Cases Required:**
- ✅ Parse structured Figma email (typical case)
- ✅ Parse email with multiple comments (only extract first)
- ✅ Parse email with missing file key (should fail gracefully)
- ✅ Parse email with malformed HTML (fallback strategies)
- ✅ Extract author from various email formats
- ✅ Validate data completeness

---

### 3.2 Figma Service - HIGH PRIORITY ⚠️

**Target File:** `layers/discussion-sync/server/services/figma.ts`

**Reference Implementation:** `/Users/pmcp/Projects/fyit-tools/layers/figno/server/services/figma.ts`

**Purpose:** Interact with Figma REST API (fetch comments, post replies, reactions)

**Code Smells in Reference (MUST FIX while porting):**

1. **Line 18** - Weak API key validation (warns instead of throws)
2. **Lines 67-89** - `buildThread()` doesn't handle pagination
3. **Line 103** - Magic number `200` for rate limit delay
4. **Lines 127-145** - `postComment()` has no retry logic
5. **Line 178** - `addReaction()` uses hardcoded emoji
6. **No caching** - Repeatedly fetches same comments
7. **No request deduplication** - Could fetch same thread multiple times in parallel

**Required Improvements:**

1. **Extract Constants**
   ```typescript
   const FIGMA_CONFIG = {
     API_BASE_URL: 'https://api.figma.com/v1',
     RATE_LIMIT_DELAY_MS: 200,
     CIRCUIT_BREAKER_THRESHOLD: 3,
     CIRCUIT_BREAKER_TIMEOUT_MS: 30000,
     RETRY_MAX_ATTEMPTS: 3,
     RETRY_BASE_DELAY_MS: 1000,
     CACHE_TTL_MS: 300000, // 5 minutes
     PROCESSING_EMOJI: '👀',
     SUCCESS_EMOJI: '✅',
     ERROR_EMOJI: '❌',
   } as const
   ```

2. **Strict API Key Validation**
   ```typescript
   constructor(apiKey?: string) {
     const key = apiKey || useRuntimeConfig().figmaApiKey || ''

     if (!key || key.trim() === '') {
       throw new Error(
         '[Figma Service] API key is required. ' +
         'Set FIGMA_API_KEY environment variable or pass apiKey to constructor.'
       )
     }

     this.apiKey = key
     this.circuitBreaker = new CircuitBreaker({ ... })
     this.cache = new LRUCache({ ... })
   }
   ```

3. **Add Caching**
   ```typescript
   private commentCache = new LRUCache<FigmaComment[]>({
     maxSize: 50,
     ttl: FIGMA_CONFIG.CACHE_TTL_MS
   })

   async getComments(fileKey: string, commentId: string): Promise<FigmaComment[]> {
     const cacheKey = `comments:${fileKey}:${commentId}`
     const cached = this.commentCache.get(cacheKey)

     if (cached) {
       console.log('[Figma Service] Cache hit:', cacheKey)
       return cached
     }

     // Fetch and cache...
   }
   ```

4. **Add Retry Logic**
   ```typescript
   private async retryWithBackoff<T>(
     fn: () => Promise<T>,
     maxAttempts = FIGMA_CONFIG.RETRY_MAX_ATTEMPTS
   ): Promise<T> {
     // Same pattern as NotionService
   }
   ```

5. **Handle Pagination**
   ```typescript
   async getComments(fileKey: string): Promise<FigmaComment[]> {
     let allComments: FigmaComment[] = []
     let cursor: string | undefined

     do {
       const response = await this.fetchCommentsPage(fileKey, cursor)
       allComments.push(...response.comments)
       cursor = response.cursor
     } while (cursor)

     return allComments
   }
   ```

**Required Methods:**

```typescript
export class FigmaService {
  /**
   * Get comments from a file
   */
  async getComments(fileKey: string): Promise<FigmaComment[]>

  /**
   * Get a specific comment thread
   */
  async getCommentThread(fileKey: string, commentId: string): Promise<FigmaComment[]>

  /**
   * Build a discussion thread from comment ID
   */
  async buildThread(fileKey: string, commentId: string): Promise<DiscussionThread>

  /**
   * Post a reply to a comment
   */
  async postComment(
    fileKey: string,
    commentId: string,
    message: string
  ): Promise<string>

  /**
   * Add a reaction emoji to a comment
   */
  async addReaction(
    fileKey: string,
    commentId: string,
    emoji: string
  ): Promise<boolean>

  /**
   * Update reaction emoji (remove old, add new)
   */
  async updateReaction(
    fileKey: string,
    commentId: string,
    oldEmoji: string,
    newEmoji: string
  ): Promise<boolean>

  /**
   * Get file information
   */
  async getFile(fileKey: string): Promise<FigmaFile>

  /**
   * Validate API key by making test request
   */
  async testConnection(): Promise<boolean>

  // Internal helpers
  private async rateLimitedFetch<T>(url: string, options: RequestInit): Promise<T>
  private buildFigmaUrl(fileKey: string, commentId?: string): string
}
```

**Type Definitions:**

```typescript
interface FigmaComment {
  id: string
  file_key: string
  parent_id: string | null
  user: {
    id: string
    handle: string
    img_url: string
  }
  created_at: string
  resolved_at: string | null
  message: string
  client_meta?: {
    node_id?: string
    node_offset?: { x: number; y: number }
  }
  reactions?: Array<{
    emoji: string
    user_ids: string[]
  }>
}

interface FigmaFile {
  name: string
  thumbnail_url: string
  version: string
  last_modified: string
}

interface FigmaCommentsResponse {
  comments: FigmaComment[]
  cursor?: string
}
```

**Test Cases Required:**
- ✅ Get comments successfully
- ✅ Build thread with nested replies
- ✅ Post comment with retry on failure
- ✅ Add reaction successfully
- ✅ Update reaction (remove + add)
- ✅ Handle rate limiting
- ✅ Handle API errors
- ✅ Cache comments correctly
- ✅ Handle pagination

---

### 3.3 Figma Adapter - HIGH PRIORITY ⚠️

**Target File:** `layers/discussion-sync/server/adapters/figma.ts`

**Purpose:** Implement `DiscussionSourceAdapter` interface for Figma

**Implementation:**

```typescript
import { FigmaService } from '../services/figma'
import { EmailParser } from '../utils/emailParser'
import type {
  DiscussionSourceAdapter,
  ParsedDiscussion,
  DiscussionThread,
  DiscussionStatus,
  SourceConfig,
  ValidationResult,
} from './base'

export class FigmaAdapter implements DiscussionSourceAdapter {
  sourceType = 'figma'

  private figmaService: FigmaService | null = null
  private emailParser: EmailParser

  constructor() {
    this.emailParser = new EmailParser()
  }

  /**
   * Parse incoming Mailgun email payload
   */
  async parseIncoming(payload: any): Promise<ParsedDiscussion> {
    // 1. Extract email data
    const html = payload['body-html'] || payload.html
    const fromEmail = payload.From || payload.from
    const subject = payload.Subject || payload.subject

    // 2. Parse email
    const parseResult = await this.emailParser.parse(html, fromEmail)

    if (!parseResult.success || !parseResult.data) {
      throw new Error(
        `[Figma Adapter] Failed to parse email: ${parseResult.error}`
      )
    }

    const data = parseResult.data

    // 3. Extract team from recipient email
    // e.g., team-slug@comments.yourdomain.com → team-slug
    const recipient = payload.To || payload.to
    const teamSlug = this.extractTeamSlug(recipient)

    // 4. Build parsed discussion
    return {
      sourceType: 'figma',
      sourceThreadId: data.commentId,
      sourceUrl: data.figmaUrl,
      teamId: teamSlug, // Will be resolved to actual team ID later
      authorHandle: data.authorEmail,
      title: subject || `Comment on ${data.fileName}`,
      content: data.commentText,
      participants: [data.authorEmail],
      timestamp: new Date(),
      metadata: {
        fileKey: data.fileKey,
        fileName: data.fileName,
        authorName: data.authorName,
        commentId: data.commentId,
        parseStrategy: parseResult.strategy,
      },
    }
  }

  /**
   * Fetch full thread from Figma
   */
  async fetchThread(threadId: string, config: SourceConfig): Promise<DiscussionThread> {
    const service = this.getService(config)

    // Extract fileKey from metadata
    const fileKey = config.metadata?.fileKey as string
    if (!fileKey) {
      throw new Error('[Figma Adapter] File key not found in config metadata')
    }

    // Build thread using Figma service
    return service.buildThread(fileKey, threadId)
  }

  /**
   * Post confirmation message back to Figma
   */
  async postReply(
    threadId: string,
    message: string,
    config: SourceConfig
  ): Promise<boolean> {
    const service = this.getService(config)
    const fileKey = config.metadata?.fileKey as string

    if (!fileKey) {
      console.warn('[Figma Adapter] Cannot post reply without file key')
      return false
    }

    try {
      await service.postComment(fileKey, threadId, message)
      return true
    } catch (error) {
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
    const service = this.getService(config)
    const fileKey = config.metadata?.fileKey as string

    if (!fileKey) {
      return false
    }

    try {
      const emoji = this.statusToEmoji(status)

      // If not pending, remove the processing emoji first
      if (status !== 'pending') {
        await service.updateReaction(fileKey, threadId, '👀', emoji)
      } else {
        await service.addReaction(fileKey, threadId, emoji)
      }

      return true
    } catch (error) {
      console.error('[Figma Adapter] Failed to update status:', error)
      return false
    }
  }

  /**
   * Validate Figma configuration
   */
  async validateConfig(config: SourceConfig): Promise<ValidationResult> {
    const errors: string[] = []

    if (!config.apiToken) {
      errors.push('Figma API token is required')
    }

    // Test connection if we have a token
    if (config.apiToken) {
      try {
        const service = new FigmaService(config.apiToken)
        await service.testConnection()
      } catch (error) {
        errors.push(
          `Figma API connection failed: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Test connection to Figma API
   */
  async testConnection(config: SourceConfig): Promise<boolean> {
    try {
      const service = this.getService(config)
      return await service.testConnection()
    } catch (error) {
      console.error('[Figma Adapter] Connection test failed:', error)
      return false
    }
  }

  // Private helpers

  private getService(config: SourceConfig): FigmaService {
    if (!this.figmaService) {
      this.figmaService = new FigmaService(config.apiToken)
    }
    return this.figmaService
  }

  private extractTeamSlug(email: string): string {
    // Extract team-slug from team-slug@comments.domain.com
    const match = email.match(/^([^@]+)@/)
    return match ? match[1] : 'default'
  }

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
```

**Test Cases Required:**
- ✅ Parse incoming email payload
- ✅ Extract team slug from recipient
- ✅ Fetch thread via Figma service
- ✅ Post reply successfully
- ✅ Update status with emojis
- ✅ Validate config with API test
- ✅ Handle missing file key
- ✅ Handle API errors gracefully

---

### 3.4 Mailgun Webhook Handler - HIGH PRIORITY ⚠️

**Target File:** `layers/discussion-sync/server/api/webhook/mailgun/figma.post.ts`

**Purpose:** Receive forwarded Figma comment emails from Mailgun

**Implementation:**

```typescript
import crypto from 'crypto'
import { FigmaAdapter } from '../../../adapters/figma'

export default defineEventHandler(async (event) => {
  console.log('[Mailgun Webhook] Received Figma comment email')

  try {
    // 1. Verify Mailgun signature
    const body = await readBody(event)

    if (!verifyMailgunSignature(body)) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Invalid Mailgun signature',
      })
    }

    // 2. Parse email using Figma adapter
    const adapter = new FigmaAdapter()
    const discussion = await adapter.parseIncoming(body)

    console.log('[Mailgun Webhook] Parsed discussion:', {
      teamId: discussion.teamId,
      sourceThreadId: discussion.sourceThreadId,
      title: discussion.title,
    })

    // 3. Resolve team ID from slug
    const teamId = await resolveTeamId(discussion.teamId)

    if (!teamId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: `Team not found: ${discussion.teamId}`,
      })
    }

    // 4. Load source config for this team
    const config = await loadSourceConfig(teamId, 'figma')

    if (!config) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: `Figma config not found for team: ${teamId}`,
      })
    }

    // 5. Check if discussion already exists (duplicate prevention)
    const existing = await findDiscussionByThreadId(
      discussion.sourceThreadId,
      teamId
    )

    if (existing) {
      console.log('[Mailgun Webhook] Discussion already exists:', existing.id)
      return { success: true, discussionId: existing.id, duplicate: true }
    }

    // 6. Create discussion record
    const db = useDb()
    const { discussionSyncDiscussions } = await import(
      '../../../collections/discussions/server/database/schema'
    )

    const [created] = await db
      .insert(discussionSyncDiscussions)
      .values({
        teamId,
        owner: discussion.authorHandle, // Will be mapped to user ID
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
        metadata: discussion.metadata,
        createdBy: discussion.authorHandle,
        updatedBy: discussion.authorHandle,
      })
      .returning()

    console.log('[Mailgun Webhook] Created discussion:', created.id)

    // 7. Trigger async processing (fire-and-forget)
    $fetch('/api/internal/process-discussion', {
      method: 'POST',
      body: {
        discussionId: created.id,
        retry: false,
      },
    }).catch((error) => {
      console.error('[Mailgun Webhook] Failed to trigger processing:', error)
      // Non-fatal - webhook still succeeds
    })

    // 8. Return 200 OK immediately (don't wait for processing)
    return {
      success: true,
      discussionId: created.id,
      message: 'Discussion created and queued for processing',
    }
  } catch (error) {
    console.error('[Mailgun Webhook] Error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * Verify Mailgun webhook signature
 */
function verifyMailgunSignature(body: any): boolean {
  const config = useRuntimeConfig()
  const secret = config.mailgunWebhookSecret

  if (!secret) {
    console.warn('[Mailgun Webhook] No webhook secret configured')
    return true // Allow in development
  }

  const timestamp = body.timestamp
  const token = body.token
  const signature = body.signature

  const data = `${timestamp}${token}`
  const hash = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')

  return hash === signature
}

/**
 * Resolve team slug to team ID
 */
async function resolveTeamId(slug: string): Promise<string | null> {
  // TODO: Query teams table or use SuperSaaS connector
  // For now, return slug as-is
  return slug
}

/**
 * Load source config for team and source type
 */
async function loadSourceConfig(
  teamId: string,
  sourceType: string
): Promise<any | null> {
  const db = useDb()
  const { discussionSyncSourceconfigs } = await import(
    '../../../collections/sourceconfigs/server/database/schema'
  )

  const results = await db
    .select()
    .from(discussionSyncSourceconfigs)
    .where(
      and(
        eq(discussionSyncSourceconfigs.teamId, teamId),
        eq(discussionSyncSourceconfigs.active, true)
      )
    )
    .limit(1)

  return results[0] || null
}

/**
 * Find existing discussion by thread ID
 */
async function findDiscussionByThreadId(
  threadId: string,
  teamId: string
): Promise<any | null> {
  const db = useDb()
  const { discussionSyncDiscussions } = await import(
    '../../../collections/discussions/server/database/schema'
  )

  const results = await db
    .select()
    .from(discussionSyncDiscussions)
    .where(
      and(
        eq(discussionSyncDiscussions.sourceThreadId, threadId),
        eq(discussionSyncDiscussions.teamId, teamId)
      )
    )
    .limit(1)

  return results[0] || null
}
```

**Test Cases Required:**
- ✅ Verify Mailgun signature
- ✅ Parse email payload
- ✅ Create discussion record
- ✅ Prevent duplicates
- ✅ Trigger async processing
- ✅ Handle missing team
- ✅ Handle missing config
- ✅ Return 200 OK quickly

---

### 3.5 Adapter Registration Plugin - MEDIUM PRIORITY

**Target File:** `layers/discussion-sync/server/plugins/register-adapters.ts`

**Purpose:** Register all adapters on server startup

**Implementation:**

```typescript
import { registerAdapter } from '../adapters/base'
import { FigmaAdapter } from '../adapters/figma'

export default defineNitroPlugin(() => {
  console.log('[Discussion Sync] Registering adapters...')

  // Register Figma adapter
  registerAdapter('figma', FigmaAdapter)

  console.log('[Discussion Sync] Adapters registered:', ['figma'])
})
```

---

### 3.6 Database Seeding - LOW PRIORITY

**Target File:** `server/database/seed-sources.ts` (or run manual SQL)

**Purpose:** Seed the `sources` table with Figma source definition

**Data:**

```sql
INSERT INTO discussion_sync_sources (
  id,
  teamId,
  owner,
  sourceType,
  name,
  description,
  webhookPath,
  requiresEmail,
  requiresWebhook,
  requiresApiToken,
  active,
  createdBy,
  updatedBy
) VALUES (
  'figma-default',
  'system',
  'system',
  'figma',
  'Figma',
  'Figma design comments via email',
  '/api/webhook/mailgun/figma',
  true,
  true,
  true,
  true,
  'system',
  'system'
);
```

---

## Implementation Priorities

### Immediate (Next 2-4 hours):

1. ✅ **Email Parser** - Port and refactor with improvements
2. ✅ **Figma Service** - Port and refactor with improvements
3. ✅ **Write tests** - 20+ tests for parser and service

### After Parser & Service (Next 2-3 hours):

4. ✅ **Figma Adapter** - Implement interface
5. ✅ **Mailgun Webhook** - Create endpoint
6. ✅ **Adapter Registration** - Create plugin
7. ✅ **Write integration tests** - Full flow testing

### Optional (Next 1-2 hours):

8. ⚪ **Database seeding** - Seed sources table
9. ⚪ **Admin UI** - Source config management (future)
10. ⚪ **Monitoring** - Add metrics (future)

---

## Code Quality Standards (Maintain from Phase 2)

1. ✅ **No `any` types** - Use `unknown` with type guards
2. ✅ **Magic numbers/strings as constants** - Extract to config objects
3. ✅ **Strict validation** - Fail fast with clear error messages
4. ✅ **Circuit breakers** - Wrap all external API calls
5. ✅ **Caching** - Use LRU cache where appropriate
6. ✅ **Error context** - Include debugging information in errors
7. ✅ **Tests required** - Write tests alongside implementation
8. ✅ **Extract long functions** - Max ~100 lines per function
9. ✅ **DRY principle** - Remove duplication

---

## Testing Requirements

### Test Coverage Goals

- **Email Parser:** >80% coverage
- **Figma Service:** >80% coverage
- **Figma Adapter:** >80% coverage
- **Mailgun Webhook:** >70% coverage (harder to test webhook)

### Test Files to Create

```
layers/discussion-sync/server/utils/__tests__/emailParser.test.ts
layers/discussion-sync/server/services/__tests__/figma.test.ts
layers/discussion-sync/server/adapters/__tests__/figma.test.ts
layers/discussion-sync/server/api/webhook/__tests__/mailgun-figma.test.ts
```

### Mocking Strategy

- Mock `cheerio` for email parser (use fixture HTML)
- Mock Figma API responses (use fixture JSON)
- Mock database for webhook handler
- Mock `$fetch` for async processing trigger
- Create comprehensive fixtures from real Figma emails

---

## Environment Variables

Add to `.env`:

```bash
# Existing (from Phase 2)
ANTHROPIC_API_KEY=sk-ant-...
NOTION_API_KEY=secret_...

# New for Phase 3
MAILGUN_WEBHOOK_SECRET=whsec_...
MAILGUN_DOMAIN=mg.yourdomain.com
FIGMA_API_KEY=figd_...  # Optional: for system-level operations
```

Add to `nuxt.config.ts`:

```typescript
runtimeConfig: {
  // ... existing config
  mailgunWebhookSecret: '',
  mailgunDomain: '',
  figmaApiKey: '',  // Optional
}
```

---

## Mailgun Configuration

### DNS Records

```
TXT  mg.yourdomain.com  "v=spf1 include:mailgun.org ~all"
TXT  mx._domainkey.mg.yourdomain.com  [DKIM key from Mailgun]
MX   mg.yourdomain.com  mxa.mailgun.org (priority 10)
MX   mg.yourdomain.com  mxb.mailgun.org (priority 10)
```

### Route Configuration

In Mailgun dashboard, create a route:

**Priority:** 1
**Filter:** `match_recipient("*@comments.yourdomain.com")`
**Actions:**
- Forward to: `https://yourdomain.com/api/webhook/mailgun/figma`
- Stop processing further routes

### Figma Email Setup

In each team's source config, provide an email address:

**Format:** `team-slug@comments.yourdomain.com`

**Example:**
- Team "Acme Design" → `acme-design@comments.yourdomain.com`
- Team "Beta Corp" → `beta-corp@comments.yourdomain.com`

Users add this email to Figma comment notifications.

---

## Reference Implementation Files

### Primary References (Port From)

```
/Users/pmcp/Projects/fyit-tools/layers/figno/server/
├── services/
│   ├── figma.ts              ⚠️ PORT & REFACTOR
│   └── notion.ts             ✅ ALREADY DONE (Phase 2)
├── utils/
│   ├── emailParser.ts        ⚠️ PORT & REFACTOR
│   ├── circuitBreaker.ts     ✅ ALREADY DONE (Phase 1)
│   └── rateLimiter.ts        ⚠️ REFERENCE (built into NotionService)
└── api/
    └── webhook/
        └── mailgun/
            └── index.post.ts ⚠️ PORT & ADAPT
```

### Current Codebase Structure

```
layers/discussion-sync/
├── server/
│   ├── adapters/
│   │   ├── base.ts ✅
│   │   └── figma.ts ❌ (NEEDS CREATION)
│   ├── services/
│   │   ├── ai.ts ✅
│   │   ├── notion.ts ✅
│   │   ├── processor.ts ✅
│   │   └── figma.ts ❌ (NEEDS CREATION)
│   ├── utils/
│   │   ├── circuitBreaker.ts ✅
│   │   ├── lru-cache.ts ✅
│   │   └── emailParser.ts ❌ (NEEDS CREATION)
│   ├── api/
│   │   ├── internal/
│   │   │   └── process-discussion.post.ts ✅
│   │   └── webhook/
│   │       └── mailgun/
│   │           └── figma.post.ts ❌ (NEEDS CREATION)
│   └── plugins/
│       └── register-adapters.ts ❌ (NEEDS CREATION)
└── collections/ ✅ (all 6 generated)
```

---

## Success Criteria for Phase 3

- [ ] Email Parser created with all improvements
- [ ] Email Parser tests passing (>80% coverage)
- [ ] Figma Service created with all improvements
- [ ] Figma Service tests passing (>80% coverage)
- [ ] Figma Adapter implements all interface methods
- [ ] Figma Adapter tests passing (>80% coverage)
- [ ] Mailgun webhook handler created
- [ ] Mailgun webhook tests passing (>70% coverage)
- [ ] Adapter registration plugin created
- [ ] Integration test: Email → Parse → Discussion → Process → Notion → Reply
- [ ] All code quality standards maintained
- [ ] No regressions in Phase 1/2 tests

---

## Integration Test Scenario

### End-to-End Test (Manual or Automated)

```typescript
// 1. Send test email to Mailgun
const testEmail = {
  'From': 'designer@company.com',
  'To': 'test-team@comments.yourdomain.com',
  'Subject': 'Comment on Design System',
  'body-html': '<html>...</html>',  // Figma email HTML
  'timestamp': '1699999999',
  'token': 'test-token',
  'signature': 'valid-signature'
}

// 2. Post to webhook
const response = await $fetch('/api/webhook/mailgun/figma', {
  method: 'POST',
  body: testEmail
})

expect(response.success).toBe(true)
expect(response.discussionId).toBeDefined()

// 3. Wait for processing
await waitFor(() => {
  const job = await getJobStatus(response.discussionId)
  return job.status === 'completed'
}, { timeout: 30000 })

// 4. Verify Notion task created
const job = await getJobStatus(response.discussionId)
expect(job.taskIds).toHaveLength(1)

// 5. Verify Figma reply posted (check via Figma API)
const comments = await figmaService.getComments(fileKey)
const replies = comments.filter(c => c.parent_id === commentId)
expect(replies.some(r => r.message.includes('Created'))).toBe(true)

// 6. Verify status emoji updated
const comment = comments.find(c => c.id === commentId)
expect(comment.reactions.some(r => r.emoji === '✅')).toBe(true)
```

---

## Common Issues & Solutions

### Issue: Email parsing fails
**Solution:** Check HTML structure matches fixtures. Add new parsing strategy if needed.

### Issue: Figma API rate limiting
**Solution:** Circuit breaker will handle. Increase delays if needed.

### Issue: Duplicate discussions created
**Solution:** Webhook checks for existing `sourceThreadId` before creating.

### Issue: Processing times out
**Solution:** Increase timeout in processor. Check Notion/Figma API response times.

### Issue: Team resolution fails
**Solution:** Ensure team slug in email matches team records. Add team resolution logic.

---

## What Happens After Phase 3?

### Phase 4: Slack Integration

- Add `@slack/web-api` dependency
- Create Slack Service
- Create Slack Adapter
- Create OAuth flow
- Create Events API webhook
- Register Slack adapter

### Phase 5: Production Deployment

- Deploy to NuxtHub
- Configure Mailgun DNS
- Set up monitoring
- Create admin UI for source configs
- Add error alerting

---

## Notes for Next Agent

1. **Start with Email Parser** - It's the foundation for Figma integration
2. **Focus on refactoring** - Don't just copy-paste from fyit-tools
3. **Test with real Figma emails** - Use fixtures from actual Figma notifications
4. **Extract all magic strings** - Use constants for email markers and patterns
5. **Strategy pattern for parsing** - Makes it easy to add new email formats
6. **Cache aggressively** - Figma comments don't change often
7. **Handle rate limiting** - Figma has limits, use circuit breaker
8. **Fail gracefully** - If parsing fails, log HTML preview for debugging
9. **Test webhook signature** - Use Mailgun docs for signature verification
10. **Ask questions** - If unsure about email format, ask for sample

---

## Questions for User (if needed)

1. Do you have sample Figma comment emails to use as test fixtures?
2. What's the Mailgun domain for receiving emails?
3. Should we support multiple Figma configs per team?
4. What happens if Figma API is down - just fail or queue for retry?
5. Should we store raw email HTML for debugging failed parses?

---

**Ready to start Phase 3! Focus on quality over speed. Figma integration is the first real adapter - make it solid.** 🎨
