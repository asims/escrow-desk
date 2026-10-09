import { toIsoDate } from './dates';

export interface BusinessDayResult {
  isBusinessDay: boolean;
  holidayName?: string; // Set when isBusinessDay is false due to a holiday
  source: 'api' | 'fallback';
  error?: string;
  holidays?: string[]; // ISO dates for the year, used to compute value dates
}

const TIMEOUT_MS = 3000;

/**
 * Determine whether `date` is a valid US wire/ACH business day.
 *
 * Calls the public Nager.Date holiday API with a 3-second AbortController
 * timeout. On any network error or timeout it FAILS OPEN:
 * { isBusinessDay: true, source: 'fallback' }. Blocking releases whenever a
 * third-party API is unavailable would be the wrong default; the UI surfaces
 * the fallback as a warning instead.
 */
export async function checkBusinessDay(date: Date): Promise<BusinessDayResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const year = date.getUTCFullYear();
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/US`,
      { signal: controller.signal },
    );
    if (!res.ok) {
      throw new Error(`Holiday API returned ${res.status}`);
    }
    const holidays: { date: string; name: string }[] = await res.json();
    const holidayDates = holidays.map((h) => h.date);
    const today = toIsoDate(date);
    const holiday = holidays.find((h) => h.date === today);
    const dayOfWeek = date.getUTCDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (holiday) {
      return {
        isBusinessDay: false,
        holidayName: holiday.name,
        source: 'api',
        holidays: holidayDates,
      };
    }
    if (isWeekend) {
      return {
        isBusinessDay: false,
        holidayName: 'Weekend',
        source: 'api',
        holidays: holidayDates,
      };
    }
    return { isBusinessDay: true, source: 'api', holidays: holidayDates };
  } catch (err) {
    return {
      isBusinessDay: true,
      source: 'fallback',
      error: (err as Error).message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pure helper: advance from `from` to the next weekday whose ISO date is not in
 * `holidays`. Returns `from` itself when it is already a valid business day.
 * Used to compute Release.valueDate at approval time.
 */
export function nextBusinessDay(from: Date, holidays: string[]): Date {
  const holidaySet = new Set(holidays);
  const cursor = new Date(from.getTime());
  // Normalize to midnight UTC for stable comparisons.
  cursor.setUTCHours(0, 0, 0, 0);

  while (true) {
    const day = cursor.getUTCDay();
    const iso = toIsoDate(cursor);
    const isWeekend = day === 0 || day === 6;
    if (!isWeekend && !holidaySet.has(iso)) {
      return cursor;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}
