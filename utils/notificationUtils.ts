/**
 * Utility functions for the notification system.
 */

/**
 * Computes the number of seconds remaining until the given expiration timestamp.
 * Returns 0 if the timestamp is in the past.
 *
 * @param expiresAt - ISO 8601 timestamp string
 * @returns Seconds remaining (non-negative integer)
 */
export function computeSecondsRemaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}
