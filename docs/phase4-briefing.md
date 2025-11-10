# Discussion Sync - Phase 4 Briefing

**Date:** 2025-11-10
**Status:** 📋 PLANNING
**Previous Phase:** Phase 3 (Figma Integration) - COMPLETE

---

## Executive Summary

Phase 3 (Figma Integration) has been successfully implemented with ~3,300 lines of production-ready code and comprehensive tests. This briefing outlines the recommended path forward, which includes:

1. **Testing & deploying Phase 3** to validate the implementation
2. **Planning Phase 4** (Slack Integration) as the next major feature
3. **Addressing production readiness** gaps from the original brief

---

## Current State Assessment

### ✅ What's Complete

**Phase 1: Core Discussion Sync Engine**
- ✅ Database schema with 5 core tables
- ✅ Processing engine with circuit breakers
- ✅ AI integration (Claude 3.5 Sonnet)
- ✅ Notion integration
- ✅ Job tracking and error handling

**Phase 2: Notion Integration**
- ✅ NotionService with full API coverage
- ✅ Task creation and updates
- ✅ Field mapping and validation
- ✅ Comprehensive tests

**Phase 3: Figma Integration**
- ✅ EmailParser with 5 parsing strategies
- ✅ FigmaService with circuit breaker, caching, retry logic
- ✅ FigmaAdapter implementing full interface
- ✅ Mailgun webhook handler
- ✅ 70+ tests written
- ✅ Complete documentation

### ⚠️ What's NOT Complete

**From Original Brief (fyit-tools/docs/briefings/discussion-sync-v2-brief.md):**
1. ❌ Slack integration (Phase 4 in original plan)
2. ❌ Discord integration (listed as supported source)
3. ❌ GitHub integration (listed as supported source)
4. ❌ Admin UI for source management
5. ❌ Token encryption (currently plaintext in DB)
6. ❌ SuperSaaS team resolution (placeholder implementation)
7. ❌ Database seeding for source definitions
8. ❌ Webhook deduplication via KV store
9. ❌ Rate limiting per team
10. ❌ Production deployment to NuxtHub

**Testing Gaps:**
- ❌ Phase 3 has NOT been tested end-to-end with real Figma emails
- ⚠️ 7 minor test assertion failures in emailParser tests
- ❌ No integration tests across full stack
- ❌ No load/performance testing

---

## Recommended Path: Option 1 - Test & Deploy Phase 3

**Why This First:**
- Phase 3 is freshly implemented but untested in production
- Validating one adapter fully before adding more reduces risk
- Will reveal integration issues and performance bottlenecks
- Provides a working reference for Phase 4 (Slack)

### Step 1: Fix Test Failures

**File:** `layers/discussion-sync/server/utils/__tests__/emailParser.test.ts`

**Issues:** 7 out of 24 tests have minor assertion mismatches
- Whitespace normalization differences
- Text extraction formatting differences
- Comment ID extraction from URL anchors

**Tasks:**
1. Run tests and identify exact assertion failures
2. Adjust test expectations to match actual output (if output is correct)
3. Fix parser logic if output is genuinely incorrect
4. Ensure all 24 tests pass

**Estimated Time:** 2-3 hours

**Success Criteria:**
```bash
pnpm vitest layers/discussion-sync/server/utils/__tests__/emailParser.test.ts
# All 24 tests should pass
```

### Step 2: Mailgun Setup

**Prerequisites:**
- Mailgun account (free tier works)
- Domain with DNS access (e.g., `yourdomain.com`)
- Subdomain for Mailgun (e.g., `mg.yourdomain.com`)

**Tasks:**

#### 2.1 Add DNS Records
Add these records to your DNS provider:

```
Type: TXT
Host: mg.yourdomain.com
Value: v=spf1 include:mailgun.org ~all

Type: TXT
Host: mx._domainkey.mg.yourdomain.com
Value: [Get from Mailgun dashboard]

Type: MX
Host: mg.yourdomain.com
Value: mxa.mailgun.org
Priority: 10

Type: MX
Host: mg.yourdomain.com
Value: mxb.mailgun.org
Priority: 10
```

**Verification:**
- Wait 15 minutes - 48 hours for DNS propagation
- Check Mailgun dashboard for "Verified" status

