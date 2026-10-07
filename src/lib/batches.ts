/**
 * The orders of one "I need N workers" request, taken as a whole.
 *
 * A request for four workers goes out as four separate orders (see the comment
 * in `review.tsx` for why), and each one is taken or not on its own. The
 * customer, though, asked one question — "four people" — and needs one answer:
 * how many came, how many are still being looked for, and how many did not.
 */

import { api, ApiError } from '@/lib/api';
import type { Order, OrderStatus } from '@/lib/types';

/**
 * How far apart the orders of one request can be stamped.
 *
 * They are posted in parallel from one tap, so the server stamps them within
 * a second or two of each other. The window is only the fallback for a server
 * that does not echo `batch_id` back.
 */
const SAME_REQUEST_MS = 15_000;

export type Slot = 'found' | 'searching' | 'missing' | 'withdrawn';

const FOUND: OrderStatus[] = ['accepted', 'in_progress', 'completed'];
const SEARCHING: OrderStatus[] = ['pending', 'matching', 'invited'];

/**
 * Where one order of a request stands.
 *
 * `withdrawn` is the customer's own cancellation — a place they chose to give
 * up, so it is not counted as a worker still owed to them.
 */
export function slotOf(order: Order): Slot {
  if (FOUND.includes(order.status)) return 'found';
  if (SEARCHING.includes(order.status)) return 'searching';
  if (order.status === 'cancelled' && !order.worker_id) return 'withdrawn';
  return 'missing';
}

/**
 * Whether two orders came out of the same request.
 *
 * By `batch_id` when the server sends it. Without it, orders of one request are
 * the same job — category, description, price, place — placed within seconds,
 * and none of them aimed at a hand-picked worker (those are separate choices,
 * each with its own name on it).
 */
function sameRequest(a: Order, b: Order): boolean {
  if (a.batch_id || b.batch_id) return !!a.batch_id && a.batch_id === b.batch_id;
  if (a.company_id || b.company_id) return false;
  return (
    a.category_id === b.category_id &&
    a.description === b.description &&
    a.price === b.price &&
    a.lat === b.lat &&
    a.lng === b.lng &&
    Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) <= SAME_REQUEST_MS
  );
}

export interface OrderEntry {
  key: string;
  /** Oldest first, so "1-ishchi" stays the same order on every refresh. */
  orders: Order[];
}

/** The order list as the customer thinks of it: one entry per request. */
export function groupOrders(orders: Order[]): OrderEntry[] {
  const entries: OrderEntry[] = [];
  for (const order of orders) {
    const home = entries.find((e) => sameRequest(e.orders[0], order));
    if (home) home.orders.push(order);
    else entries.push({ key: order.id, orders: [order] });
  }
  for (const e of entries) {
    e.orders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  return entries;
}

export function progressOf(orders: Order[]) {
  const count = (slot: Slot) => orders.filter((o) => slotOf(o) === slot).length;
  const withdrawn = count('withdrawn');
  return {
    found: count('found'),
    searching: count('searching'),
    missing: count('missing'),
    /** The places still wanted: everything the customer did not cancel. */
    wanted: orders.length - withdrawn,
  };
}

/**
 * Looks again for every place of the request that came back empty.
 *
 * Each empty order is re-opened in place (`dispatch`), the same call the order
 * screen's "Qaytadan qidirish" makes. Every order of a request is a broadcast,
 * so re-opening asks all nearby workers again — not just whoever let it go —
 * and the request keeps exactly its own orders: a replacement order would
 * leave the empty one behind, still counted as a place to fill.
 *
 * Returns how many could not be re-sent.
 */
export async function retryMissing(orders: Order[]): Promise<number> {
  const missing = orders.filter((o) => slotOf(o) === 'missing');
  const results = await Promise.allSettled(
    missing.map((o) => api.post<Order>(`/orders/${o.id}/dispatch`)),
  );
  return results.filter((r) => r.status === 'rejected').length;
}

/**
 * "Start with the workers I have": stop looking for the rest.
 *
 * Asks the server to start the request with the places filled so far, which
 * also releases the customer's phone and address to the workers waiting on it.
 * A server without that endpoint still gets the part it can do: every place
 * still searching, or empty, is cancelled one by one, so nobody else is rung
 * for a job the customer has closed.
 *
 * Returns how many places could not be closed.
 */
export async function startWithFound(orders: Order[]): Promise<number> {
  const batchId = orders.find((o) => o.batch_id)?.batch_id;
  if (batchId) {
    try {
      await api.post(`/orders/batch/${batchId}/start`);
      return 0;
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
  }
  const open = orders.filter((o) => slotOf(o) === 'searching' || o.status === 'expired');
  const results = await Promise.allSettled(open.map((o) => api.post(`/orders/${o.id}/cancel`)));
  // An expired order may already be closed for good; only a search that keeps
  // running is a failure worth reporting.
  return results.filter((r, i) => r.status === 'rejected' && slotOf(open[i]) === 'searching').length;
}
