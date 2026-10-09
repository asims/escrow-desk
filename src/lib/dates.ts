/**
 * Pure date helpers shared by the business-logic layer. No side effects, no
 * React, no Date.now() — callers always pass the dates in.
 */

/** Whole months elapsed from `from` to `to` (floored, never negative). */
export function wholeMonthsBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  // If the day-of-month hasn't been reached yet, the final month isn't whole.
  if (to.getUTCDate() < from.getUTCDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

/** Fractional years elapsed from `from` to `to` using a 365-day year. */
export function yearFractionBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = (to.getTime() - from.getTime()) / msPerDay;
  return days / 365;
}

/** ISO date (YYYY-MM-DD) for a Date, in UTC. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