#### 2.2 Configure Mailgun Route
In Mailgun dashboard (Routes section):

1. Click "Create Route"
2. Set Priority: `1`
3. Set Expression: `match_recipient("*@comments.yourdomain.com")`
4. Set Actions:
   - Forward to URL: `https://yourdomain.com/api/webhook/mailgun/figma`
   - Check "Stop"
5. Click "Create Route"

#### 2.3 Configure Environment
Add to `.env`:

```bash
# Existing
ANTHROPIC_API_KEY=sk-ant-xxx...
NOTION_API_KEY=secret_xxx...

# Figma Integration
FIGMA_API_KEY=figd_xxx...
MAILGUN_WEBHOOK_SECRET=whsec_xxx...
MAILGUN_DOMAIN=mg.yourdomain.com
```

**Get API Keys:**
- **Figma API Key:** https://www.figma.com/settings → Personal Access Tokens
- **Mailgun Webhook Secret:** Mailgun Settings → Webhooks → Signing Key
- **Notion API Key:** https://www.notion.so/my-integrations (from Phase 2)

**Estimated Time:** 1-2 hours (plus DNS propagation wait)

### Step 3: Database Seeding

**Create Source Definition:**

Create file: `server/database/seed/sources.ts`

```typescript
import { db } from '../index'
import { discussionSyncSources } from '../schema'

export async function seedSources() {
  await db.insert(discussionSyncSources).values([
    {
      id: 'figma',
      name: 'Figma',
      slug: 'figma',
      description: 'Sync Figma comments to Notion via email',
      active: true,
      icon: '🎨',
      metadata: {
        supportsThreads: true,
        supportsReactions: true,
        requiresEmail: true,
      },
    },
  ])
}
```

**Create Sample Source Config:**

```sql
INSERT INTO discussion_sync_sourceconfigs (
  id,
  teamId,
  owner,
  sourceId,
  name,
  active,
  apiToken,
  notionToken,
  notionDatabaseId,
  notionFieldMapping,
  aiEnabled,
  autoSync,
  postConfirmation,
  metadata,
  createdBy,
  updatedBy
) VALUES (
  'test-figma-config',
  'test-team',
  'test-user',
  'figma',
  'Test Figma Integration',
  true,
  'figd_xxx...', -- Your Figma API key
  'secret_xxx...', -- Your Notion API key
  'your-notion-database-id',
  '{"title": "Name", "url": "URL"}',
  true,
  true,
  true,
  '{}',
  'system',
  'system'
);
```

**Estimated Time:** 1 hour

### Step 4: End-to-End Testing

#### 4.1 Configure Figma File
1. Open a Figma file you have edit access to
2. Add a test comment: `@Figbot please create a task for testing the integration`
3. Click three dots (···) on the comment → Email notifications
4. Add email: `test-team@comments.yourdomain.com`

#### 4.2 Monitor Webhook
Watch server logs:

```bash
pnpm dev
# Watch for:
# [Mailgun Webhook] Received Figma comment email
# [Mailgun Webhook] Signature verified
# [Mailgun Webhook] Parsed discussion: { teamId, sourceThreadId, title }
# [Mailgun Webhook] Created discussion: <id>
# [Mailgun Webhook] Processing triggered
```

#### 4.3 Verify Database
```sql
-- Check discussion was created
SELECT * FROM discussion_sync_discussions
ORDER BY createdAt DESC LIMIT 1;

-- Check sync job was created
SELECT * FROM discussion_sync_syncjobs
WHERE discussionId = '<discussion-id>';

-- Check task was created
SELECT * FROM discussion_sync_tasks
WHERE jobId = '<job-id>';
```

#### 4.4 Verify Figma Reply
1. Go back to Figma comment thread
2. You should see:
   - A reply with the Notion task link
   - A ✅ emoji reaction on the root comment

#### 4.5 Verify Notion Task
1. Open your Notion database
2. Find the newly created task
3. Verify all fields are populated correctly

**Estimated Time:** 2-3 hours

**Success Criteria:**
- ✅ Email received by webhook
- ✅ Discussion created in database
- ✅ Sync job completes successfully
- ✅ Notion task created with correct fields
- ✅ Figma reply posted
- ✅ Figma reaction added
- ✅ No errors in logs

