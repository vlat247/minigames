import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatRelativeTime } from './relative-time';

const NOW_IN_MILLISECONDS: number = Date.parse('2026-10-08T12:00:00.000Z');
const SECOND_IN_MILLISECONDS: number = 1000;
const MINUTE_IN_MILLISECONDS: number = 60 * SECOND_IN_MILLISECONDS;
const HOUR_IN_MILLISECONDS: number = 60 * MINUTE_IN_MILLISECONDS;
const DAY_IN_MILLISECONDS: number = 24 * HOUR_IN_MILLISECONDS;

const timestampBeforeNow = (elapsedMilliseconds: number): string => {
  return new Date(NOW_IN_MILLISECONDS - elapsedMilliseconds).toISOString();
};

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a fallback for an invalid timestamp', () => {
    expect(formatRelativeTime('not-a-date', NOW_IN_MILLISECONDS)).toBe(
      'Unknown time',
    );
  });

  it.each([
    ['a current timestamp', 0],
    ['a timestamp less than one minute old', MINUTE_IN_MILLISECONDS - 1],
  ])('formats %s as just now', (_description, elapsedMilliseconds) => {
    expect(
      formatRelativeTime(
        timestampBeforeNow(elapsedMilliseconds),
        NOW_IN_MILLISECONDS,
      ),
    ).toBe('just now');
  });

  it('treats future timestamps as just now', () => {
    const futureTimestamp: string = new Date(
      NOW_IN_MILLISECONDS + HOUR_IN_MILLISECONDS,
    ).toISOString();

    expect(formatRelativeTime(futureTimestamp, NOW_IN_MILLISECONDS)).toBe(
      'just now',
    );
  });

  it.each([
    [MINUTE_IN_MILLISECONDS, '1 min ago'],
    [59 * MINUTE_IN_MILLISECONDS + 59 * SECOND_IN_MILLISECONDS, '59 min ago'],
    [HOUR_IN_MILLISECONDS, '1 hour ago'],
    [2 * HOUR_IN_MILLISECONDS, '2 hours ago'],
    [DAY_IN_MILLISECONDS, '1 day ago'],
    [6 * DAY_IN_MILLISECONDS, '6 days ago'],
    [7 * DAY_IN_MILLISECONDS, '1 week ago'],
    [27 * DAY_IN_MILLISECONDS, '3 weeks ago'],
    [28 * DAY_IN_MILLISECONDS, '1 month ago'],
    [60 * DAY_IN_MILLISECONDS, '2 months ago'],
    [364 * DAY_IN_MILLISECONDS, '11 months ago'],
    [365 * DAY_IN_MILLISECONDS, '1 year ago'],
    [730 * DAY_IN_MILLISECONDS, '2 years ago'],
  ])(
    'formats an elapsed duration of %i milliseconds as %s',
    (elapsedMilliseconds, expected) => {
      expect(
        formatRelativeTime(
          timestampBeforeNow(elapsedMilliseconds),
          NOW_IN_MILLISECONDS,
        ),
      ).toBe(expected);
    },
  );

  it('uses the current system time when now is omitted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_IN_MILLISECONDS);

    expect(formatRelativeTime(timestampBeforeNow(HOUR_IN_MILLISECONDS))).toBe(
      '1 hour ago',
    );
  });
});
