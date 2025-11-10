// Generated with array reference post-processing support (v2024-10-12)
import { eq, and, desc, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as tables from './schema'
import type { DiscussionSyncSourceConfig, NewDiscussionSyncSourceConfig } from './types'
import * as sourcesSchema from '../../../sources/server/database/schema'
import { users } from '~~/server/database/schema'

export async function getAllDiscussionSyncSourceConfigs(teamId: string) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const sourceconfigs = await db
    .select({
      ...tables.discussionSyncSourceconfigs,
      sourceIdData: sourcesSchema.discussionSyncSources,
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
    .from(tables.discussionSyncSourceconfigs)
    .leftJoin(sourcesSchema.discussionSyncSources, eq(tables.discussionSyncSourceconfigs.sourceId, sourcesSchema.discussionSyncSources.id))
    .leftJoin(ownerUsers, eq(tables.discussionSyncSourceconfigs.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionSyncSourceconfigs.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionSyncSourceconfigs.updatedBy, updatedByUsers.id))
    .where(eq(tables.discussionSyncSourceconfigs.teamId, teamId))
    .orderBy(desc(tables.discussionSyncSourceconfigs.createdAt))

  return sourceconfigs
}

export async function getDiscussionSyncSourceConfigsByIds(teamId: string, sourceconfigIds: string[]) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const sourceconfigs = await db
    .select({
      ...tables.discussionSyncSourceconfigs,
      sourceIdData: sourcesSchema.discussionSyncSources,
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
    .from(tables.discussionSyncSourceconfigs)
    .leftJoin(sourcesSchema.discussionSyncSources, eq(tables.discussionSyncSourceconfigs.sourceId, sourcesSchema.discussionSyncSources.id))
    .leftJoin(ownerUsers, eq(tables.discussionSyncSourceconfigs.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionSyncSourceconfigs.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionSyncSourceconfigs.updatedBy, updatedByUsers.id))
    .where(
      and(
        eq(tables.discussionSyncSourceconfigs.teamId, teamId),
        inArray(tables.discussionSyncSourceconfigs.id, sourceconfigIds)
      )
    )
    .orderBy(desc(tables.discussionSyncSourceconfigs.createdAt))

  return sourceconfigs
}

export async function createDiscussionSyncSourceConfig(data: NewDiscussionSyncSourceConfig) {
  const db = useDB()

  const [sourceconfig] = await db
    .insert(tables.discussionSyncSourceconfigs)
    .values(data)
    .returning()

  return sourceconfig
}

export async function updateDiscussionSyncSourceConfig(
  recordId: string,
  teamId: string,
  ownerId: string,
  updates: Partial<DiscussionSyncSourceConfig>
) {
  const db = useDB()

  const [sourceconfig] = await db
    .update(tables.discussionSyncSourceconfigs)
    .set({
      ...updates,
      updatedBy: ownerId
    })
    .where(
      and(
        eq(tables.discussionSyncSourceconfigs.id, recordId),
        eq(tables.discussionSyncSourceconfigs.teamId, teamId),
        eq(tables.discussionSyncSourceconfigs.owner, ownerId)
      )
    )
    .returning()

  if (!sourceconfig) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionSyncSourceConfig not found or unauthorized'
    })
  }

  return sourceconfig
}

export async function deleteDiscussionSyncSourceConfig(
  recordId: string,
  teamId: string,
  ownerId: string
) {
  const db = useDB()

  const [deleted] = await db
    .delete(tables.discussionSyncSourceconfigs)
    .where(
      and(
        eq(tables.discussionSyncSourceconfigs.id, recordId),
        eq(tables.discussionSyncSourceconfigs.teamId, teamId),
        eq(tables.discussionSyncSourceconfigs.owner, ownerId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionSyncSourceConfig not found or unauthorized'
    })
  }

  return { success: true }
}