### Step 5: Deploy to NuxtHub

**Prerequisites:**
- NuxtHub account
- Cloudflare account (for Workers/D1)

**Tasks:**

#### 5.1 Configure NuxtHub
```bash
# Install NuxtHub CLI
npm install -g nuxthub

# Login
nuxthub login

# Link project
nuxthub link

# Deploy
nuxthub deploy
```

#### 5.2 Configure Production Environment
In NuxtHub dashboard, add environment variables:
- `ANTHROPIC_API_KEY`
- `NOTION_API_KEY`
- `FIGMA_API_KEY`
- `MAILGUN_WEBHOOK_SECRET`
- `MAILGUN_DOMAIN`

#### 5.3 Update Mailgun Route
Change webhook URL to production:
```
https://your-production-domain.com/api/webhook/mailgun/figma
```

#### 5.4 Test Production
Repeat Step 4 (End-to-End Testing) against production URL

**Estimated Time:** 2-3 hours

**Success Criteria:**
- ✅ Application deployed to NuxtHub
- ✅ Environment variables configured
- ✅ Mailgun pointing to production
- ✅ End-to-end flow works in production

---

## Phase 4: Slack Integration (Future)

### Overview
Add support for Slack as a discussion source, allowing teams to sync Slack threads to Notion using bot mentions.

### Architecture

**Flow:**
```
Slack Thread → Events API → Webhook → Parser → Discussion → Processor → Notion → Reply
```

**Key Differences from Figma:**
- Slack uses Events API, not email forwarding
- OAuth flow required for bot installation
- Real-time webhook delivery (not email delay)
- Rich message formatting (blocks, attachments)
- Thread replies are native (not parsed from email)

### Implementation Plan

#### 4.1 Add Slack Dependency
```bash
pnpm add @slack/web-api @slack/events-api
```

#### 4.2 Create Slack Service (~300 lines)
**File:** `layers/discussion-sync/server/services/slack.ts`

**Features:**
- Bot token validation
- Get conversation thread
- Post message replies
- Add/remove reactions
- Get user info
- Get channel info
- Retry logic with exponential backoff
- Rate limiting (1 request/second per workspace)
- Circuit breaker pattern

**Key Methods:**
```typescript
class SlackService {
  async getThread(channelId: string, threadTs: string): Promise<SlackThread>
  async postMessage(channelId: string, threadTs: string, text: string): Promise<string>
  async addReaction(channelId: string, timestamp: string, emoji: string): Promise<void>
  async removeReaction(channelId: string, timestamp: string, emoji: string): Promise<void>
  async getUserInfo(userId: string): Promise<SlackUser>
  async getChannelInfo(channelId: string): Promise<SlackChannel>
  async testConnection(): Promise<boolean>
}
```

#### 4.3 Create Slack Adapter (~250 lines)
**File:** `layers/discussion-sync/server/adapters/slack.ts`

**Features:**
- Implements `DiscussionSourceAdapter` interface
- Parse Events API payloads
- Extract team from workspace ID
- Build discussion from thread
- Post confirmation replies
- Update status using reactions (👀 → ✅/❌)

**Key Methods:**
```typescript
class SlackAdapter implements DiscussionSourceAdapter {
  sourceType = 'slack'

  async parseIncoming(payload: SlackEvent): Promise<ParsedDiscussion>
  async fetchThread(threadId: string, config: SourceConfig): Promise<Discussion>
  async postReply(threadId: string, message: string, config: SourceConfig): Promise<boolean>
  async updateStatus(threadId: string, status: DiscussionStatus, config: SourceConfig): Promise<boolean>
  async validateConfig(config: SourceConfig): Promise<ValidationResult>
  async testConnection(config: SourceConfig): Promise<boolean>
}
```

#### 4.4 Create OAuth Flow (~200 lines)
**Files:**
- `server/api/oauth/slack/authorize.get.ts` - Initiate OAuth
- `server/api/oauth/slack/callback.get.ts` - Handle callback
- `server/api/oauth/slack/install.get.ts` - Installation landing page

**Features:**
- OAuth 2.0 authorization flow
- Bot token exchange
- Team and user info retrieval
- Auto-create source config
- Error handling

