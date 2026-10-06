import { useEffect, useMemo, useState } from 'react';

/**
 * Counts down to `deadline` (ms epoch) or `seconds` from mount.
 * Returns remaining whole seconds and an `expired` flag.
 */
export function useCountdown(target: { deadline?: number | null; seconds?: number }) {
  const deadline = useMemo(() => {
    if (target.deadline) return target.deadline;
    if (target.seconds) return Date.now() + target.seconds * 1000;
    return Date.now();
  }, [target.deadline, target.seconds]);

  const compute = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  const [remaining, setRemaining] = useState(compute);

  useEffect(() => {
    setRemaining(compute());
    const id = setInterval(() => setRemaining(compute()), 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  return { remaining, expired: remaining <= 0 };
}

/** Format seconds as M:SS. */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
