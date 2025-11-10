import type { User as DrizzleUser } from './database'
import type { SanitizedUser } from '~~/server/utils/auth'
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types'

declare module '#auth-utils' {
  interface SessionUser extends SanitizedUser {
    id: string // Required for sessions
    _impersonated?: boolean
    superAdmin: boolean
  }

  interface User extends Omit<
    DrizzleUser,
    | 'hashedPassword'
    | 'banned'
    | 'bannedReason'
    | 'bannedUntil'
    | 'createdAt'
    | 'updatedAt'
    | 'phoneNumber'
    | 'lastActive'
  > {
    _impersonated?: boolean
    superAdmin: boolean
  }

  interface UserSession {
    /**
     * Session ID
     */
    id?: string
    /**
     * User session data, available on client and server
     */
    user?: SessionUser
    /**
     * Private session data, only available on server/ code
     */
    secure?: SecureSessionData
    /**
     * Extra session data, available on client and server
     */
    superAdmin?: boolean
    [key: string]: unknown
  }

  interface SecureSessionData {
    originalAdminSession: UserSessionRequired
  }

  interface UserSessionComposable {
    /**
     * Computed indicating if the auth session is ready
     */
    ready: ComputedRef<boolean>
    /**
     * Computed indicating if the user is logged in.
     */
    loggedIn: ComputedRef<boolean>
    /**
     * The user object if logged in, null otherwise.
     */
    user: ComputedRef<User | null>
    /**
     * The session object.
     */
    session: Ref<UserSession>
    /**
     * Fetch the user session from the server.
     */
    fetch: () => Promise<void>
    /**
     * Clear the user session and remove the session cookie.
     */
    clear: () => Promise<void>
    /**
     * Open the OAuth route in a popup that auto-closes when successful.
     */
    openInPopup: (
      route: string,
      size?: { width?: number, height?: number },
    ) => void
  }

  interface WebAuthnCredential {
    id: string
    publicKey: string
    counter: number
    backedUp: boolean
    transports?: AuthenticatorTransportFuture[]
    [key: string]: unknown
  }
}

export {}
