import type { Escrow } from '../types';

/**
 * The release date that governs an escrow's urgency: the earliest scheduled
 * release on/after `asOf`, or the latest schedule entry if all are in the past.
 * Returns null when there is no schedule.
 */
export function governingReleaseDate(escrow: Escrow, asOf: Date): string | null {
  if (escrow.releaseSchedule.length === 0) return null;
  const sorted = [...escrow.releaseSchedule].sort((a, b) =>
    a.releaseDate.localeCompare(b.releaseDate),
  );
  const upcoming = sorted.find((s) => new Date(s.releaseDate) >= asOf);
  return (upcoming ?? sorted[sorted.length - 1]).releaseDate;
}

/** Whole days from `asOf` to a release date (negative = overdue). */
export function daysUntil(releaseDate: string, asOf: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const target = new Date(`${releaseDate}T00:00:00Z`).getTime();
  const now = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth(),
    asOf.getUTCDate(),
  );
  return Math.round((target - now) / msPerDay);
}

export function openClaimCount(escrow: Escrow): number {
  return escrow.claims.filter(
    (c) => c.status === 'open' || c.status === 'disputed',
  ).length;
}