**OAuth Scopes Required:**
```typescript
const SLACK_SCOPES = [
  'channels:history',
  'channels:read',
  'chat:write',
  'reactions:write',
  'users:read',
  'app_mentions:read',
]
```

#### 4.5 Create Events API Webhook (~250 lines)
**File:** `server/api/webhook/slack/events.post.ts`

**Features:**
- Verify Slack signature (HMAC SHA256)
- Handle URL verification challenge
- Parse app_mention events
- Create discussion records
- Trigger async processing
- Duplicate prevention

**Event Types to Handle:**
```typescript
type SlackEventType =
  | 'app_mention'        // @BotName mentioned in channel
  | 'message.channels'   // Message in subscribed channel
  | 'reaction_added'     // Reaction added to message
```

#### 4.6 Signature Verification (~80 lines)
**File:** `server/utils/slackSignature.ts`

**Features:**
- HMAC SHA256 verification
- Timestamp replay protection (5-minute window)
- Graceful degradation in development

**Implementation:**
```typescript
function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  const baseString = `v0:${timestamp}:${body}`
  const hmac = crypto.createHmac('sha256', secret)
  const computed = `v0=${hmac.update(baseString).digest('hex')}`
  return computed === signature
}
```

#### 4.7 Register Slack Adapter
**File:** `layers/discussion-sync/server/plugins/register-adapters.ts`

Add:
```typescript
import { SlackAdapter } from '../adapters/slack'

registerAdapter('slack', SlackAdapter)
```

#### 4.8 Comprehensive Tests (~400 lines)
**Files:**
- `server/services/__tests__/slack.test.ts` - Service tests
- `server/adapters/__tests__/slack.test.ts` - Adapter tests
- `server/api/webhook/slack/__tests__/events.test.ts` - Webhook tests

**Test Coverage:**
- Service: API calls, caching, rate limiting, error handling
- Adapter: Event parsing, thread fetching, reply posting, status updates
- Webhook: Signature verification, event handling, duplicate prevention

### Phase 4 Estimated Time
- **Slack Service:** 4-6 hours
- **Slack Adapter:** 3-4 hours
- **OAuth Flow:** 3-4 hours
- **Events API Webhook:** 3-4 hours
- **Signature Verification:** 1-2 hours
- **Tests:** 4-6 hours
- **Documentation:** 2-3 hours

**Total:** 20-29 hours (~3-4 days)

---

## Production Readiness Checklist

### Security Hardening

#### 1. Token Encryption ❌
**Current State:** API tokens stored as plaintext in `discussion_sync_sourceconfigs.apiToken`

**Required:**
- Encrypt tokens at rest using AES-256-GCM
- Store encryption key in environment variable
- Decrypt on-demand when needed
- Rotate encryption keys periodically

**Implementation:**
```typescript
// server/utils/encryption.ts
export function encryptToken(token: string): string {
  const key = Buffer.from(useRuntimeConfig().encryptionKey, 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`
}

