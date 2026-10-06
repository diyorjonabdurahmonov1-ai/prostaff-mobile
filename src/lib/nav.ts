import { router, type Href } from 'expo-router';

/**
 * Move to a screen and make it the bottom of the stack.
 *
 * Switching between the customer side and a provider panel is not navigation
 * within one app — it is a change of which app this is. Only one mode is active
 * at a time, so only one root should exist, and Back from it should leave.
 *
 * `replace` alone is not enough, and the way it fails is asymmetric enough to
 * look like nothing was wrong. Going *into* a panel happens from the customer
 * home, which is the root: replacing it leaves exactly one entry and Back exits,
 * which is right. Coming *out* happens from `/worker/profile` — a screen pushed
 * on top of `/worker` — so replacing the top swapped the profile for the
 * customer home and left the worker panel sitting underneath it. Back then took
 * the user straight back into the account they had just left, and every switch
 * after that stacked one more.
 *
 * So the stack is emptied down to its root before the root itself is swapped.
 *
 * `canDismiss` first: `dismissAll` on a stack that is already a single screen is
 * the ordinary case, not an error, and this is called on both directions of the
 * switch.
 */
export function switchRoot(href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}

/**
 * Leave a finished flow and go back to the tabs.
 *
 * The order flow is four screens deep — category, details, review, and then the
 * rating that follows the job — and every one of them is *spent* once it has
 * been through. Sending the customer onward with `navigate` left the whole trail
 * underneath, so Back walked them into the review of an order they had already
 * placed, and again into the rating they had already given. Those screens have
 * no second use; the only thing behind a finished order is the list it is in.
 *
 * So the stack is emptied first, and the destination is a tab rather than a
 * pushed screen.
 */
export function finishFlow(href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(href);
}
