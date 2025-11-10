/**
 * Processor Service
 * Unified 7-stage processing pipeline for discussion-to-task synchronization
 *
 * STAGES:
 * 1. Ingestion - Create discussion record (done by webhook)
 * 2. Team Resolution - Validate team access and load config
 * 3. Config Loading - Load sourceConfig from database
 * 4. Thread Building - Fetch full conversation via adapter
 * 5. AI Analysis - Generate summary + detect tasks (if enabled)
 * 6. Task Creation - Create tasks in Notion
 * 7. Notification - Post confirmation message + update status
 *
 * FEATURES:
 * - Job tracking via syncJobs collection
 * - Update job status at each stage
 * - Retry logic with exponential backoff (max 3 attempts)
 * - Error capture (error message + stack trace)
 * - Stage timing metrics
 * - Graceful degradation (if AI fails, still create task)
 */

import { eq } from 'drizzle-orm'
import { AIService } from './ai'
import { NotionService } from './notion'
import type { NotionTaskData } from './notion'
import { getAdapter } from '../adapters/base'
import type { DiscussionThread, DiscussionStatus, SourceConfig } from '../adapters/base'

// ============================================
// CONSTANTS
// ============================================

const PROCESSOR_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 2000,
  RETRY_MAX_DELAY_MS: 30000,
} as const

// ============================================
// TYPES
// ============================================

export type ProcessorStage =
  | 'pending'
  | 'team_resolution'
  | 'config_loading'
  | 'thread_building'
  | 'ai_analysis'
  | 'task_creation'
  | 'notification'
  | 'completed'

export type ProcessorStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ProcessResult {
  success: boolean
  jobId: string
  discussionId: string
  pageIds?: string[]
  error?: string
  processingTime?: number
}

export interface Discussion {
  id: string
  teamId: string
  owner: string
  sourceType: string
  sourceThreadId: string
  sourceUrl: string
  sourceConfigId: string
  title: string
  content: string
  authorHandle: string
  participants?: string[]
  status: DiscussionStatus
  threadId?: string
  syncJobId?: string
  rawPayload?: Record<string, unknown>
  metadata?: Record<string, unknown>
  processedAt?: Date
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
}

export interface SyncJob {
  id: string
  teamId: string
  owner: string
  discussionId: string
  sourceConfigId: string
  status: ProcessorStatus
  stage?: ProcessorStage
  attempts: number
  maxAttempts: number
  error?: string
  errorStack?: string
  startedAt?: Date
  completedAt?: Date
  processingTime?: number
  taskIds?: string[]
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
}

// ============================================
// PROCESSOR SERVICE CLASS
// ============================================

export class ProcessorService {
  private readonly aiService: AIService
  private readonly notionService: NotionService

  constructor(aiService?: AIService, notionService?: NotionService) {
    // Allow dependency injection for testing
    this.aiService = aiService || new AIService()
    this.notionService = notionService || new NotionService()
  }

