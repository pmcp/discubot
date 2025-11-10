/**
 * Database exports
 *
 * Re-exports the database instance and utility functions from the utils
 */
import { useDB } from '../utils/database'

// Export the database instance
export const db = useDB()

// Re-export schema and query functions
export * from '../utils/database'
