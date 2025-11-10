// Generated with array reference post-processing support (v2024-10-12)
import { eq, and, desc, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as tables from './schema'
import type { DiscussionSyncThread, NewDiscussionSyncThread } from './types'
import * as discussionsSchema from '../../../discussions/server/database/schema'
import { users } from '~~/server/database/schema'

export async function getAllDiscussionSyncThreads(teamId: string) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const threads = await db
    .select({
      ...tables.discussionSyncThreads,
      discussionIdData: discussionsSchema.discussionSyncDiscussions,
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
    .from(tables.discussionSyncThreads)
    .leftJoin(discussionsSchema.discussionSyncDiscussions, eq(tables.discussionSyncThreads.discussionId, discussionsSchema.discussionSyncDiscussions.id))
    .leftJoin(ownerUsers, eq(tables.discussionSyncThreads.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionSyncThreads.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionSyncThreads.updatedBy, updatedByUsers.id))
    .where(eq(tables.discussionSyncThreads.teamId, teamId))
    .orderBy(desc(tables.discussionSyncThreads.createdAt))

  return threads
}

export async function getDiscussionSyncThreadsByIds(teamId: string, threadIds: string[]) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const threads = await db
    .select({
      ...tables.discussionSyncThreads,
      discussionIdData: discussionsSchema.discussionSyncDiscussions,
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
    .from(tables.discussionSyncThreads)
    .leftJoin(discussionsSchema.discussionSyncDiscussions, eq(tables.discussionSyncThreads.discussionId, discussionsSchema.discussionSyncDiscussions.id))
    .leftJoin(ownerUsers, eq(tables.discussionSyncThreads.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionSyncThreads.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionSyncThreads.updatedBy, updatedByUsers.id))
    .where(
      and(
        eq(tables.discussionSyncThreads.teamId, teamId),
        inArray(tables.discussionSyncThreads.id, threadIds)
      )
    )
    .orderBy(desc(tables.discussionSyncThreads.createdAt))

  return threads
}

export async function createDiscussionSyncThread(data: NewDiscussionSyncThread) {
  const db = useDB()

  const [thread] = await db
    .insert(tables.discussionSyncThreads)
    .values(data)
    .returning()

  return thread
}

export async function updateDiscussionSyncThread(
  recordId: string,
  teamId: string,
  ownerId: string,
  updates: Partial<DiscussionSyncThread>
) {
  const db = useDB()

  const [thread] = await db
    .update(tables.discussionSyncThreads)
    .set({
      ...updates,
      updatedBy: ownerId
    })
    .where(
      and(
        eq(tables.discussionSyncThreads.id, recordId),
        eq(tables.discussionSyncThreads.teamId, teamId),
        eq(tables.discussionSyncThreads.owner, ownerId)
      )
    )
    .returning()

  if (!thread) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionSyncThread not found or unauthorized'
    })
  }

  return thread
}

export async function deleteDiscussionSyncThread(
  recordId: string,
  teamId: string,
  ownerId: string
) {
  const db = useDB()

  const [deleted] = await db
    .delete(tables.discussionSyncThreads)
    .where(
      and(
        eq(tables.discussionSyncThreads.id, recordId),
        eq(tables.discussionSyncThreads.teamId, teamId),
        eq(tables.discussionSyncThreads.owner, ownerId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionSyncThread not found or unauthorized'
    })
  }

  return { success: true }
}