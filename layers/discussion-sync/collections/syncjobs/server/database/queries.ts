// Generated with array reference post-processing support (v2024-10-12)
import { eq, and, desc, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as tables from './schema'
import type { DiscussionSyncSyncJob, NewDiscussionSyncSyncJob } from './types'
import * as discussionsSchema from '../../../discussions/server/database/schema'
import * as sourceConfigsSchema from '../../../sourceConfigs/server/database/schema'
import { users } from '~~/server/database/schema'

export async function getAllDiscussionSyncSyncJobs(teamId: string) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const syncjobs = await db
    .select({
      ...tables.discussionSyncSyncjobs,
      discussionIdData: discussionsSchema.discussionSyncDiscussions,
      sourceConfigIdData: sourceConfigsSchema.discussionSyncSourceConfigs,
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
    .from(tables.discussionSyncSyncjobs)
    .leftJoin(discussionsSchema.discussionSyncDiscussions, eq(tables.discussionSyncSyncjobs.discussionId, discussionsSchema.discussionSyncDiscussions.id))
    .leftJoin(sourceConfigsSchema.discussionSyncSourceConfigs, eq(tables.discussionSyncSyncjobs.sourceConfigId, sourceConfigsSchema.discussionSyncSourceConfigs.id))
    .leftJoin(ownerUsers, eq(tables.discussionSyncSyncjobs.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionSyncSyncjobs.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionSyncSyncjobs.updatedBy, updatedByUsers.id))
    .where(eq(tables.discussionSyncSyncjobs.teamId, teamId))
    .orderBy(desc(tables.discussionSyncSyncjobs.createdAt))

  return syncjobs
}

export async function getDiscussionSyncSyncJobsByIds(teamId: string, syncjobIds: string[]) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const syncjobs = await db
    .select({
      ...tables.discussionSyncSyncjobs,
      discussionIdData: discussionsSchema.discussionSyncDiscussions,
      sourceConfigIdData: sourceConfigsSchema.discussionSyncSourceConfigs,
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
    .from(tables.discussionSyncSyncjobs)
    .leftJoin(discussionsSchema.discussionSyncDiscussions, eq(tables.discussionSyncSyncjobs.discussionId, discussionsSchema.discussionSyncDiscussions.id))
    .leftJoin(sourceConfigsSchema.discussionSyncSourceConfigs, eq(tables.discussionSyncSyncjobs.sourceConfigId, sourceConfigsSchema.discussionSyncSourceConfigs.id))
    .leftJoin(ownerUsers, eq(tables.discussionSyncSyncjobs.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionSyncSyncjobs.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionSyncSyncjobs.updatedBy, updatedByUsers.id))
    .where(
      and(
        eq(tables.discussionSyncSyncjobs.teamId, teamId),
        inArray(tables.discussionSyncSyncjobs.id, syncjobIds)
      )
    )
    .orderBy(desc(tables.discussionSyncSyncjobs.createdAt))

  return syncjobs
}

export async function createDiscussionSyncSyncJob(data: NewDiscussionSyncSyncJob) {
  const db = useDB()

  const [syncjob] = await db
    .insert(tables.discussionSyncSyncjobs)
    .values(data)
    .returning()

  return syncjob
}

export async function updateDiscussionSyncSyncJob(
  recordId: string,
  teamId: string,
  ownerId: string,
  updates: Partial<DiscussionSyncSyncJob>
) {
  const db = useDB()

  const [syncjob] = await db
    .update(tables.discussionSyncSyncjobs)
    .set({
      ...updates,
      updatedBy: ownerId
    })
    .where(
      and(
        eq(tables.discussionSyncSyncjobs.id, recordId),
        eq(tables.discussionSyncSyncjobs.teamId, teamId),
        eq(tables.discussionSyncSyncjobs.owner, ownerId)
      )
    )
    .returning()

  if (!syncjob) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionSyncSyncJob not found or unauthorized'
    })
  }

  return syncjob
}

export async function deleteDiscussionSyncSyncJob(
  recordId: string,
  teamId: string,
  ownerId: string
) {
  const db = useDB()

  const [deleted] = await db
    .delete(tables.discussionSyncSyncjobs)
    .where(
      and(
        eq(tables.discussionSyncSyncjobs.id, recordId),
        eq(tables.discussionSyncSyncjobs.teamId, teamId),
        eq(tables.discussionSyncSyncjobs.owner, ownerId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionSyncSyncJob not found or unauthorized'
    })
  }

  return { success: true }
}