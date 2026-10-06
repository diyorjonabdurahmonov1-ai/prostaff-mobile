/**
 * Holds the name and password typed on the sign-up screen until the code screen
 * can send them to the server.
 *
 * They deliberately do NOT travel as route params: expo-router serialises those
 * into the URL on web, which would put the password in the address bar and in
 * browser history. This keeps them in module memory instead — never written to
 * storage, and cleared as soon as they have been used or the flow is abandoned.
 */

export interface PendingSignup {
  phone: string;
  name: string;
  password: string;
}

let pending: PendingSignup | null = null;

export function setPendingSignup(next: PendingSignup): void {
  pending = next;
}

/** Returns the details for `phone`, or null if the flow was not started here. */
export function getPendingSignup(phone: string): PendingSignup | null {
  if (!pending || pending.phone !== phone) return null;
  return pending;
}

export function clearPendingSignup(): void {
  pending = null;
}