  /**
   * Main processing method - orchestrates the 7-stage pipeline
   */
  async processDiscussion(discussionId: string): Promise<ProcessResult> {
    const startTime = Date.now()

    console.log('[Processor] Starting processing:', discussionId)

    // Load discussion
    const discussion = await this.loadDiscussion(discussionId)
    if (!discussion) {
      throw new Error(`Discussion not found: ${discussionId}`)
    }

    // Create job
    const job = await this.createJob(discussion)

    try {
      // STAGE 1: Team Resolution (validate team access)
      await this.updateJobStage(job.id, 'team_resolution')
      await this.validateTeamAccess(discussion)

      // STAGE 2: Config Loading
      await this.updateJobStage(job.id, 'config_loading')
      const config = await this.loadSourceConfig(discussion.sourceConfigId, discussion.teamId)

      // STAGE 3: Thread Building
      await this.updateJobStage(job.id, 'thread_building')
      const thread = await this.buildThread(discussion, config)

      // STAGE 4: AI Analysis (optional, with graceful degradation)
      let aiSummary
      let detectedTasks

      if (config.aiEnabled) {
        await this.updateJobStage(job.id, 'ai_analysis')

        try {
          [aiSummary, detectedTasks] = await this.analyzeWithAI(thread, config)
        }
        catch (error) {
          console.warn('[Processor] AI analysis failed, continuing without:', error)
          // Graceful degradation - continue without AI
        }
      }

      // STAGE 5: Task Creation
      await this.updateJobStage(job.id, 'task_creation')
      const notionTasks = this.buildNotionTasks(discussion, thread, aiSummary, detectedTasks)
      const pageIds = await this.createNotionTasks(notionTasks, config)

      // STAGE 6: Notification
      if (config.postConfirmation) {
        await this.updateJobStage(job.id, 'notification')
        await this.sendNotification(discussion, thread, pageIds, config)
      }

      // STAGE 7: Complete
      const processingTime = Date.now() - startTime
      await this.completeJob(job.id, pageIds, processingTime)

      console.log('[Processor] Processing completed:', {
        discussionId,
        jobId: job.id,
        pageIds,
        processingTime: `${processingTime}ms`,
      })

      return {
        success: true,
        jobId: job.id,
        discussionId: discussion.id,
        pageIds,
        processingTime,
      }
    }
    catch (error) {
      const processingTime = Date.now() - startTime
      await this.failJob(job.id, error, processingTime)

      console.error('[Processor] Processing failed:', {
        discussionId,
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
        processingTime: `${processingTime}ms`,
      })

      return {
        success: false,
        jobId: job.id,
        discussionId: discussion.id,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      }
    }
  }

  /**
   * Process discussion with retry logic
   */
  async processWithRetry(discussionId: string): Promise<ProcessResult> {
    let lastError: Error | unknown
    let lastResult: ProcessResult | undefined

    for (let attempt = 1; attempt <= PROCESSOR_CONFIG.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const result = await this.processDiscussion(discussionId)

        if (result.success) {
          return result
        }

        lastResult = result
        lastError = new Error(result.error)

        if (attempt === PROCESSOR_CONFIG.MAX_RETRY_ATTEMPTS) {
          break
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          PROCESSOR_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1),
          PROCESSOR_CONFIG.RETRY_MAX_DELAY_MS,
        )

        console.warn(
          `[Processor] Attempt ${attempt}/${PROCESSOR_CONFIG.MAX_RETRY_ATTEMPTS} failed, ` +
          `retrying in ${delay}ms`,
        )

        await new Promise(resolve => setTimeout(resolve, delay))
      }
      catch (error) {
        lastError = error

        if (attempt === PROCESSOR_CONFIG.MAX_RETRY_ATTEMPTS) {
          break
        }

        const delay = Math.min(
          PROCESSOR_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1),
          PROCESSOR_CONFIG.RETRY_MAX_DELAY_MS,
        )

        console.warn(`[Processor] Retry ${attempt}/${PROCESSOR_CONFIG.MAX_RETRY_ATTEMPTS}`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // All attempts failed
    if (lastResult) {
      return lastResult
    }

    throw lastError
  }

  // ============================================
  // PRIVATE METHODS - Data Loading
  // ============================================

  private async loadDiscussion(discussionId: string): Promise<Discussion | null> {
    const db = useDb()

    const { discussionSyncDiscussions } = await import(
      '../../collections/discussions/server/database/schema'
    )

    const results = await db
      .select()
      .from(discussionSyncDiscussions)
      .where(eq(discussionSyncDiscussions.id, discussionId))
      .limit(1)

    return results.length > 0 ? (results[0] as Discussion) : null
  }

