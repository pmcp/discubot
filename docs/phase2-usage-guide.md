# Phase 2 Services - Usage Guide

Quick reference for using the NotionService and ProcessorService.

---

## NotionService

### Initialization

```typescript
import { NotionService } from '~/layers/discussion-sync/server/services/notion'

// Initialize with API key
const notionService = new NotionService('secret_notion_key_123')

// Or let it read from environment/config
const notionService = new NotionService()
```

### Create a Single Task

```typescript
import type { NotionTaskData } from '~/layers/discussion-sync/server/services/notion'
import type { SourceConfig } from '~/layers/discussion-sync/server/adapters/base'

const taskData: NotionTaskData = {
  title: 'Fix button alignment issue',
  description: 'The submit button is misaligned by 2px on mobile',
  sourceUrl: 'https://figma.com/file/abc/comment/123',
  sourceThreadId: 'comment-123',
  priority: 'high',
  tags: ['bug', 'ui'],
  aiSummary: {
    summary: 'Designer noticed button alignment issue...',
    keyPoints: ['2px offset on mobile', 'Affects all breakpoints'],
    suggestedActions: ['Update button CSS', 'Test on multiple devices'],
    cached: false
  },
  metadata: {
    figmaFileKey: 'abc123',
    commentId: 'comment-123'
  }
}

const config: SourceConfig = {
  id: 'config-1',
  sourceId: 'source-1',
  name: 'Design Team Config',
  notionToken: 'secret_token',
  notionDatabaseId: 'database-id-123',
  notionFieldMapping: {
    title: 'Name',
    sourceUrl: 'SourceURL',
    priority: 'Priority',
    tags: 'Tags'
  },
  aiEnabled: true,
  autoSync: true,
  postConfirmation: true,
  active: true
}

const pageId = await notionService.createTask(taskData, config)
console.log('Created Notion page:', pageId)
```

### Create Multiple Tasks (Batch)

```typescript
const tasks: NotionTaskData[] = [
  {
    title: 'Task 1',
    description: 'First task description',
    sourceUrl: 'https://example.com/1',
    sourceThreadId: 'thread-1'
  },
  {
    title: 'Task 2',
    description: 'Second task description',
    sourceUrl: 'https://example.com/2',
    sourceThreadId: 'thread-2'
  }
]

// Creates tasks sequentially with rate limiting
const pageIds = await notionService.createTasks(tasks, config)
console.log('Created pages:', pageIds)
```

### Find Duplicate by URL

```typescript
// Checks cache first, then queries Notion with pagination
const duplicate = await notionService.findDuplicateByUrl(
  'https://figma.com/file/abc/comment/123',
  config
)

if (duplicate) {
  console.log('Duplicate found:', duplicate.id)
} else {
  console.log('No duplicate, safe to create')
}
```

### Update Existing Task

```typescript
await notionService.updateTask(
  'page-id-123',
  {
    title: 'Updated title',
    priority: 'low'
  },
  config
)
```

### Validate Configuration

```typescript
const result = await notionService.validateConfig(config)

if (result.valid) {
  console.log('Config is valid')
} else {
  console.error('Validation errors:', result.errors)
}
```

### Test Connection

```typescript
try {
  const connected = await notionService.testConnection(config)
  console.log('Connection successful:', connected)
} catch (error) {
  console.error('Connection failed:', error)
}
```

### Cache Management

```typescript
// Get cache statistics
const stats = notionService.getCacheStats()
console.log('Cache size:', stats.size)
console.log('Max size:', stats.maxSize)
console.log('Keys:', stats.keys)

// Clear cache
notionService.clearCache()

// Cleanup when done
notionService.destroy()
```

---

## ProcessorService

### Initialization

```typescript
import { ProcessorService } from '~/layers/discussion-sync/server/services/processor'

// Initialize with default services
const processor = new ProcessorService()

// Or inject custom services for testing
import { AIService } from '~/layers/discussion-sync/server/services/ai'
import { NotionService } from '~/layers/discussion-sync/server/services/notion'

const aiService = new AIService('custom-key')
const notionService = new NotionService('custom-key')
const processor = new ProcessorService(aiService, notionService)
```

### Process Discussion (Single Attempt)

