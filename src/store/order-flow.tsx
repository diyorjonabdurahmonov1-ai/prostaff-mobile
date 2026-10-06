/**
 * In-progress order draft shared across the create-order steps
 * (category -> details -> review -> submit).
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Gender } from '@/lib/types';

/** Graceful fallback location: central Tashkent. */
export const TASHKENT = { lat: 41.311, lng: 69.24 };

export interface OrderDraft {
  categoryId: string | null;
  /**
   * Worker profiles the customer picked by hand from the nearby list.
   *
   * Empty is the ordinary order: describe the job, and every matching worker
   * nearby is rung at once. Non-empty means these workers and nobody else — the
   * server stops matchmaking and simply calls the phones that were chosen.
   */
  targetWorkerIds: string[];
  /** Their names, carried alongside so the review screen can show who. */
  targetWorkerNames: string[];
  /**
   * How many people the job takes.
   *
   * One order, not one per worker. A banquet needing five helpers is one job
   * with five places on it: the search keeps running until five have accepted,
   * and each of them holds a place rather than racing the others for the only
   * one. Filling the same form five times, and then following five unrelated
   * orders for one evening, is what this replaces.
   */
  workersNeeded: number;
  gender: Gender;
  description: string;
  /** Photos attached to the job — several, because one rarely explains it. */
  images: string[];
  phone: string;
  /** what the customer offers to pay, in so'm */
  price: string;
  lat: number;
  lng: number;
  locationResolved: boolean;
}

const initialDraft: OrderDraft = {
  categoryId: null,
  targetWorkerIds: [],
  targetWorkerNames: [],
  workersNeeded: 1,
  gender: 'any',
  description: '',
  images: [],
  phone: '',
  price: '',
  lat: TASHKENT.lat,
  lng: TASHKENT.lng,
  locationResolved: false,
};

interface OrderFlowContextValue {
  draft: OrderDraft;
  update: (patch: Partial<OrderDraft>) => void;
  reset: (patch?: Partial<OrderDraft>) => void;
}

const OrderFlowContext = createContext<OrderFlowContextValue | null>(null);

export function OrderFlowProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<OrderDraft>(initialDraft);

  const update = useCallback((patch: Partial<OrderDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback((patch?: Partial<OrderDraft>) => {
    setDraft({ ...initialDraft, ...patch });
  }, []);

  const value = useMemo(() => ({ draft, update, reset }), [draft, update, reset]);
  return <OrderFlowContext.Provider value={value}>{children}</OrderFlowContext.Provider>;
}

export function useOrderFlow(): OrderFlowContextValue {
  const ctx = useContext(OrderFlowContext);
  if (!ctx) throw new Error('useOrderFlow must be used within OrderFlowProvider');
  return ctx;
}
