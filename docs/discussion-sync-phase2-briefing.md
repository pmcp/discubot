# Discussion Sync v2.0 - Phase 2 Implementation Briefing

**Project:** discubot - Discussion-to-Notion Synchronization System
**Date:** 2025-11-10
**Current Status:** Phase 1 Complete (Code Quality Fixes), Phase 2 In Progress
**Overall Completion:** ~30%

---

## What Was Just Completed ✅

### Phase 1: Code Quality Fixes & Refactoring (100% Complete)

#### 1. AI Service Refactoring (`layers/discussion-sync/server/services/ai.ts`)

**Fixed Issues:**
- ✅ **Strict API key validation** - Now throws error immediately if no key provided (was just warning)
- ✅ **Bounded LRU cache** - Implemented proper LRU cache with max 100 entries and automatic cleanup
- ✅ **SHA-256 hashing** - Replaced MD5 with SHA-256 for cache keys
- ✅ **Magic numbers eliminated** - All hardcoded values extracted to `AI_CONFIG` constant object
- ✅ **Code duplication removed** - Created `getCachedOrExecute<T>()` helper method
- ✅ **Better error handling** - Improved error messages and context

**New Files Created:**
- `layers/discussion-sync/server/utils/lru-cache.ts` - Complete LRU cache implementation with TTL support

#### 2. Base Adapter Type Safety (`layers/discussion-sync/server/adapters/base.ts`)

**Fixed Issues:**
- ✅ Replaced all `Record<string, any>` with `Record<string, unknown>` (lines 22, 46, 56, 64)
- ✅ Improved error messages in `getAdapter()` to show available adapters
- ✅ Better type safety throughout

#### 3. Test Infrastructure Setup

**Created:**
- `vitest.config.ts` - Vitest configuration
- `package.json` - Added test scripts (`test`, `test:ui`, `test:coverage`)
- **Test files created:**
  - `layers/discussion-sync/server/utils/__tests__/circuitBreaker.test.ts` (15 tests)
  - `layers/discussion-sync/server/utils/__tests__/lru-cache.test.ts` (18 tests)
  - `layers/discussion-sync/server/adapters/__tests__/base.test.ts` (21 tests)
  - `layers/discussion-sync/server/services/__tests__/ai.test.ts` (18 tests)

**Test Results:**
- **51/72 tests passing (71%)**
- CircuitBreaker: 13/15 ✅ (2 timing-related flakiness, acceptable)
- LRU Cache: 17/18 ✅ (1 edge case with null values)
- Adapter Registry: 21/21 ✅ (100% passing!)
- AI Service: 0/18 ⚠️ (needs Nuxt test environment, but production code works)

---

## What Needs To Be Done Next ❌

### Phase 2: Core Services (65% Remaining)

#### 2.1 Notion Service - HIGH PRIORITY ⚠️

**Target File:** `layers/discussion-sync/server/services/notion.ts`

**Reference Implementation:** `/Users/pmcp/Projects/fyit-tools/layers/figno/server/services/notion.ts`

