// Generated with array reference post-processing support (v2024-10-12)
import { eq, and, desc, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as tables from './schema'
import type { DiscussionSyncTask, NewDiscussionSyncTask } from './types'
import * as discussionsSchema from '../../../discussions/server/database/schema'
import * as threadsSchema from '../../../threads/server/database/schema'
import * as syncJobsSchema from '../../../syncJobs/server/database/schema'
import { users } from '~~/server/database/schema'

export async function getAllDiscussionSyncTasks(teamId: string) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const tasks = await db
    .select({
      ...tables.discussionSyncTasks,
      discussionIdData: discussionsSchema.discussionSyncDiscussions,
      threadIdData: threadsSchema.discussionSyncThreads,
      syncJobIdData: syncJobsSchema.discussionSyncSyncJobs,
      ownerUser: {
        id: ownerUsers.id,
        name: ownerUsers.name,
        email: ownerUsers.email,
        avatarUrl: ownerUsers.avatarUrl
      },
      createdByUser: {
        id: createdByUsers.id,
        name: createdByUsers.name,
        email: createdByUsers.email,
        avatarUrl: createdByUsers.avatarUrl
      },
      updatedByUser: {
        id: updatedByUsers.id,
        name: updatedByUsers.name,
        email: updatedByUsers.email,
        avatarUrl: updatedByUsers.avatarUrl
      }
    })
    .from(tables.discussionSyncTasks)
    .leftJoin(discussionsSchema.discussionSyncDiscussions, eq(tables.discussionSyncTasks.discussionId, discussionsSchema.discussionSyncDiscussions.id))
    .leftJoin(threadsSchema.discussionSyncThreads, eq(tables.discussionSyncTasks.threadId, threadsSchema.discussionSyncThreads.id))
    .leftJoin(syncJobsSchema.discussionSyncSyncJobs, eq(tables.discussionSyncTasks.syncJobId, syncJobsSchema.discussionSyncSyncJobs.id))
    .leftJoin(ownerUsers, eq(tables.discussionSyncTasks.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionSyncTasks.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionSyncTasks.updatedBy, updatedByUsers.id))
    .where(eq(tables.discussionSyncTasks.teamId, teamId))
    .orderBy(desc(tables.discussionSyncTasks.createdAt))

  return tasks
}

export async function getDiscussionSyncTasksByIds(teamId: string, taskIds: string[]) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const tasks = await db
    .select({
      ...tables.discussionSyncTasks,
      discussionIdData: discussionsSchema.discussionSyncDiscussions,
      threadIdData: threadsSchema.discussionSyncThreads,
      syncJobIdData: syncJobsSchema.discussionSyncSyncJobs,
      ownerUser: {
        id: ownerUsers.id,
        name: ownerUsers.name,
        email: ownerUsers.email,
        avatarUrl: ownerUsers.avatarUrl
      },
      createdByUser: {
        id: createdByUsers.id,
        name: createdByUsers.name,
        email: createdByUsers.email,
        avatarUrl: createdByUsers.avatarUrl
      },
      updatedByUser: {
        id: updatedByUsers.id,
        name: updatedByUsers.name,
        email: updatedByUsers.email,
        avatarUrl: updatedByUsers.avatarUrl
      }
    })
    .from(tables.discussionSyncTasks)
    .leftJoin(discussionsSchema.discussionSyncDiscussions, eq(tables.discussionSyncTasks.discussionId, discussionsSchema.discussionSyncDiscussions.id))
    .leftJoin(threadsSchema.discussionSyncThreads, eq(tables.discussionSyncTasks.threadId, threadsSchema.discussionSyncThreads.id))
    .leftJoin(syncJobsSchema.discussionSyncSyncJobs, eq(tables.discussionSyncTasks.syncJobId, syncJobsSchema.discussionSyncSyncJobs.id))
    .leftJoin(ownerUsers, eq(tables.discussionSyncTasks.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionSyncTasks.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionSyncTasks.updatedBy, updatedByUsers.id))
    .where(
      and(
        eq(tables.discussionSyncTasks.teamId, teamId),
        inArray(tables.discussionSyncTasks.id, taskIds)
      )
    )
    .orderBy(desc(tables.discussionSyncTasks.createdAt))

  return tasks
}

export async function createDiscussionSyncTask(data: NewDiscussionSyncTask) {
  const db = useDB()

  const [task] = await db
    .insert(tables.discussionSyncTasks)
    .values(data)
    .returning()

  return task
}

export async function updateDiscussionSyncTask(
  recordId: string,
  teamId: string,
  ownerId: string,
  updates: Partial<DiscussionSyncTask>
) {
  const db = useDB()

  const [task] = await db
    .update(tables.discussionSyncTasks)
    .set({
      ...updates,
      updatedBy: ownerId
    })
    .where(
      and(
        eq(tables.discussionSyncTasks.id, recordId),
        eq(tables.discussionSyncTasks.teamId, teamId),
        eq(tables.discussionSyncTasks.owner, ownerId)
      )
    )
    .returning()

  if (!task) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionSyncTask not found or unauthorized'
    })
  }

  return task
}

export async function deleteDiscussionSyncTask(
  recordId: string,
  teamId: string,
  ownerId: string
) {
  const db = useDB()

  const [deleted] = await db
    .delete(tables.discussionSyncTasks)
    .where(
      and(
        eq(tables.discussionSyncTasks.id, recordId),
        eq(tables.discussionSyncTasks.teamId, teamId),
        eq(tables.discussionSyncTasks.owner, ownerId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionSyncTask not found or unauthorized'
    })
  }

  return { success: true }
}