```typescript
const result = await processor.processDiscussion('discussion-123')

if (result.success) {
  console.log('Processing successful!')
  console.log('Job ID:', result.jobId)
  console.log('Created pages:', result.pageIds)
  console.log('Processing time:', result.processingTime, 'ms')
} else {
  console.error('Processing failed:', result.error)
}
```

### Process with Retry Logic

```typescript
// Retries up to 3 times with exponential backoff
const result = await processor.processWithRetry('discussion-123')

if (result.success) {
  console.log('Processing successful after retries')
} else {
  console.error('Processing failed after all retries:', result.error)
}
```

### Cleanup

```typescript
// Always cleanup when done
processor.destroy()
```

### Complete Example

```typescript
async function handleDiscussion(discussionId: string) {
  const processor = new ProcessorService()

  try {
    // Process with retry
    const result = await processor.processWithRetry(discussionId)

    if (result.success) {
      console.log('✅ Success:', {
        jobId: result.jobId,
        pageIds: result.pageIds,
        time: `${result.processingTime}ms`
      })
      return result
    } else {
      console.error('❌ Failed:', result.error)
      throw new Error(result.error)
    }
  } finally {
    // Always cleanup
    processor.destroy()
  }
}
```

---

## API Endpoint Usage

### Call from Webhook

```typescript
// After creating discussion record
const discussion = await createDiscussionRecord({ ... })

// Trigger async processing
await $fetch('/api/internal/process-discussion', {
  method: 'POST',
  body: {
    discussionId: discussion.id,
    retry: false  // Optional: use retry logic
  }
})
```

### Call from Admin UI

```typescript
// Reprocess failed discussion
async function reprocessDiscussion(discussionId: string) {
  const response = await $fetch('/api/internal/process-discussion', {
    method: 'POST',
    body: {
      discussionId,
      retry: true  // Use retry logic
    }
  })

  if (response.success) {
    console.log('Reprocessed successfully:', response.pageIds)
  } else {
    console.error('Reprocessing failed:', response.error)
  }

  return response
}
```

### Response Type

```typescript
interface ProcessResponse {
  success: boolean
  jobId: string
  discussionId: string
  pageIds?: string[]
  error?: string
  processingTime?: number
}
```

---

## Error Handling

### NotionService Errors

```typescript
try {
  const pageId = await notionService.createTask(taskData, config)
} catch (error) {
  if (error.message.includes('API key is required')) {
    // Handle missing API key
  } else if (error.message.includes('Circuit breaker opened')) {
    // Handle circuit breaker (too many failures)
  } else if (error.message.includes('Notion API error')) {
    // Handle Notion API errors
  } else {
    // Handle other errors
  }
}
```

### ProcessorService Errors

```typescript
const result = await processor.processDiscussion(discussionId)

if (!result.success) {
  // Error is in result.error, not thrown
  if (result.error.includes('Discussion not found')) {
    // Handle missing discussion
  } else if (result.error.includes('Source config not found')) {
    // Handle missing config
  } else if (result.error.includes('not active')) {
    // Handle inactive config
  } else {
    // Handle other processing errors
  }
}
```

---

## Configuration Options

### NotionFieldMapping

```typescript
const fieldMapping: NotionFieldMapping = {
  title: 'Name',          // Required - every DB has this
  sourceUrl: 'SourceURL', // Optional - URL property
  priority: 'Priority',   // Optional - Select property
  tags: 'Tags',          // Optional - Multi-select property
  assignee: 'Assignee',  // Optional - Person/rich_text property
  dueDate: 'Due Date',   // Optional - Date property
  status: 'Status'       // Optional - Select property
}
```

### SourceConfig Example

```typescript
const config: SourceConfig = {
  id: 'config-1',
  sourceId: 'source-1',
  name: 'Design Team',

  // Required
  notionToken: process.env.NOTION_TOKEN,
  notionDatabaseId: 'database-id-123',

  // Optional Notion customization
  notionFieldMapping: {
    title: 'Task Name',
    priority: 'Urgency',
    tags: 'Labels'
  },

  // AI features (optional)
  aiEnabled: true,
  anthropicApiKey: process.env.ANTHROPIC_KEY,
  aiSummaryPrompt: 'Summarize this design feedback concisely',
  aiTaskPrompt: 'Extract actionable design tasks',

  // Behavior flags
  autoSync: true,          // Auto-process new discussions
  postConfirmation: true,  // Post confirmation message back to source
  active: true             // Config is active
}
```

