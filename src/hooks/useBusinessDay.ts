import { useEffect, useState } from 'react';
import {
  checkBusinessDay,
  type BusinessDayResult,
} from '../lib/businessDay';

interface UseBusinessDayState {
  result: BusinessDayResult | null;
  loading: boolean;
}

/**
 * React hook wrapping checkBusinessDay. Calls the Fed holiday API once on mount
 * for the given date (defaults to now) and exposes { result, loading }. The
 * underlying call fails open, so result is never an error state that blocks the
 * UI — a fallback source surfaces as a warning banner instead.
 */
export function useBusinessDay(date: Date = new Date()): UseBusinessDayState {
  const [state, setState] = useState<UseBusinessDayState>({
    result: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    setState({ result: null, loading: true });
    checkBusinessDay(date).then((result) => {
      if (active) setState({ result, loading: false });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date.getTime()]);

  return state;
}
