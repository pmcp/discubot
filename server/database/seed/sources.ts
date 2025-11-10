/**
 * Database seeding for Discussion Sync Sources
 *
 * This file contains seed data for the initial discussion sync sources (Figma and Slack).
 * Run this to populate the sources table with base configurations.
 */

import { db } from '../index'
import { discussionSyncSources } from '../schema'

export interface SourceSeed {
  id: string
  teamId: string
  owner: string
  sourceType: string
  name: string
  description: string
  adapterClass: string
  icon?: string
  webhookPath?: string
  requiresEmail?: boolean
  requiresWebhook?: boolean
  requiresApiToken?: boolean
  active: boolean
  metadata?: Record<string, unknown>
  createdBy: string
  updatedBy: string
}

/**
 * Seed data for discussion sync sources
 */
export const sourceSeedData: SourceSeed[] = [
  {
    id: 'figma',
    teamId: 'system',
    owner: 'system',
    sourceType: 'figma',
    name: 'Figma',
    description: 'Sync Figma comments to Notion via email forwarding',
    adapterClass: 'FigmaAdapter',
    icon: '🎨',
    webhookPath: '/api/webhook/mailgun/figma',
    requiresEmail: true,
    requiresWebhook: true,
    requiresApiToken: true,
    active: true,
    metadata: {
      supportsThreads: true,
      supportsReactions: true,
      requiresEmail: true,
      emailProvider: 'mailgun',
      version: '1.0.0',
    },
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    id: 'slack',
    teamId: 'system',
    owner: 'system',
    sourceType: 'slack',
    name: 'Slack',
    description: 'Sync Slack threads to Notion using bot mentions',
    adapterClass: 'SlackAdapter',
    icon: '💬',
    webhookPath: '/api/webhook/slack/events',
    requiresEmail: false,
    requiresWebhook: true,
    requiresApiToken: true,
    active: true,
    metadata: {
      supportsThreads: true,
      supportsReactions: true,
      requiresOAuth: true,
      scopes: [
        'channels:history',
        'channels:read',
        'chat:write',
        'reactions:write',
        'users:read',
        'app_mentions:read',
      ],
      version: '1.0.0',
    },
    createdBy: 'system',
    updatedBy: 'system',
  },
]

/**
 * Seed the discussion_sync_sources table
 */
export async function seedSources() {
  console.log('[Seed] Starting discussion sync sources seeding...')

  try {
    // Check if sources already exist
    const existingSources = await db.select().from(discussionSyncSources)

    if (existingSources.length > 0) {
      console.log('[Seed] Sources already seeded, skipping...')
      return
    }

    // Insert seed data
    await db.insert(discussionSyncSources).values(sourceSeedData)

    console.log(`[Seed] Successfully seeded ${sourceSeedData.length} sources:`)
    sourceSeedData.forEach(source => {
      console.log(`  - ${source.icon} ${source.name} (${source.sourceType})`)
    })
  }
  catch (error) {
    console.error('[Seed] Failed to seed sources:', error)
    throw error
  }
}

/**
 * Clear all sources (for testing/development)
 */
export async function clearSources() {
  console.log('[Seed] Clearing discussion sync sources...')

  try {
    await db.delete(discussionSyncSources)
    console.log('[Seed] Successfully cleared sources')
  }
  catch (error) {
    console.error('[Seed] Failed to clear sources:', error)
    throw error
  }
}

/**
 * Reseed sources (clear and seed)
 */
export async function reseedSources() {
  await clearSources()
  await seedSources()
}