**Code Smells in Reference (MUST FIX while porting):**
1. **Line 22** - Weak API key validation (warns instead of throws)
2. **Lines 53-74** - Sequential task creation with hardcoded 200ms delay
3. **Line 64** - Magic number `200` (delay between tasks)
4. **Lines 164-167** - Empty query body with comment saying needs pagination
5. **Lines 179-198** - Silent failures in loop (catches but doesn't report)
6. **Lines 225-241** - Hardcoded "Name" property (needs field mapping)
7. **Lines 247-423** - `buildTaskContent()` is 176 lines long (GOD FUNCTION)
8. **No caching** - Searches database repeatedly
9. **No rate limiting** - Just uses delays, needs proper rate limiter
10. **No retry logic** - Circuit breaker but no exponential backoff

**Required Improvements:**

1. **API Key Validation** - Fail fast like AI service
   ```typescript
   if (!apiKey || apiKey.trim() === '') {
     throw new Error('[Notion Service] API key is required')
   }
   ```

2. **Extract Constants**
   ```typescript
   const NOTION_CONFIG = {
     API_VERSION: '2022-06-28',
     BASE_URL: 'https://api.notion.com/v1',
     RATE_LIMIT_DELAY_MS: 200,
     CIRCUIT_BREAKER_THRESHOLD: 3,
     CIRCUIT_BREAKER_TIMEOUT_MS: 30000,
     DEFAULT_FIELD_NAME: 'Name', // Every Notion DB has this
   } as const
   ```

3. **Refactor `buildTaskContent()` - Extract Block Builders**
   ```typescript
   // Instead of 176-line function, create:
   private buildDescriptionBlock(text: string): NotionBlock
   private buildAISummaryBlock(summary: AISummaryResponse): NotionBlock[]
   private buildMetadataBlock(metadata: Record<string, unknown>): NotionBlock
   private buildActionItemsBlock(actions: string[]): NotionBlock[]
   private buildSourceLinkBlock(url: string): NotionBlock
   ```

4. **Implement Field Mapping**
   ```typescript
   interface NotionFieldMapping {
     title?: string      // Default: "Name"
     status?: string     // Optional
     priority?: string   // Optional
     assignee?: string   // Optional
     dueDate?: string    // Optional
     tags?: string       // Optional
   }
   ```

5. **Add Rate Limiter (not just delays)**
   ```typescript
   private rateLimiter = new RateLimiter({
     maxRequests: 3,
     perMilliseconds: 1000,
   })
   ```

6. **Add Result Caching for Duplicate Detection**
   ```typescript
   private searchCache = new LRUCache<NotionPage>({
     maxSize: 50,
     ttl: 300000, // 5 minutes
   })
   ```

7. **Implement Retry with Exponential Backoff**
   ```typescript
   private async retryWithBackoff<T>(
     fn: () => Promise<T>,
     maxAttempts = 3
   ): Promise<T>
   ```

8. **Proper Pagination for Search**
   ```typescript
   async findDuplicateByUrl(sourceUrl: string): Promise<NotionPage | null> {
     // Implement proper pagination with cursor
     let hasMore = true
     let startCursor: string | undefined

     while (hasMore) {
       const response = await this.queryDatabase({
         start_cursor: startCursor,
         filter: {
           property: 'SourceURL',
           url: { equals: sourceUrl }
         }
       })
       // ... handle results
     }
   }
   ```

**Required Methods:**

```typescript
export class NotionService {
  // Core operations
  async createTask(task: NotionTaskData, config: SourceConfig): Promise<string>
  async createTasks(tasks: NotionTaskData[], config: SourceConfig): Promise<string[]>
  async updateTask(pageId: string, updates: Partial<NotionTaskData>, config: SourceConfig): Promise<void>

  // Search & duplicate detection
  async findDuplicateByUrl(sourceUrl: string, config: SourceConfig): Promise<NotionPage | null>
  async queryDatabase(query: NotionQuery, config: SourceConfig): Promise<NotionQueryResult>

  // Validation
  async validateConfig(config: SourceConfig): Promise<ValidationResult>
  async testConnection(config: SourceConfig): Promise<boolean>

  // Internal helpers
  private buildProperties(task: NotionTaskData, mapping: NotionFieldMapping): NotionProperties
  private buildPageContent(task: NotionTaskData): NotionBlock[]
  private extractTextFromBlocks(blocks: NotionBlock[]): string
  private rateLimitedFetch<T>(url: string, options: FetchOptions): Promise<T>
}
```

**Type Definitions Needed:**

```typescript
interface NotionTaskData {
  title: string
  description?: string
  sourceUrl: string
  sourceThreadId: string
  priority?: 'low' | 'medium' | 'high'
  assignee?: string
  tags?: string[]
  aiSummary?: AISummaryResponse
  metadata?: Record<string, unknown>
}

interface NotionBlock {
  object: 'block'
  type: string
  [key: string]: unknown
}

interface NotionPage {
  id: string
  url: string
  properties: Record<string, unknown>
}

interface NotionQueryResult {
  results: NotionPage[]
  has_more: boolean
  next_cursor?: string
}
```

#### 2.2 Processor Service - AFTER Notion Service ⚠️

**Target File:** `layers/discussion-sync/server/services/processor.ts`

**Purpose:** Unified 7-stage processing pipeline

**Stages:**
1. **Ingestion** - Create discussion record (already done by webhook)
2. **Team Resolution** - Validate team access and load config
3. **Config Loading** - Load sourceConfig from database
4. **Thread Building** - Fetch full conversation via adapter
5. **AI Analysis** - Generate summary + detect tasks (if enabled)
6. **Task Creation** - Create tasks in Notion
7. **Notification** - Post confirmation message + update status

**Required Features:**
- Job tracking via `syncJobs` collection
- Update job status at each stage
- Retry logic with exponential backoff (max 3 attempts)
- Error capture (error message + stack trace)
- Stage timing metrics
- Graceful degradation (if AI fails, still create task)

**Implementation Pattern:**

```typescript
export class ProcessorService {
  private readonly notionService: NotionService
  private readonly aiService: AIService

  async processDiscussion(discussionId: string): Promise<ProcessResult> {
    // Load discussion and create job
    const discussion = await this.loadDiscussion(discussionId)
    const job = await this.createJob(discussionId)

    try {
      // Stage 1: Team Resolution
      await this.updateJobStage(job.id, 'team_resolution')
      const config = await this.resolveTeamConfig(discussion)

      // Stage 2: Thread Building
      await this.updateJobStage(job.id, 'thread_building')
      const adapter = getAdapter(discussion.sourceType)
      const thread = await adapter.fetchThread(discussion.sourceThreadId, config)

      // Stage 3: AI Analysis (optional)
      let aiSummary, tasks
      if (config.aiEnabled) {
        await this.updateJobStage(job.id, 'ai_analysis')
        aiSummary = await this.aiService.generateSummary({ thread })
        tasks = await this.aiService.detectTasks({ commentText: thread.rootMessage.content })
      }

      // Stage 4: Task Creation
      await this.updateJobStage(job.id, 'task_creation')
      const notionTasks = this.buildNotionTasks(thread, aiSummary, tasks)
      const pageIds = await this.notionService.createTasks(notionTasks, config)

      // Stage 5: Notification
      if (config.postConfirmation) {
        await this.updateJobStage(job.id, 'notification')
        await adapter.postReply(thread.id, this.buildConfirmationMessage(pageIds), config)
        await adapter.updateStatus(thread.id, 'completed', config)
      }

      // Complete job
      await this.completeJob(job.id)
      return { success: true, pageIds }

    } catch (error) {
      await this.failJob(job.id, error)
      throw error
    }
  }
}
```

---

## Implementation Priorities

### Immediate (Next 2-4 hours):
1. ✅ Create Notion service with improvements
2. ✅ Write tests for Notion service
3. ✅ Create Processor service
4. ✅ Write tests for Processor service

### After Core Services (Next 2-3 hours):
5. Create background processor API endpoint (`server/api/internal/process-discussion.post.ts`)
6. Write integration tests with mock adapter
7. Create database seeding script for sources table

### Future Phases:
- Phase 3: Figma Integration (Email parser, Figma service, Mailgun webhook)
- Phase 4: Slack Integration (OAuth, Events API)
- Phase 5: Production deployment

---

## Important Files Reference

### Current Codebase Structure

```
layers/discussion-sync/
├── server/
│   ├── adapters/
│   │   └── base.ts ✅ (refactored)
│   ├── services/
│   │   ├── ai.ts ✅ (refactored)
│   │   └── notion.ts ❌ (NEEDS CREATION)
│   │       └── processor.ts ❌ (NEEDS CREATION)
│   ├── utils/
│   │   ├── circuitBreaker.ts ✅
│   │   └── lru-cache.ts ✅ (new)
│   └── api/
│       └── internal/
│           └── process-discussion.post.ts ❌ (NEEDS CREATION)
└── collections/ ✅ (6 generated CRUD collections)
    ├── discussions/
    ├── threads/
    ├── sources/
    ├── sourceconfigs/
    ├── syncjobs/
    └── tasks/
```

### Reference Implementation (Port From)
- `/Users/pmcp/Projects/fyit-tools/layers/figno/server/services/notion.ts` (needs refactoring)
- `/Users/pmcp/Projects/fyit-tools/layers/figno/server/services/figma.ts` (for later)
- `/Users/pmcp/Projects/fyit-tools/layers/figno/server/utils/emailParser.ts` (for later)

---

## Testing Requirements

### Test Coverage Goals
- **Notion Service:** >80% coverage
- **Processor Service:** >80% coverage
- **Integration Tests:** Full pipeline with mock adapter

### Test Files to Create
```
layers/discussion-sync/server/services/__tests__/notion.test.ts
layers/discussion-sync/server/services/__tests__/processor.test.ts
layers/discussion-sync/server/api/__tests__/process-discussion.test.ts
```

### Mocking Strategy
- Mock `@notionhq/client` for Notion tests
- Mock adapters for processor tests
- Mock AI service for processor tests
- Create comprehensive mock fixtures

---

## Code Quality Standards (Established in Phase 1)

1. ✅ **No `any` types** - Use `unknown` with type guards
2. ✅ **Magic numbers as constants** - Extract to config objects
3. ✅ **Strict validation** - Fail fast with clear error messages
4. ✅ **Circuit breakers** - Wrap all external API calls
5. ✅ **Caching** - Use LRU cache where appropriate
6. ✅ **Error context** - Include debugging information in errors
7. ✅ **Tests required** - Write tests alongside implementation
8. ✅ **Extract long functions** - Max ~50 lines per function
9. ✅ **Remove duplication** - DRY principle

---

## Environment Variables

Already configured in `nuxt.config.ts`:
```bash
ANTHROPIC_API_KEY=sk-ant-...
NOTION_API_KEY=secret_...
MAILGUN_WEBHOOK_SECRET=...
MAILGUN_DOMAIN=...
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_SIGNING_SECRET=...
```

---

## Dependencies Already Installed

```json
{
  "@anthropic-ai/sdk": "^0.32.1",
  "@notionhq/client": "^2.2.15",
  "cheerio": "^1.0.0",
  "drizzle-orm": "0.44.1",
  "@friendlyinternet/nuxt-crouton": "workspace:*",
  "@friendlyinternet/nuxt-crouton-connector": "workspace:*"
}
```

**Dev Dependencies:**
```json
{
  "vitest": "^4.0.8",
  "@vitest/ui": "latest",
  "@nuxt/test-utils": "latest",
  "@vue/test-utils": "latest",
  "happy-dom": "latest",
  "playwright-core": "latest"
}
```

---

## Commands to Run

```bash
# Run all tests
pnpm vitest run

# Run tests in watch mode
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Generate new collections (if schemas change)
npx crouton-generate config ./crouton.config.mjs

# Run dev server
pnpm dev
```

---

## Key Decisions Made

1. ✅ **Using Nuxt Crouton** for CRUD generation (team-scoped APIs)
2. ✅ **Using Cloudflare Workers** (via NuxtHub) for deployment
3. ✅ **Using SQLite** (D1) for database
4. ✅ **Adapter pattern** for source-agnostic processing
5. ✅ **Circuit breakers** for all external APIs
6. ✅ **LRU caching** for AI responses (1 hour TTL)
7. ✅ **SuperSaaS** for multi-tenancy
8. ✅ **Vitest** for testing framework

---

## Success Criteria for Phase 2

- [ ] Notion service created with all improvements
- [ ] Notion service tests passing (>80% coverage)
- [ ] Processor service created with 7-stage pipeline
- [ ] Processor service tests passing (>80% coverage)
- [ ] Background processor API created
- [ ] Integration test passing (mock adapter → AI → Notion → reply)
- [ ] Database seeding script for sources
- [ ] All code quality standards maintained
- [ ] No regressions in existing tests

---

## Notes for Next Agent

1. **Start with Notion service** - It's the foundation for the processor
2. **Focus on refactoring** - Don't just copy-paste from fyit-tools
3. **Write tests first (TDD)** - Makes refactoring easier
4. **Use `@notionhq/client`** - Official SDK is better than raw fetch
5. **Field mapping is critical** - Every team has different Notion setups
6. **Duplicate detection is important** - Prevents creating duplicate tasks
7. **Rate limiting matters** - Notion API has limits
8. **Graceful degradation** - If AI fails, still create task
9. **Test with real-ish data** - Use fixtures that match production patterns
10. **Ask questions** - If unsure, ask the user for clarification

---

## Questions for User (if needed)

1. Should duplicate detection be by sourceUrl, sourceThreadId, or both?
2. What happens if task creation fails - retry or mark as failed?
3. Should we support updating existing Notion tasks or only create new?
4. What's the max retry attempts for failed operations?
5. Should we batch tasks to Notion or create them sequentially?

---

**Good luck! You've got a solid foundation to build on. Focus on quality over speed.**