  private async loadSourceConfig(
    sourceConfigId: string,
    teamId: string,
  ): Promise<SourceConfig> {
    const db = useDb()

    const { discussionSyncSourceconfigs } = await import(
      '../../collections/sourceconfigs/server/database/schema'
    )

    const results = await db
      .select()
      .from(discussionSyncSourceconfigs)
      .where(eq(discussionSyncSourceconfigs.id, sourceConfigId))
      .limit(1)

    if (results.length === 0) {
      throw new Error(`Source config not found: ${sourceConfigId}`)
    }

    const config = results[0] as any

    // Validate team access
    if (config.teamId !== teamId) {
      throw new Error(`Source config belongs to different team`)
    }

    // Validate config is active
    if (!config.active) {
      throw new Error(`Source config is not active`)
    }

    return config as SourceConfig
  }

  // ============================================
  // PRIVATE METHODS - Job Management
  // ============================================

  private async createJob(discussion: Discussion): Promise<SyncJob> {
    const db = useDb()

    const { discussionSyncSyncjobs } = await import(
      '../../collections/syncjobs/server/database/schema'
    )

    const jobData = {
      teamId: discussion.teamId,
      owner: discussion.owner,
      discussionId: discussion.id,
      sourceConfigId: discussion.sourceConfigId,
      status: 'processing' as ProcessorStatus,
      stage: 'pending' as ProcessorStage,
      attempts: 0,
      maxAttempts: PROCESSOR_CONFIG.MAX_RETRY_ATTEMPTS,
      startedAt: new Date(),
      createdBy: discussion.owner,
      updatedBy: discussion.owner,
    }

    const results = await db.insert(discussionSyncSyncjobs).values(jobData).returning()

    return results[0] as SyncJob
  }

  private async updateJobStage(jobId: string, stage: ProcessorStage): Promise<void> {
    const db = useDb()

    const { discussionSyncSyncjobs } = await import(
      '../../collections/syncjobs/server/database/schema'
    )

    await db
      .update(discussionSyncSyncjobs)
      .set({
        stage,
        updatedAt: new Date(),
      })
      .where(eq(discussionSyncSyncjobs.id, jobId))

    console.log(`[Processor] Stage updated: ${stage}`)
  }

  private async completeJob(
    jobId: string,
    taskIds: string[],
    processingTime: number,
  ): Promise<void> {
    const db = useDb()

    const { discussionSyncSyncjobs } = await import(
      '../../collections/syncjobs/server/database/schema'
    )

    await db
      .update(discussionSyncSyncjobs)
      .set({
        status: 'completed',
        stage: 'completed',
        taskIds,
        completedAt: new Date(),
        processingTime,
        updatedAt: new Date(),
      })
      .where(eq(discussionSyncSyncjobs.id, jobId))

    console.log('[Processor] Job completed:', jobId)
  }

  private async failJob(
    jobId: string,
    error: unknown,
    processingTime: number,
  ): Promise<void> {
    const db = useDb()

    const { discussionSyncSyncjobs } = await import(
      '../../collections/syncjobs/server/database/schema'
    )

    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    await db
      .update(discussionSyncSyncjobs)
      .set({
        status: 'failed',
        error: errorMessage,
        errorStack,
        completedAt: new Date(),
        processingTime,
        updatedAt: new Date(),
      })
      .where(eq(discussionSyncSyncjobs.id, jobId))

    console.error('[Processor] Job failed:', jobId, errorMessage)
  }

  // ============================================
  // PRIVATE METHODS - Processing Stages
  // ============================================

  private async validateTeamAccess(discussion: Discussion): Promise<void> {
    // TODO: Add team access validation logic
    // For now, just log
    console.log('[Processor] Team validation:', discussion.teamId)
  }

  private async buildThread(
    discussion: Discussion,
    config: SourceConfig,
  ): Promise<DiscussionThread> {
    const adapter = getAdapter(discussion.sourceType)

    console.log('[Processor] Building thread:', {
      sourceType: discussion.sourceType,
      threadId: discussion.sourceThreadId,
    })

    return adapter.fetchThread(discussion.sourceThreadId, config)
  }