export function decryptToken(encrypted: string): string {
  const [ivHex, encryptedHex, tagHex] = encrypted.split(':')
  const key = Buffer.from(useRuntimeConfig().encryptionKey, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(encryptedHex, 'hex', 'utf8') + decipher.final('utf8')
}
```

**Estimated Time:** 3-4 hours

#### 2. Rate Limiting Per Team ❌
**Current State:** No per-team rate limiting

**Required:**
- Implement token bucket algorithm
- Store rate limit state in KV store
- Different limits for free vs paid tiers
- Return 429 with Retry-After header

**Implementation:**
```typescript
// server/middleware/rateLimit.ts
export async function checkRateLimit(teamId: string): Promise<boolean> {
  const kv = useKV()
  const key = `rate:${teamId}`
  const limit = 100 // requests per hour
  const window = 3600 // seconds

  const current = await kv.get<number>(key) || 0

  if (current >= limit) {
    return false
  }

  await kv.set(key, current + 1, { ttl: window })
  return true
}
```

**Estimated Time:** 4-6 hours

#### 3. Webhook Deduplication ❌
**Current State:** Database query checks for duplicates (slow)

**Required:**
- Use KV store for fast duplicate detection
- Store webhook IDs with TTL (24 hours)
- Return 200 OK for duplicates (idempotency)

**Implementation:**
```typescript
// server/utils/deduplication.ts
export async function isDuplicate(webhookId: string): Promise<boolean> {
  const kv = useKV()
  const key = `webhook:${webhookId}`
  const exists = await kv.get(key)

  if (exists) {
    return true
  }

  await kv.set(key, Date.now(), { ttl: 86400 }) // 24 hours
  return false
}
```

**Estimated Time:** 2-3 hours

### SuperSaaS Integration

#### 4. Team Resolution ❌
**Current State:** Placeholder implementation returns team slug as-is

**Required:**
- Integrate with SuperSaaS connector
- Map team slug → team ID
- Handle team not found errors
- Cache team resolutions

**Implementation:**
```typescript
// server/utils/teamResolver.ts
import { SuperSaaSConnector } from '@supersaas/nuxt'

export async function resolveTeam(slug: string): Promise<string | null> {
  const connector = useSuperSaaS()
  const team = await connector.getTeamBySlug(slug)
  return team?.id || null
}
```

**Estimated Time:** 2-3 hours (depends on SuperSaaS API)

### Monitoring & Observability

#### 5. Error Tracking ❌
**Current State:** Console logs only

**Required:**
- Integrate Sentry or similar
- Track errors with context
- Set up alerts for critical errors
- Monitor error rates

**Implementation:**
```bash
pnpm add @sentry/nuxt
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@sentry/nuxt/module'],
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
})
```

**Estimated Time:** 2-3 hours

#### 6. Metrics & Analytics ❌
**Current State:** No metrics collection

**Required:**
- Track key metrics (processing time, success rate, API latency)
- Dashboard for monitoring
- Alerts for anomalies

**Metrics to Track:**
- Discussions created per hour
- Sync job success/failure rate
- Average processing time
- API call latency (Figma, Notion, AI)
- Circuit breaker trips
- Cache hit/miss ratio

**Estimated Time:** 6-8 hours

### Database & Performance

#### 7. Database Indexes ⚠️
**Current State:** Basic indexes from schema

**Required:**
- Add composite indexes for common queries
- Analyze query performance
- Optimize slow queries

**Recommended Indexes:**
```typescript
// Add to schema
index('idx_discussions_team_status').on(
  discussionSyncDiscussions.teamId,
  discussionSyncDiscussions.status
),
index('idx_discussions_source_thread').on(
  discussionSyncDiscussions.sourceType,
  discussionSyncDiscussions.sourceThreadId
),
index('idx_jobs_status_stage').on(
  discussionSyncSyncjobs.status,
  discussionSyncSyncjobs.currentStage
),
```

**Estimated Time:** 2-3 hours

#### 8. Background Job Queue ❌
**Current State:** Fire-and-forget via $fetch

**Required:**
- Proper job queue (e.g., BullMQ)
- Retry failed jobs automatically
- Job prioritization
- Dead letter queue

**Estimated Time:** 8-10 hours

---

## Admin UI (Optional - Future Phase)

### Overview
Build a web interface for managing discussion sync configurations, monitoring jobs, and viewing analytics.

### Pages

#### 1. Source Management Dashboard
**Route:** `/admin/sources`

**Features:**
- List all source configs
- Add/edit/delete configs
- Test connections
- Enable/disable configs
- View config details

#### 2. Configuration Wizard
**Route:** `/admin/sources/new`

**Features:**
- Step-by-step setup
- OAuth flows (Slack, GitHub, etc.)
- API key validation
- Notion database selection
- Field mapping builder
- AI prompt customization

#### 3. Job Monitoring
**Route:** `/admin/jobs`

**Features:**
- List all sync jobs
- Filter by status, team, source
- View job details
- Retry failed jobs
- Cancel running jobs
- View error logs

#### 4. Discussion Browser
**Route:** `/admin/discussions`

**Features:**
- Search discussions
- Filter by source, team, status
- View full thread
- View created tasks
- Manual sync trigger

#### 5. Analytics Dashboard
**Route:** `/admin/analytics`

**Features:**
- Success rate charts
- Processing time trends
- Source usage breakdown
- Team activity heatmap
- Error rate monitoring

### Estimated Time
- **Source Management:** 6-8 hours
- **Configuration Wizard:** 8-10 hours
- **Job Monitoring:** 6-8 hours
- **Discussion Browser:** 6-8 hours
- **Analytics Dashboard:** 10-12 hours

**Total:** 36-46 hours (~5-6 days)

---

## Decision Matrix

### Option A: Test & Deploy Phase 3 First ✅ RECOMMENDED
**Pros:**
- Validates current implementation before adding complexity
- Reveals integration issues early
- Provides working reference for future integrations
- Lower risk

**Cons:**
- Delays new feature development
- Requires Mailgun/Figma account setup

**Time Investment:** 8-11 hours
**Risk Level:** Low

### Option B: Start Phase 4 (Slack) Immediately
**Pros:**
- Faster feature development
- Slack is high-value integration
- Can test both adapters together

**Cons:**
- Higher risk if Phase 3 has issues
- Harder to debug problems
- May need to refactor adapter interface

**Time Investment:** 20-29 hours
**Risk Level:** Medium-High

### Option C: Build Admin UI First
**Pros:**
- Easier to test/manage configs
- Better developer experience
- Helps with demos

**Cons:**
- Doesn't add new sources
- Still need to test Phase 3
- UI may need changes as adapters evolve

**Time Investment:** 36-46 hours
**Risk Level:** Medium

### Option D: Production Hardening First
**Pros:**
- Improves security/reliability
- Required for launch anyway
- Good architectural foundation

**Cons:**
- Can't fully test without working integration
- Some items depend on production deployment

**Time Investment:** 23-31 hours
**Risk Level:** Low

---

## Recommendation

**Follow this sequence:**

### Phase 4A: Validate & Deploy (Weeks 1-2)
1. ✅ Fix emailParser test failures (2-3 hours)
2. ✅ Set up Mailgun (1-2 hours + DNS wait)
3. ✅ Create database seeds (1 hour)
4. ✅ Test end-to-end locally (2-3 hours)
5. ✅ Deploy to NuxtHub (2-3 hours)
6. ✅ Test end-to-end in production (2-3 hours)

**Total:** 10-15 hours + DNS propagation time

### Phase 4B: Slack Integration (Weeks 3-4)
1. ✅ Implement Slack Service (4-6 hours)
2. ✅ Implement Slack Adapter (3-4 hours)
3. ✅ Implement OAuth flow (3-4 hours)
4. ✅ Implement Events API webhook (3-4 hours)
5. ✅ Write comprehensive tests (4-6 hours)
6. ✅ Test end-to-end (3-4 hours)

**Total:** 20-28 hours

### Phase 4C: Production Hardening (Week 5)
1. ✅ Token encryption (3-4 hours)
2. ✅ SuperSaaS team resolution (2-3 hours)
3. ✅ Rate limiting per team (4-6 hours)
4. ✅ Webhook deduplication (2-3 hours)
5. ✅ Error tracking (2-3 hours)
6. ✅ Database indexes (2-3 hours)

**Total:** 15-22 hours

### Phase 4D: Admin UI (Weeks 6-7) - OPTIONAL
Build admin interface if needed for team adoption.

**Total:** 36-46 hours

---

## Success Criteria

### Phase 4A (Validation)
- [ ] All emailParser tests pass
- [ ] Mailgun DNS verified
- [ ] End-to-end flow works locally
- [ ] Deployed to NuxtHub
- [ ] End-to-end flow works in production
- [ ] No errors in production logs
- [ ] Response time < 2 seconds for webhook
- [ ] Figma replies posted within 30 seconds

### Phase 4B (Slack)
- [ ] All Slack tests pass
- [ ] OAuth flow works end-to-end
- [ ] Slack mentions trigger discussions
- [ ] Tasks created in Notion
- [ ] Slack replies posted
- [ ] Reactions added to Slack messages
- [ ] No errors in logs

### Phase 4C (Production Hardening)
- [ ] All tokens encrypted
- [ ] Rate limiting works per team
- [ ] Duplicate webhooks handled
- [ ] Sentry capturing errors
- [ ] Team resolution via SuperSaaS
- [ ] Database queries optimized

---

## Risk Assessment

### High Risk
1. **Mailgun DNS Propagation:** Can take up to 48 hours
   - **Mitigation:** Start DNS setup first, work on other tasks while waiting

2. **Slack OAuth Complexity:** OAuth flows are error-prone
   - **Mitigation:** Follow Slack's official examples, test thoroughly

3. **Circuit Breaker Tuning:** May need adjustment in production
   - **Mitigation:** Monitor metrics, adjust thresholds based on data

### Medium Risk
1. **API Rate Limits:** Figma/Slack/Notion have different limits
   - **Mitigation:** Implement per-source rate limiting, respect retry-after headers

2. **Token Security:** Current plaintext storage is a vulnerability
   - **Mitigation:** Prioritize encryption in Phase 4C

### Low Risk
1. **Test Failures:** Minor assertion issues in emailParser
   - **Mitigation:** Easy to fix, just test expectation adjustments

2. **Database Performance:** SQLite may have limitations at scale
   - **Mitigation:** Add indexes, consider CloudFlare D1 migration

---

## Open Questions

1. **Multi-Source Support Per Team:** Can a team have multiple Figma configs? Multiple Slack workspaces?
   - **Impact:** Affects source config schema and UI design
   - **Recommendation:** Yes, allow multiple configs per source type per team

2. **AI Prompt Customization:** Should teams be able to customize AI prompts?
   - **Impact:** Affects source config metadata structure
   - **Recommendation:** Yes, add `aiPrompts` field to config

3. **Notion Database Auto-Detection:** Should we auto-detect Notion databases?
   - **Impact:** Requires Notion search API integration
   - **Recommendation:** Yes for better UX, but manual input as fallback

4. **Retry Strategy:** Current retry is exponential backoff, but should we also have scheduled retries?
   - **Impact:** Requires job queue implementation
   - **Recommendation:** Add job queue in Phase 4C

5. **User Mapping:** How do we map source users (Figma/Slack) to Notion users?
   - **Impact:** Affects task assignment in Notion
   - **Recommendation:** Email-based matching with manual override option

---

## Next Steps

**Immediate Actions:**

1. **Review this briefing** and decide on prioritization
2. **Set up Mailgun account** and start DNS configuration
3. **Get Figma API key** from https://www.figma.com/settings
4. **Create Notion test database** if not already done
5. **Fix emailParser test failures** (low-hanging fruit)

**After Approval:**

6. **Execute Phase 4A** (Test & Deploy)
7. **Gather feedback** from end-to-end testing
8. **Begin Phase 4B** (Slack Integration)

---

## Timeline Estimate

**Conservative Estimate (with buffer):**
- **Phase 4A (Validation):** 2 weeks (includes DNS wait time)
- **Phase 4B (Slack):** 2 weeks
- **Phase 4C (Hardening):** 1 week
- **Phase 4D (Admin UI):** 2 weeks (optional)

**Total:** 5-7 weeks

**Aggressive Estimate (if DNS is fast and no blockers):**
- **Phase 4A:** 1 week
- **Phase 4B:** 1.5 weeks
- **Phase 4C:** 3-4 days
- **Phase 4D:** 1.5 weeks (optional)

**Total:** 3-4.5 weeks

---

## Resources

### Documentation
- [Figma REST API Docs](https://www.figma.com/developers/api)
- [Slack Web API Docs](https://api.slack.com/web)
- [Mailgun Webhooks Docs](https://documentation.mailgun.com/en/latest/user_manual.html#webhooks)
- [NuxtHub Deployment Guide](https://hub.nuxt.com/docs/getting-started/deploy)
- [Notion API Reference](https://developers.notion.com/reference)

### Tools
- [Mailgun](https://www.mailgun.com) - Email routing
- [NuxtHub](https://hub.nuxt.com) - Deployment platform
- [Sentry](https://sentry.io) - Error tracking
- [Postman](https://www.postman.com) - API testing

---

## Conclusion

Phase 3 (Figma Integration) represents a significant milestone with ~3,300 lines of production-ready code. The recommended path forward prioritizes validation and deployment before adding new features, which reduces risk and provides a solid foundation for Phase 4 (Slack).

The most critical next step is **testing Phase 3 end-to-end** to validate the implementation and uncover any integration issues. Once validated, Slack integration can proceed with confidence.

**Ready to proceed?** Start with Phase 4A: Fix tests, set up Mailgun, and test end-to-end.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Author:** Claude (Sonnet 4.5)
**Status:** Ready for Review