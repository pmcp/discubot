// Generated with array reference post-processing support (v2024-10-12)
import { eq, and, desc, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as tables from './schema'
import type { DiscussionSyncSource, NewDiscussionSyncSource } from './types'
import { users } from '~~/server/database/schema'

export async function getAllDiscussionSyncSources(teamId: string) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const sources = await db
    .select({
      ...tables.discussionSyncSources,
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
    .from(tables.discussionSyncSources)
    .leftJoin(ownerUsers, eq(tables.discussionSyncSources.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionSyncSources.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionSyncSources.updatedBy, updatedByUsers.id))
    .where(eq(tables.discussionSyncSources.teamId, teamId))
    .orderBy(desc(tables.discussionSyncSources.createdAt))

  return sources
}

export async function getDiscussionSyncSourcesByIds(teamId: string, sourceIds: string[]) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const sources = await db
    .select({
      ...tables.discussionSyncSources,
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
    .from(tables.discussionSyncSources)
    .leftJoin(ownerUsers, eq(tables.discussionSyncSources.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionSyncSources.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionSyncSources.updatedBy, updatedByUsers.id))
    .where(
      and(
        eq(tables.discussionSyncSources.teamId, teamId),
        inArray(tables.discussionSyncSources.id, sourceIds)
      )
    )
    .orderBy(desc(tables.discussionSyncSources.createdAt))

  return sources
}

export async function createDiscussionSyncSource(data: NewDiscussionSyncSource) {
  const db = useDB()

  const [source] = await db
    .insert(tables.discussionSyncSources)
    .values(data)
    .returning()

  return source
}

export async function updateDiscussionSyncSource(
  recordId: string,
  teamId: string,
  ownerId: string,
  updates: Partial<DiscussionSyncSource>
) {
  const db = useDB()

  const [source] = await db
    .update(tables.discussionSyncSources)
    .set({
      ...updates,
      updatedBy: ownerId
    })
    .where(
      and(
        eq(tables.discussionSyncSources.id, recordId),
        eq(tables.discussionSyncSources.teamId, teamId),
        eq(tables.discussionSyncSources.owner, ownerId)
      )
    )
    .returning()

  if (!source) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionSyncSource not found or unauthorized'
    })
  }

  return source
}

export async function deleteDiscussionSyncSource(
  recordId: string,
  teamId: string,
  ownerId: string
) {
  const db = useDB()

  const [deleted] = await db
    .delete(tables.discussionSyncSources)
    .where(
      and(
        eq(tables.discussionSyncSources.id, recordId),
        eq(tables.discussionSyncSources.teamId, teamId),
        eq(tables.discussionSyncSources.owner, ownerId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionSyncSource not found or unauthorized'
    })
  }

  return { success: true }
}