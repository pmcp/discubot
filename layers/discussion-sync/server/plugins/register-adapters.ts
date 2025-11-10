/**
 * Register Discussion Source Adapters
 *
 * This plugin runs on server startup and registers all available
 * discussion source adapters with the adapter registry.
 */

import { registerAdapter } from '../adapters/base'
import { FigmaAdapter } from '../adapters/figma'
import { SlackAdapter } from '../adapters/slack'

export default defineNitroPlugin(() => {
  console.log('[Discussion Sync] Registering source adapters...')

  try {
    // Register Figma adapter
    registerAdapter('figma', FigmaAdapter)

    // Register Slack adapter
    registerAdapter('slack', SlackAdapter)

    console.log('[Discussion Sync] Adapters registered successfully:', ['figma', 'slack'])
  }
  catch (error) {
    console.error('[Discussion Sync] Failed to register adapters:', error)
    throw error
  }
})
