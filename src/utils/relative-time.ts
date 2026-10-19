const SECOND_IN_MILLISECONDS: number = 1000;
const MINUTE_IN_MILLISECONDS: number = 60 * SECOND_IN_MILLISECONDS;
const HOUR_IN_MILLISECONDS: number = 60 * MINUTE_IN_MILLISECONDS;
const DAY_IN_MILLISECONDS: number = 24 * HOUR_IN_MILLISECONDS;
const WEEK_IN_MILLISECONDS: number = 7 * DAY_IN_MILLISECONDS;
const FOUR_WEEKS_IN_MILLISECONDS: number = 4 * WEEK_IN_MILLISECONDS;
const YEAR_IN_MILLISECONDS: number = 365 * DAY_IN_MILLISECONDS;

const formatUnit = (
  value: number,
  singularUnit: string,
  pluralUnit: string = `${singularUnit}s`,
): string => {
  return `${value} ${value === 1 ? singularUnit : pluralUnit} ago`;
};

export const formatRelativeTime = (
  timestamp: string,
  nowInMilliseconds: number = Date.now(),
): string => {
  const timestampInMilliseconds: number = Date.parse(timestamp);
  if (!Number.isFinite(timestampInMilliseconds)) {
    return 'Unknown time';
  }

  const elapsedMilliseconds: number = Math.max(
    0,
    nowInMilliseconds - timestampInMilliseconds,
  );
  if (elapsedMilliseconds < MINUTE_IN_MILLISECONDS) {
    return 'just now';
  }

  if (elapsedMilliseconds < HOUR_IN_MILLISECONDS) {
    const minutes: number = Math.floor(
      elapsedMilliseconds / MINUTE_IN_MILLISECONDS,
    );
    return `${minutes} min ago`;
  }

  if (elapsedMilliseconds < DAY_IN_MILLISECONDS) {
    const hours: number = Math.floor(
      elapsedMilliseconds / HOUR_IN_MILLISECONDS,
    );
    return formatUnit(hours, 'hour');
  }

  if (elapsedMilliseconds < WEEK_IN_MILLISECONDS) {
    const days: number = Math.floor(elapsedMilliseconds / DAY_IN_MILLISECONDS);
    return formatUnit(days, 'day');
  }

  if (elapsedMilliseconds < FOUR_WEEKS_IN_MILLISECONDS) {
    const weeks: number = Math.floor(
      elapsedMilliseconds / WEEK_IN_MILLISECONDS,
    );
    return formatUnit(weeks, 'week');
  }

  if (elapsedMilliseconds < YEAR_IN_MILLISECONDS) {
    const elapsedDays: number = Math.floor(
      elapsedMilliseconds / DAY_IN_MILLISECONDS,
    );
    const months: number = Math.min(
      11,
      Math.max(1, Math.floor(elapsedDays / 30)),
    );
    return formatUnit(months, 'month');
  }

  const years: number = Math.floor(elapsedMilliseconds / YEAR_IN_MILLISECONDS);
  return formatUnit(years, 'year');
};
