#!/usr/bin/env tsx
/**
 * Database Seeding CLI
 *
 * Usage:
 *   pnpm seed              # Run all seeds
 *   pnpm seed:clear        # Clear all seeded data
 *   pnpm seed:reset        # Clear and reseed all data
 *   pnpm seed:sources      # Seed only sources
 */

import { seedAll, clearAll, reseedAll, seedSources } from './index'

const command = process.argv[2] || 'all'

async function main() {
  try {
    switch (command) {
      case 'all':
        await seedAll()
        break

      case 'clear':
        await clearAll()
        break

      case 'reset':
        await reseedAll()
        break

      case 'sources':
        await seedSources()
        break

      default:
        console.error(`Unknown command: ${command}`)
        console.log('Available commands: all, clear, reset, sources')
        process.exit(1)
    }

    process.exit(0)
  }
  catch (error) {
    console.error('[Seed CLI] Error:', error)
    process.exit(1)
  }
}

main()
