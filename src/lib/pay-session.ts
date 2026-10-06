/**
 * The one payment currently being paid for, and the promise the screen that
 * started it is waiting on.
 *
 * # Why this exists at all
 *
 * `checkout()` is an ordinary async function: the wallet asks to be topped up
 * and awaits an answer, and it neither knows nor cares that a card form and an
 * SMS-code form happen in between. That was easy to arrange while those forms
 * were a sheet mounted at the root — the sheet held the promise in a ref.
 *
 * They are screens now, which is what the card step needed: a full page has
 * room for the CVV field international cards require, a 3DS trip out to the
 * bank and back, and a real back button. But a screen is mounted by the router
 * and unmounted when it is popped, so it cannot be where the promise lives —
 * the promise has to outlive the very navigation that answers it.
 *
 * So it lives here: module state, one payment at a time, with the screens
 * subscribing through `usePaySession`.
 *
 * # The rule
 *
 * `resolve` is called exactly once and then dropped. Whoever calls it owns the
 * answer; everyone else finds it already gone and does nothing. That matters
 * because there are three ways out of this flow — paid, cancelled, and the
 * screen being torn down — and a screen behind that acted on two of them would
 * credit a wallet twice on screen while the server credited it once.
 */

import { useSyncExternalStore } from 'react';

import type { CheckoutResult } from '@/lib/payments';
import type { Payment } from '@/lib/types';

/** Which card was entered, as the server read it. Decides what happens next. */
export type PayBrand = 'local' | 'visa' | 'mastercard' | 'unknown';

export interface PaySession {
  payment: Payment;
  /**
   * Set once the card has been accepted: the brand the server detected, and
   * where it sent us. `otp` for a local card, `3ds` for an international one.
   */
  brand?: PayBrand;
  /** The bank's own 3DS page, for an international card. */
  redirectUrl?: string;
  /** What came back masked, so the payer can see which card they are paying on. */
  maskedPan?: string;
}

let session: PaySession | null = null;
let resolve: ((result: CheckoutResult) => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/**
 * Starts a payment and hands back the promise `checkout()` awaits.
 *
 * Any session still open is answered `canceled` first rather than dropped.
 * Two payments cannot be in flight at once — there is one card screen — and
 * silently replacing the first would leave its caller waiting for ever.
 */
export function beginPaySession(payment: Payment): Promise<CheckoutResult> {
  endPaySession({ status: 'canceled' });
  return new Promise<CheckoutResult>((done) => {
    session = { payment };
    resolve = done;
    emit();
  });
}

/** Records what the server said about the card, and moves the flow forward. */
export function updatePaySession(patch: Partial<Omit<PaySession, 'payment'>>) {
  if (!session) return;
  session = { ...session, ...patch };
  emit();
}

/**
 * Answers the waiting `checkout()` and clears the session.
 *
 * Safe to call from anywhere, including twice: the resolver is taken before it
 * is used, so the second caller finds nothing and returns quietly. That is what
 * makes it correct to call from a screen's unmount cleanup as a backstop —
 * without one, backing out of the card screen by a gesture rather than by the
 * cancel button would leave the wallet awaiting an answer that never comes.
 */
export function endPaySession(result: CheckoutResult) {
  const done = resolve;
  resolve = null;
  session = null;
  if (done) {
    emit();
    done(result);
  }
}

/** Whether a payment is still waiting to be answered. */
export function paySessionOpen(): boolean {
  return resolve !== null;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const snapshot = () => session;

/** The session, for the screens that draw it. Null once it has been answered. */
export function usePaySession(): PaySession | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
