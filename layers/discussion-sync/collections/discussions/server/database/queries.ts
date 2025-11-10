// Generated with array reference post-processing support (v2024-10-12)
import { eq, and, desc, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as tables from './schema'
import type { DiscussionSyncDiscussion, NewDiscussionSyncDiscussion } from './types'
import * as sourceConfigsSchema from '../../../sourceConfigs/server/database/schema'
import * as threadsSchema from '../../../threads/server/database/schema'
import * as syncJobsSchema from '../../../syncJobs/server/database/schema'
import { users } from '~~/server/database/schema'

export async function getAllDiscussionSyncDiscussions(teamId: string) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const discussions = await db
    .select({
      ...tables.discussionSyncDiscussions,
      sourceConfigIdData: sourceConfigsSchema.discussionSyncSourceConfigs,
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
    .from(tables.discussionSyncDiscussions)
    .leftJoin(sourceConfigsSchema.discussionSyncSourceConfigs, eq(tables.discussionSyncDiscussions.sourceConfigId, sourceConfigsSchema.discussionSyncSourceConfigs.id))
    .leftJoin(threadsSchema.discussionSyncThreads, eq(tables.discussionSyncDiscussions.threadId, threadsSchema.discussionSyncThreads.id))
    .leftJoin(syncJobsSchema.discussionSyncSyncJobs, eq(tables.discussionSyncDiscussions.syncJobId, syncJobsSchema.discussionSyncSyncJobs.id))
    .leftJoin(ownerUsers, eq(tables.discussionSyncDiscussions.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionSyncDiscussions.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionSyncDiscussions.updatedBy, updatedByUsers.id))
    .where(eq(tables.discussionSyncDiscussions.teamId, teamId))
    .orderBy(desc(tables.discussionSyncDiscussions.createdAt))

  return discussions
}

export async function getDiscussionSyncDiscussionsByIds(teamId: string, discussionIds: string[]) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const discussions = await db
    .select({
      ...tables.discussionSyncDiscussions,
      sourceConfigIdData: sourceConfigsSchema.discussionSyncSourceConfigs,
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
    .from(tables.discussionSyncDiscussions)
    .leftJoin(sourceConfigsSchema.discussionSyncSourceConfigs, eq(tables.discussionSyncDiscussions.sourceConfigId, sourceConfigsSchema.discussionSyncSourceConfigs.id))
    .leftJoin(threadsSchema.discussionSyncThreads, eq(tables.discussionSyncDiscussions.threadId, threadsSchema.discussionSyncThreads.id))
    .leftJoin(syncJobsSchema.discussionSyncSyncJobs, eq(tables.discussionSyncDiscussions.syncJobId, syncJobsSchema.discussionSyncSyncJobs.id))
    .leftJoin(ownerUsers, eq(tables.discussionSyncDiscussions.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionSyncDiscussions.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionSyncDiscussions.updatedBy, updatedByUsers.id))
    .where(
      and(
        eq(tables.discussionSyncDiscussions.teamId, teamId),
        inArray(tables.discussionSyncDiscussions.id, discussionIds)
      )
    )
    .orderBy(desc(tables.discussionSyncDiscussions.createdAt))

  return discussions
}

export async function createDiscussionSyncDiscussion(data: NewDiscussionSyncDiscussion) {
  const db = useDB()

  const [discussion] = await db
    .insert(tables.discussionSyncDiscussions)
    .values(data)
    .returning()

  return discussion
}

export async function updateDiscussionSyncDiscussion(
  recordId: string,
  teamId: string,
  ownerId: string,
  updates: Partial<DiscussionSyncDiscussion>
) {
  const db = useDB()

  const [discussion] = await db
    .update(tables.discussionSyncDiscussions)
    .set({
      ...updates,
      updatedBy: ownerId
    })
    .where(
      and(
        eq(tables.discussionSyncDiscussions.id, recordId),
        eq(tables.discussionSyncDiscussions.teamId, teamId),
        eq(tables.discussionSyncDiscussions.owner, ownerId)
      )
    )
    .returning()

  if (!discussion) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionSyncDiscussion not found or unauthorized'
    })
  }

  return discussion
}

export async function deleteDiscussionSyncDiscussion(
  recordId: string,
  teamId: string,
  ownerId: string
) {
  const db = useDB()

  const [deleted] = await db
    .delete(tables.discussionSyncDiscussions)
    .where(
      and(
        eq(tables.discussionSyncDiscussions.id, recordId),
        eq(tables.discussionSyncDiscussions.teamId, teamId),
        eq(tables.discussionSyncDiscussions.owner, ownerId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionSyncDiscussion not found or unauthorized'
    })
  }

  return { success: true }
}