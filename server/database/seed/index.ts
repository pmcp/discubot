/**
 * Database Seeding Entry Point
 *
 * This file orchestrates all database seeding operations.
 * Import and run specific seed functions as needed.
 */

import { seedSources, clearSources, reseedSources } from './sources'

/**
 * Run all seeds
 */
export async function seedAll() {
  console.log('[Seed] Running all database seeds...')

  try {
    await seedSources()

    console.log('[Seed] All seeds completed successfully!')
  }
  catch (error) {
    console.error('[Seed] Seeding failed:', error)
    throw error
  }
}

/**
 * Clear all seeded data
 */
export async function clearAll() {
  console.log('[Seed] Clearing all seeded data...')

  try {
    await clearSources()

    console.log('[Seed] All data cleared successfully!')
  }
  catch (error) {
    console.error('[Seed] Clearing failed:', error)
    throw error
  }
}

/**
 * Reseed all data (clear and seed)
 */
export async function reseedAll() {
  await clearAll()
  await seedAll()
}

// Export individual seed functions for targeted use
export { seedSources, clearSources, reseedSources }