---

## Best Practices

### 1. Always Cleanup

```typescript
const processor = new ProcessorService()
try {
  await processor.processDiscussion(id)
} finally {
  processor.destroy() // Important!
}
```

### 2. Use Retry for Important Operations

```typescript
// Use retry for user-initiated actions
await processor.processWithRetry(discussionId)

// Use single attempt for background jobs
await processor.processDiscussion(discussionId)
```

### 3. Check for Duplicates

```typescript
// Before creating task
const duplicate = await notionService.findDuplicateByUrl(sourceUrl, config)
if (duplicate) {
  console.log('Task already exists:', duplicate.id)
  return
}

// Create new task
await notionService.createTask(taskData, config)
```

### 4. Validate Config First

```typescript
const validation = await notionService.validateConfig(config)
if (!validation.valid) {
  throw new Error(`Invalid config: ${validation.errors.join(', ')}`)
}

// Proceed with operations
```

### 5. Use AI Summary When Available

```typescript
const taskData: NotionTaskData = {
  title: discussion.title,
  description: discussion.content,
  sourceUrl: discussion.sourceUrl,
  sourceThreadId: discussion.sourceThreadId,

  // Include AI summary if available
  aiSummary: aiSummaryResponse,

  metadata: {
    threadSize: thread.replies.length + 1,
    participants: thread.participants
  }
}
```

---

## Monitoring & Debugging

### Enable Detailed Logging

The services log extensively to console. Check logs for:

```
[Notion Service] Creating task: { title, sourceUrl, ... }
[Notion Service] Task created: page-123
[Processor] Starting processing: discussion-123
[Processor] Stage updated: team_resolution
[Processor] Stage updated: config_loading
[Processor] Stage updated: thread_building
[Processor] AI analysis starting
[Processor] AI analysis completed: { hasSummary: true, taskCount: 1 }
[Processor] Stage updated: task_creation
[Processor] Creating Notion tasks: 1
[Processor] Created Notion tasks: ['page-123']
[Processor] Stage updated: notification
[Processor] Sending notification: { sourceType: 'figma', ... }
[Processor] Notification sent
[Processor] Processing completed: { discussionId, jobId, pageIds, processingTime }
```

### Check Job Status

```typescript
// Query syncJobs table
const job = await db
  .select()
  .from(syncJobs)
  .where(eq(syncJobs.discussionId, discussionId))
  .limit(1)

console.log('Job status:', job.status)
console.log('Current stage:', job.stage)
console.log('Error:', job.error)
console.log('Processing time:', job.processingTime)
```

### Cache Statistics

```typescript
const stats = notionService.getCacheStats()
console.log('Duplicate detection cache:', {
  size: stats.size,
  maxSize: stats.maxSize,
  hitRate: stats.size / stats.maxSize
})
```

---

## Common Issues & Solutions

### Issue: "API key is required"
**Solution:** Set environment variable or pass key to constructor

```typescript
// Option 1: Environment variable
export NOTION_API_KEY=secret_...
export ANTHROPIC_API_KEY=sk-ant-...

// Option 2: Constructor
const service = new NotionService('secret_...')
```

### Issue: "Circuit breaker opened"
**Solution:** Too many failures, wait for reset or manually reset

```typescript
// Wait for automatic reset (30 seconds)
await new Promise(resolve => setTimeout(resolve, 30000))

// Service will auto-recover
```

### Issue: "Source config not found"
**Solution:** Ensure config exists in database

```typescript
// Create config first
await db.insert(sourceconfigs).values({
  sourceId: 'source-1',
  teamId: 'team-1',
  notionToken: '...',
  notionDatabaseId: '...',
  active: true
})
```

### Issue: Rate limiting errors
**Solution:** Services have built-in rate limiting, but you can add delays

```typescript
// Create tasks with delay
for (const task of tasks) {
  await notionService.createTask(task, config)
  await new Promise(resolve => setTimeout(resolve, 500))
}
```

---

## Next Steps

1. **Implement Adapters** - Create adapters for Figma, Slack, etc.
2. **Add Webhooks** - Set up webhook endpoints for each source
3. **Create UI** - Build admin interface for config management
4. **Deploy** - Deploy to NuxtHub/Cloudflare Workers
5. **Monitor** - Set up monitoring and alerting

---

**Happy coding! 🚀**
