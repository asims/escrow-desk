import { describe, it, expect } from 'vitest';
import { nextBusinessDay } from './businessDay';
import { toIsoDate } from './dates';

describe('nextBusinessDay', () => {
  it('returns the same day when it is already a weekday with no holiday', () => {
    // 2026-10-08 is a Thursday.
    const from = new Date('2026-10-08T00:00:00Z');
    const result = nextBusinessDay(from, []);
    expect(toIsoDate(result)).toBe('2026-10-08');
  });

  it('skips the weekend to the following Monday', () => {
    // 2026-10-10 is a Saturday.
    const from = new Date('2026-10-10T00:00:00Z');
    const result = nextBusinessDay(from, []);
    expect(toIsoDate(result)).toBe('2026-10-12'); // Monday
  });

  it('skips a supplied holiday ISO date', () => {
    // 2026-11-26 is Thanksgiving (Thursday); next business day is Friday.
    const from = new Date('2026-11-26T00:00:00Z');
    const result = nextBusinessDay(from, ['2026-11-26']);
    expect(toIsoDate(result)).toBe('2026-11-27');
  });
});
