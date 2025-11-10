#!/usr/bin/env tsx
/**
 * Generate Encryption Key
 *
 * Generates a secure random encryption key for token encryption.
 * Run this once and add the output to your .env file.
 *
 * Usage:
 *   tsx server/utils/generate-encryption-key.ts
 */

import { generateEncryptionKey } from './encryption'

console.log('Generating secure encryption key...\n')

const key = generateEncryptionKey()

console.log('Your encryption key:')
console.log('='.repeat(70))
console.log(key)
console.log('='.repeat(70))
console.log('\nAdd this to your .env file:')
console.log(`ENCRYPTION_KEY=${key}`)
console.log('\n⚠️  IMPORTANT: Keep this key secure! If you lose it, you cannot decrypt your tokens.')
console.log('Store it safely in your password manager or secret store.')
