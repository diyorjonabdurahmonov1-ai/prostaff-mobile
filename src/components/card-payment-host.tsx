import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { beginPaySession, endPaySession } from '@/lib/pay-session';
import { setCardPresenter } from '@/lib/payments';

/**
 * Puts the card screen on screen when something asks to be paid for.
 *
 * # What is left of this component
 *
 * It used to *be* the card form — a sheet mounted at the root, holding the
 * fields, the SMS code and the promise `checkout()` was waiting on. The form is
 * two screens now (app/(app)/pay/), for the reasons written there, and the
 * promise lives in lib/pay-session.ts because it has to outlive the navigation
 * that answers it.
 *
 * So all that remains here is the one thing that can only happen inside a
 * component: navigating. It renders nothing.
 *
 * # Why `checkout()` still does not know about any of this
 *
 * Because that was the point of the arrangement, and it has not changed. Every
 * purchase in the app awaits an ordinary async function; mounting this once at
 * the root and letting `checkout` reach it means no screen that buys something
 * has to know that part of paying happens on screen.
 */
export function CardPaymentHost() {
  const router = useRouter();

  useEffect(() => {
    setCardPresenter((payment) => {
      const done = beginPaySession(payment);
      router.push('/pay/card');
      return done;
    });
    return () => {
      setCardPresenter(null);
      // Unmounting mid-payment — a sign-out, say. The promise `checkout()` is
      // awaiting has to be answered by somebody, or the screen that started the
      // purchase waits for ever on a flow that no longer exists.
      endPaySession({ status: 'canceled' });
    };
  }, [router]);

  return null;
}