  private async analyzeWithAI(
    thread: DiscussionThread,
    config: SourceConfig,
  ): Promise<[any, any]> {
    console.log('[Processor] AI analysis starting')

    // Generate summary
    const summary = await this.aiService.generateSummary({
      thread,
      customPrompt: config.aiSummaryPrompt,
    })

    // Detect tasks
    const tasks = await this.aiService.detectTasks({
      commentText: thread.rootMessage.content,
      threadContext: thread,
      customPrompt: config.aiTaskPrompt,
    })

    console.log('[Processor] AI analysis completed:', {
      hasSummary: !!summary,
      taskCount: tasks.tasks.length,
    })

    return [summary, tasks]
  }

  private buildNotionTasks(
    discussion: Discussion,
    thread: DiscussionThread,
    aiSummary?: any,
    detectedTasks?: any,
  ): NotionTaskData[] {
    const tasks: NotionTaskData[] = []

    // If AI detected multiple tasks, create each one
    if (detectedTasks && detectedTasks.isMultiTask && detectedTasks.tasks.length > 1) {
      for (const task of detectedTasks.tasks) {
        tasks.push({
          title: task.title,
          description: task.description,
          sourceUrl: discussion.sourceUrl,
          sourceThreadId: discussion.sourceThreadId,
          priority: task.priority,
          aiSummary,
          metadata: {
            ...discussion.metadata,
            taskId: task.id,
            threadSize: thread.replies.length + 1,
            participants: thread.participants,
          },
        })
      }
    }
    else {
      // Single task
      tasks.push({
        title: discussion.title,
        description: thread.rootMessage.content,
        sourceUrl: discussion.sourceUrl,
        sourceThreadId: discussion.sourceThreadId,
        aiSummary,
        metadata: {
          ...discussion.metadata,
          threadSize: thread.replies.length + 1,
          participants: thread.participants,
        },
      })
    }

    console.log('[Processor] Built Notion tasks:', tasks.length)
    return tasks
  }

  private async createNotionTasks(
    tasks: NotionTaskData[],
    config: SourceConfig,
  ): Promise<string[]> {
    console.log('[Processor] Creating Notion tasks:', tasks.length)

    const pageIds = await this.notionService.createTasks(tasks, config)

    console.log('[Processor] Created Notion tasks:', pageIds)
    return pageIds
  }

  private async sendNotification(
    discussion: Discussion,
    thread: DiscussionThread,
    pageIds: string[],
    config: SourceConfig,
  ): Promise<void> {
    const adapter = getAdapter(discussion.sourceType)

    const message = this.buildConfirmationMessage(pageIds, config)

    console.log('[Processor] Sending notification:', {
      sourceType: discussion.sourceType,
      threadId: thread.id,
      pageCount: pageIds.length,
    })

    try {
      // Post reply
      await adapter.postReply(thread.id, message, config)

      // Update status
      await adapter.updateStatus(thread.id, 'completed', config)

      console.log('[Processor] Notification sent')
    }
    catch (error) {
      console.warn('[Processor] Notification failed (non-fatal):', error)
      // Non-fatal - don't throw
    }
  }

  // ============================================
  // PRIVATE METHODS - Utilities
  // ============================================

  private buildConfirmationMessage(pageIds: string[], config: SourceConfig): string {
    const taskWord = pageIds.length === 1 ? 'task' : 'tasks'

    let message = `✅ Created ${pageIds.length} ${taskWord} in Notion`

    if (pageIds.length <= 3) {
      // Include links for small number of tasks
      message += ':\n'
      for (const pageId of pageIds) {
        message += `• https://notion.so/${pageId.replace(/-/g, '')}\n`
      }
    }

    return message
  }

  /**
   * Destroy service and cleanup resources
   */
  destroy(): void {
    this.aiService.destroy()
    this.notionService.destroy()
  }
}
