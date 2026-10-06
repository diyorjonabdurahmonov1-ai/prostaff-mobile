import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import type { Category } from '@/lib/types';

let cache: Category[] | null = null;

/**
 * Fetches (and module-caches) the service category list.
 *
 * The cache is what keeps a category chip row from re-fetching on every screen
 * that renders one. `reload` is the way out of it: a category the admin added
 * an hour ago would otherwise not exist for this app until it restarted, which
 * is exactly what someone pulling the list down is asking about.
 *
 * Two lists come back, because the screens ask two different questions:
 *
 *   - `activeCategories` — what may be *chosen*. Anything offering a choice
 *     uses this: the customer's grid, the order form, a worker's own list.
 *   - `categories` — everything, retired rows included. What a category id
 *     *means*. An order placed a year ago under a service the office has since
 *     retired still has to render with its name, so lookups read the full list.
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await api.get<Category[]>('/categories');
      cache = data ?? [];
      setCategories(cache);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cache) return;
    let active = true;
    (async () => {
      try {
        const data = await api.get<Category[]>('/categories');
        cache = data ?? [];
        if (active) setCategories(cache);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // `active` is absent on a response from a server that predates the admin
  // screen, and an undefined flag must not empty every picker on the platform —
  // so only an explicit false retires a row.
  const activeCategories = useMemo(
    () => categories.filter((c) => c.active !== false),
    [categories],
  );

  const byId = (id: string) => categories.find((c) => c.id === id);
  return { categories, activeCategories, loading, error, byId, reload };
}
